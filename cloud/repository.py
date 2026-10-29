import copy
import hashlib
import json
import secrets
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash
from records import KINDS, NUTRIENTS, normalize
from storage import validate, now_iso

class Conflict(ValueError): pass
class Missing(ValueError): pass

def dumps(value): return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False)
def digest(value): return hashlib.sha256(value.encode()).hexdigest()

class Repository:
    def __init__(self,db): self.db=db
    def initialize(self,username,password):
        if not password or len(password)<12: raise ValueError('密码至少 12 字符')
        self.db.migrate()
        empty=json.loads((Path(__file__).resolve().parent.parent/'templates/empty-data.json').read_text())
        with self.db.transaction(True) as c:
            if self.db.execute(c,'SELECT id FROM users WHERE id=1').fetchone(): raise ValueError('已初始化，不能覆盖用户')
            self.db.execute(c,'INSERT INTO users(id,username,password_hash) VALUES(1,%s,%s)',(username,generate_password_hash(password,method='pbkdf2:sha256:1000000')))
            self.db.execute(c,'INSERT INTO profiles(user_id,revision,document) VALUES(1,0,%s)',(dumps(empty),))
            self.db.execute(c,'INSERT INTO snapshots(user_id,revision,document,created_at) VALUES(1,0,%s,%s)',(dumps(empty),now_iso()))
    def user(self):
        with self.db.transaction() as c: return self.db.execute(c,'SELECT * FROM users WHERE id=1').fetchone()
    def authenticate(self,username,password):
        user=self.user()
        return user if user and secrets.compare_digest(user['username'].encode('utf-8'),username.encode('utf-8')) and check_password_hash(user['password_hash'],password) else None
    def issue_token(self):
        token=secrets.token_urlsafe(40)
        with self.db.transaction(True) as c: self.db.execute(c,'UPDATE users SET token_hash=%s WHERE id=1',(digest(token),))
        return token
    def revoke_token(self):
        with self.db.transaction(True) as c: self.db.execute(c,'UPDATE users SET token_hash=NULL WHERE id=1')
    def set_password(self,password):
        if len(password)<12: raise ValueError('密码至少 12 字符')
        with self.db.transaction(True) as c: self.db.execute(c,'UPDATE users SET password_hash=%s,auth_version=auth_version+1 WHERE id=1',(generate_password_hash(password,method='pbkdf2:sha256:1000000'),))
    def read(self):
        with self.db.transaction() as c: return self._read(c)[0]
    def _read(self,c,lock=False):
        sql='SELECT revision,document FROM profiles WHERE user_id=1'+(' FOR UPDATE' if lock and not self.db.sqlite else '')
        row=self.db.execute(c,sql).fetchone()
        if not row: raise ValueError('数据库未初始化')
        data=json.loads(row['document'])
        # Stored envelope retains collection presence/order and every unknown field.
        for kind,key in KINDS.items():
            data[key]=[json.loads(r['payload']) for r in self.db.execute(c,'SELECT payload FROM records WHERE user_id=1 AND kind=%s ORDER BY position',(kind,)).fetchall()]
        data['meta']['revision']=row['revision']
        return data,row['revision']
    def mutate(self,action,body,callback):
        request_id=body.get('requestId'); expected=body.get('expectedRevision')
        if not isinstance(request_id,str) or not 1<=len(request_id)<=128: raise ValueError('requestId 必须为 1-128 字符')
        if type(expected) is not int or expected<0: raise ValueError('expectedRevision 必须为非负整数')
        fingerprint=digest(dumps({'action':action,'body':body}))
        with self.db.transaction(True) as c:
            data,revision=self._read(c,True)
            receipt=self.db.execute(c,'SELECT fingerprint,response FROM receipts WHERE user_id=1 AND request_id=%s',(request_id,)).fetchone()
            if receipt:
                if receipt['fingerprint']!=fingerprint: raise Conflict('requestId 已用于其他请求')
                return json.loads(receipt['response'])
            if revision!=expected: raise Conflict('版本已变化，请刷新后重试')
            # Upgrade old databases lazily without losing the pre-change recovery point.
            if not self.db.execute(c,'SELECT revision FROM snapshots WHERE user_id=1 AND revision=%s',(revision,)).fetchone():
                self.db.execute(c,'INSERT INTO snapshots(user_id,revision,document,created_at) VALUES(1,%s,%s,%s)',(revision,dumps(data),now_iso()))
            result=callback(data)
            validate(data); data['meta'].update(revision=revision+1,updatedAt=now_iso())
            self._persist(c,data)
            self.db.execute(c,'INSERT INTO snapshots(user_id,revision,document,created_at) VALUES(1,%s,%s,%s)',(revision+1,dumps(data),now_iso()))
            self.db.execute(c,'DELETE FROM snapshots WHERE user_id=1 AND revision<%s',(max(0,revision+2-80),))
            response={'ok':True,'revision':revision+1,**result}
            self.db.execute(c,'INSERT INTO receipts(user_id,request_id,fingerprint,response) VALUES(1,%s,%s,%s)',(request_id,fingerprint,dumps(response)))
            self.db.execute(c,'INSERT INTO changelog(user_id,revision,action,created_at) VALUES(1,%s,%s,%s)',(revision+1,action if len(action)<=64 else action.split(':',1)[0]+':'+digest(action)[:48],now_iso()))
            return response
    def _persist(self,c,data):
        envelope=copy.deepcopy(data)
        self.db.execute(c,'DELETE FROM records WHERE user_id=1')
        for kind,key in KINDS.items():
            for position,record in enumerate(data[key]):
                # Missing legacy IDs remain missing in export, surrogate keys exist only in SQL.
                ident=record.get('id') or '__legacy_'+str(position)
                if len(ident)>191: raise ValueError('记录 id 过长')
                self.db.execute(c,'INSERT INTO records(user_id,kind,record_id,position,payload) VALUES(1,%s,%s,%s,%s)',(kind,ident,position,dumps(record)))
            envelope[key]=[]
        self.db.execute(c,'UPDATE profiles SET revision=%s,document=%s WHERE user_id=1',(data['meta']['revision'],dumps(envelope)))
    def history(self):
        with self.db.transaction() as c:
            return [dict(row) for row in self.db.execute(c,'SELECT revision,created_at FROM snapshots WHERE user_id=1 ORDER BY revision DESC').fetchall()]
    def restore(self,target_revision,expected_revision,request_id):
        body={'targetRevision':target_revision,'expectedRevision':expected_revision,'requestId':request_id}
        # Snapshot lookup occurs under the same lock as restoration, including retention.
        def replace(data):
            with self.db.transaction() as c:
                row=self.db.execute(c,'SELECT document FROM snapshots WHERE user_id=1 AND revision=%s',(target_revision,)).fetchone()
            if row is None: raise Missing('备份版本不存在或已过保留期')
            replacement=json.loads(row['document']); data.clear(); data.update(replacement)
            return {'data':data,'restoredFrom':target_revision}
        return self.mutate('restore',body,replace)
    def snapshot(self,body):
        replacement=copy.deepcopy(body.get('data')); validate(replacement)
        def replace(data): data.clear(); data.update(replacement); return {'data':data}
        return self.mutate('snapshot',body,replace)
    def record(self,kind,payload,original=None):
        if kind not in KINDS: raise ValueError('未知 kind')
        # Existing legacy unknown fields survive corrections. New unknown fields are rejected.
        original=original or {}; known=copy.deepcopy(payload)
        extras={}
        while True:
            try: result=normalize(kind,known); break
            except ValueError as exc:
                if not str(exc).startswith('未知字段：'): raise
                unknown=str(exc).split('：',1)[1].split(', ')
                if any(k not in original for k in unknown): raise
                for k in unknown: extras[k]=known.pop(k)
        result.update(extras)
        if kind=='meal':
            result['totals']={k:round(sum(i[k] for i in result['items']),1) for k in NUTRIENTS if all(k in i and i[k] is not None for i in result['items'])}
        return result
