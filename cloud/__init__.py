"""Private, single-owner health service. Create with cloud.create_app()."""
import hashlib
import io
import os
import re
from pathlib import Path
import secrets
import time
import threading
from collections import defaultdict, deque
from flask import Flask, request, session, jsonify, send_from_directory, redirect, g
from werkzeug.exceptions import HTTPException
from .db import Database
from .recognition import VisionProvider, RecognitionError, clean_drafts, image_data
from .metrics import daily_summary, trend_summary
from .attachments import create_storage
from .repository import Repository, Conflict, Missing, digest, dumps as dumps_safe
from records import KINDS

ROOT=Path(__file__).resolve().parent.parent

def create_app(config=None):
    app=Flask(__name__,static_folder=None)
    app.config.update(SECRET_KEY=os.environ.get('HEALTH_SECRET_KEY'),DB_HOST=os.environ.get('HEALTH_DB_HOST','127.0.0.1'),DB_PORT=os.environ.get('HEALTH_DB_PORT','3306'),DB_USER=os.environ.get('HEALTH_DB_USER',''),DB_PASSWORD=os.environ.get('HEALTH_DB_PASSWORD',''),DB_NAME=os.environ.get('HEALTH_DB_NAME','health'),ATTACHMENT_DIR=os.environ.get('HEALTH_ATTACHMENT_DIR','/var/lib/self-health/attachments'),MAX_CONTENT_LENGTH=21*1024*1024,SESSION_COOKIE_HTTPONLY=True,SESSION_COOKIE_SECURE=True,SESSION_COOKIE_SAMESITE='Strict',PERMANENT_SESSION_LIFETIME=28800)
    for key in ('MODEL_BASE_URL','MODEL_API_KEY','MODEL_NAME','OSS_ENDPOINT','OSS_BUCKET','OSS_ACCESS_KEY_ID','OSS_ACCESS_KEY_SECRET','OSS_KEY_PREFIX'): app.config[key]=os.environ.get('HEALTH_'+key)
    if config: app.config.update(config)
    if not app.config['SECRET_KEY']: raise ValueError('必须设置 HEALTH_SECRET_KEY')
    if app.config.get('SQLITE_PATH') and not app.config.get('TESTING'): raise ValueError('SQLite 仅用于隔离测试')
    repository=Repository(Database(app.config)); app.extensions['health_repository']=repository
    attachment_storage=create_storage(app.config,ROOT); app.extensions['health_attachments']=attachment_storage
    vision=app.config.get('VISION_PROVIDER') or VisionProvider(app.config); app.extensions['health_vision']=vision
    vision_lock=threading.BoundedSemaphore(1)
    attempts=defaultdict(deque)
    def error(message,status): return jsonify(ok=False,error=message),status
    @app.before_request
    def authenticate():
        if not request.path.startswith('/api/'): return
        g.bearer=False; g.authenticated=False
        header=request.headers.get('Authorization','')
        if header:
            if not header.startswith('Bearer '): return error('身份验证失败',401)
            user=repository.user(); token=header[7:]
            if not user or not user['token_hash'] or not secrets.compare_digest(user['token_hash'],digest(token)): return error('身份验证失败',401)
            g.bearer=True; g.authenticated=True
        elif session.get('owner'):
            user=repository.user()
            if user and session.get('authVersion')==user['auth_version']: g.authenticated=True
            else: session.clear()
        public=request.path in ('/api/v1/auth/login','/api/v1/session','/api/v1/auth/session')
        if not public and not g.authenticated: return error('请先登录',401)
        if request.method not in ('GET','HEAD','OPTIONS') and request.path!='/api/v1/auth/login' and not g.bearer:
            supplied=request.headers.get('X-CSRF-Token','')
            if not supplied or not secrets.compare_digest(session.get('csrf',''),supplied): return error('CSRF 验证失败',403)
    @app.after_request
    def headers(response):
        response.headers['Cache-Control']='no-store'; response.headers['X-Content-Type-Options']='nosniff'; response.headers['X-Frame-Options']='DENY'; response.headers['Referrer-Policy']='same-origin'
        return response
    @app.errorhandler(Conflict)
    def conflict(exc): return error(str(exc),409)
    @app.errorhandler(Missing)
    def missing(exc): return error(str(exc),404)
    @app.errorhandler(ValueError)
    def invalid(exc): return error(str(exc),400)
    @app.errorhandler(HTTPException)
    def http_error(exc): return error(exc.name,exc.code)
    @app.errorhandler(Exception)
    def unavailable(exc):
        # Exception messages from drivers may include connection details; never send/log them.
        if app.testing: raise exc
        return error('服务暂不可用',503)
    def body():
        value=request.get_json(silent=True)
        if not isinstance(value,dict): raise ValueError('请求必须为 JSON 对象')
        return value
    @app.post('/api/v1/auth/login')
    def login():
        key=request.remote_addr; now=time.monotonic(); queue=attempts[key]
        while queue and queue[0]<now-900: queue.popleft()
        if len(queue)>=10: return error('登录尝试过多，请稍后再试',429)
        queue.append(now); value=body()
        username=value.get('username','owner'); password=value.get('password','')
        if not isinstance(username,str) or not isinstance(password,str): return error('身份验证失败',401)
        user=repository.authenticate(username,password)
        if not user: return error('身份验证失败',401)
        attempts.pop(key,None); session.clear(); session.permanent=True; session.update(owner=1,authVersion=user['auth_version'],csrf=secrets.token_urlsafe(32))
        return jsonify(ok=True,csrfToken=session['csrf'])
    @app.get('/api/v1/session')
    @app.get('/api/v1/auth/session')
    def session_status(): return jsonify(authenticated=g.authenticated,csrfToken=session.get('csrf') if g.authenticated else None)
    @app.post('/api/v1/auth/logout')
    def logout(): session.clear(); return jsonify(ok=True)
    @app.get('/api/v1/data')
    @app.get('/api/v1/export')
    def data(): return jsonify(repository.read())
    @app.put('/api/v1/data')
    def snapshot():
        if not g.bearer: return error('此接口仅允许工作令牌',403)
        return jsonify(repository.snapshot(body()))
    @app.get('/api/v1/summary')
    def summary(): return jsonify(daily_summary(repository.read(),request.args.get('date')))
    @app.get('/api/v1/trends')
    def trends(): return jsonify(trend_summary(repository.read(),request.args.get('from'),request.args.get('to')))
    @app.get('/api/v1/version')
    def version(): return jsonify(revision=repository.read()['meta']['revision'])
    @app.get('/api/v1/records')
    def records_list():
        kind=request.args.get('kind')
        if kind not in KINDS: raise ValueError('未知 kind')
        snapshot=repository.read(); records=snapshot[KINDS[kind]]
        records=[r for r in records if (not request.args.get('from') or r.get('date','')>=request.args['from']) and (not request.args.get('to') or r.get('date','')<=request.args['to'])]
        return jsonify(records=records,revision=snapshot['meta']['revision'])
    @app.post('/api/v1/records')
    def record_add():
        value=body(); kind=value.get('kind')
        if kind not in KINDS or not isinstance(value.get('payload'),dict): raise ValueError('kind/payload 无效')
        def mutate(snapshot):
            record=repository.record(kind,value['payload'])
            if any(r.get('id')==record['id'] for r in snapshot[KINDS[kind]]): raise Conflict('记录 id 已存在')
            records=snapshot[KINDS[kind]]
            previous=None
            if kind=='activity': previous=next((r for r in records if r['date']==record['date']),None)
            if kind=='body': previous=next((r for r in records if (r['date'],r.get('source'),r.get('measureMode','fasting'))==(record['date'],record.get('source'),record['measureMode'])),None)
            if previous is not None:
                record={**previous,**record,'id':previous.get('id',record['id'])}
                if 'createdAt' in previous: record['createdAt']=previous['createdAt']
                records.remove(previous)
            records.append(record)
            records.sort(key=lambda r:(r.get('date',''),r.get('ts','')))
            return {'record':record}
        return jsonify(repository.mutate('add:'+kind,value,mutate))
    @app.post('/api/v1/records/batch')
    def record_batch():
        value=body();drafts=value.get('drafts')
        if not isinstance(drafts,list) or not 1<=len(drafts)<=6: raise ValueError('请确认1到6条记录')
        def mutate(snapshot):
            result=[];identities=set()
            for draft in drafts:
                if not isinstance(draft,dict) or draft.get('kind') not in KINDS or not isinstance(draft.get('payload'),dict): raise ValueError('草稿格式无效')
                kind=draft['kind'];payload={k:v for k,v in draft['payload'].items() if k not in {'id','createdAt','updatedAt','sourceKey'}};payload['source']='h5-ai'
                record=repository.record(kind,payload);rows=snapshot[KINDS[kind]];previous=None
                if kind=='activity':
                    identity=(kind,record['date']);previous=next((r for r in rows if r['date']==record['date']),None)
                elif kind=='body':
                    identity=(kind,record['date'],record['source'],record['measureMode']);previous=next((r for r in rows if (r['date'],r.get('source'),r.get('measureMode','fasting'))==identity[1:]),None)
                else: identity=None
                if identity and identity in identities: raise ValueError('同一天的相同活动或体测时段请合并后确认')
                if identity:identities.add(identity)
                if previous is not None:
                    record={**previous,**record,'id':previous['id'],'createdAt':previous.get('createdAt',record['createdAt'])};rows.remove(previous)
                rows.append(record);rows.sort(key=lambda r:(r.get('date',''),r.get('ts','')));result.append({'kind':kind,'record':record})
            return {'records':result}
        return jsonify(repository.mutate('confirm-drafts',value,mutate))
    @app.route('/api/v1/records/<kind>/<ident>',methods=['PATCH','DELETE'])
    def record_modify(kind,ident):
        if kind not in KINDS: raise ValueError('未知 kind')
        value=body()
        def mutate(snapshot):
            records=snapshot[KINDS[kind]]; record=next((r for r in records if r.get('id')==ident),None)
            if record is None: raise Missing('记录不存在')
            if request.method=='DELETE': records.remove(record); return {'record':record}
            patch=value.get('patch')
            if not isinstance(patch,dict) or set(patch)&{'id','sourceKey','createdAt','photo'}: raise ValueError('patch 无效或修改了受保护字段')
            changed=repository.record(kind,{**record,**patch},record); records[records.index(record)]=changed
            return {'record':changed}
        return jsonify(repository.mutate(request.method+':'+kind+':'+ident,value,mutate))
    @app.patch('/api/v1/profile')
    def profile():
        value=body()
        if not isinstance(value.get('profile'),dict): raise ValueError('profile 必须为对象')
        def mutate(snapshot): snapshot['profile'].update(value['profile']); return {'profile':snapshot['profile']}
        return jsonify(repository.mutate('profile',value,mutate))
    @app.get('/api/v1/status')
    def status():
        repository.read()
        return jsonify(database={'connected':True,'engine':'sqlite-test' if repository.db.sqlite else 'mysql'},model={'configured':vision.configured,'available':vision.configured},speech={'configured':False,'available':False},attachments={'backend':attachment_storage.backend,'configured':True})
    @app.post('/api/v1/recognize')
    def recognize():
        if not vision.configured: return jsonify(ok=False,configured=False,error='图片理解模型尚未配置；图片和说明仍保留，可使用手动记录'),503
        if not vision_lock.acquire(blocking=False): return error('AI 正在处理另一条记录，请稍后再试',429)
        try: return recognize_input()
        finally: vision_lock.release()
    def recognize_input():
        value=body();note=value.get('note','');correction=value.get('correction','');photo=value.get('photo');day=value.get('date')
        from datetime import date
        if not isinstance(day,str): raise ValueError('请选择记录日期')
        try: date.fromisoformat(day)
        except ValueError: raise ValueError('记录日期无效')
        if not isinstance(note,str) or len(note)>4000 or not isinstance(correction,str) or len(correction)>2000: raise ValueError('说明过长或格式无效')
        previous=value.get('previousDrafts',[])
        if not isinstance(previous,list) or len(previous)>6 or len(dumps_safe(previous))>30000: raise ValueError('草稿无效')
        if not photo and not note.strip() and not correction.strip(): raise ValueError('请先上传图片或写一句说明')
        image=None
        if photo:
            if not isinstance(photo,str) or not re.fullmatch(r'attachments/[a-zA-Z0-9._-]+',photo) or '..' in photo: raise ValueError('图片必须来自私人附件')
            ident=photo.split('/',1)[1]
            with repository.db.transaction() as c: row=repository.db.execute(c,'SELECT id FROM attachments WHERE id=%s AND user_id=1',(ident,)).fetchone()
            if not row: raise Missing('附件不存在')
            raw=attachment_storage.read(ident)
            if len(raw)>20*1024*1024: raise ValueError('图片超过20MB')
            image=image_data(raw)
        try:
            result=vision.recognize(note=note,image=image,day=day,correction=correction,previous=previous)
            return jsonify(ok=True,**clean_drafts(result,day,note+('\n补充更正：'+correction if correction else ''),photo))
        except RecognitionError as exc: return error(str(exc),502)

    @app.post('/api/v1/speech/transcriptions')
    def speech_transcription():
        return jsonify(ok=False,configured=False,error='语音识别 API 尚未配置；请使用文字输入'),503
    @app.post('/api/v1/attachments')
    def attachment_upload():
        file=request.files.get('file')
        if not file: raise ValueError('缺少 file')
        raw=file.read(20*1024*1024+1)
        if len(raw)>20*1024*1024: return error('附件超过 20MB',413)
        # Verify decoded format as well as magic; names and client MIME are untrusted.
        from PIL import Image
        try:
            with Image.open(io.BytesIO(raw)) as image:
                format=image.format
                if image.width*image.height>25_000_000: raise ValueError('图片像素过大')
                image.verify()
        except Exception: raise ValueError('图片内容无效')
        formats={'PNG':('png','image/png'),'JPEG':('jpg','image/jpeg'),'WEBP':('webp','image/webp')}
        if format not in formats: raise ValueError('仅允许 JPG/PNG/WebP')
        extension,mime=formats[format]; sha=hashlib.sha256(raw).hexdigest(); ident=sha+'.'+extension
        attachment_storage.put(ident,raw,mime)
        with repository.db.transaction(True) as c:
            if not repository.db.execute(c,'SELECT id FROM attachments WHERE id=%s',(ident,)).fetchone():
                from storage import now_iso
                repository.db.execute(c,'INSERT INTO attachments(id,user_id,content_type,size,created_at) VALUES(%s,1,%s,%s,%s)',(ident,mime,len(raw),now_iso()))
        return jsonify(id=ident,url='/api/v1/attachments/'+ident,photo='attachments/'+ident,path='attachments/'+ident,sha256=sha)
    @app.get('/api/v1/attachments/<ident>')
    def attachment_get(ident):
        with repository.db.transaction() as c: row=repository.db.execute(c,'SELECT content_type FROM attachments WHERE id=%s AND user_id=1',(ident,)).fetchone()
        if not row: raise Missing('附件不存在')
        if attachment_storage.backend=='oss-private': return redirect(attachment_storage.signed_url(ident),302)
        return send_from_directory(attachment_storage.directory,ident,mimetype=row['content_type'])
    @app.get('/')
    def homepage(): return send_from_directory(ROOT/'h5','index.html')
    @app.get('/h5/<path:name>')
    def h5(name): return send_from_directory(ROOT/'h5',name)
    @app.get('/assets/<path:name>')
    def assets(name): return send_from_directory(ROOT/'assets',name)
    return app
