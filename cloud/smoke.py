"""Destructive integration checks ONLY in an explicitly named isolated *_smoke database.

HEALTH_DB_NAME=vitals_health_smoke HEALTH_SMOKE_ALLOW_RESET=1 python -m cloud.smoke
The DB user must already have access to that separate database. No production fallback.
"""
import copy
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import threading
import unittest
from concurrent.futures import ThreadPoolExecutor
from wsgiref.simple_server import make_server, WSGIRequestHandler
from . import create_app
from .repository import Conflict

class QuietHandler(WSGIRequestHandler):
    def log_message(self,*args): pass

class MySQLSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        name=os.environ.get('HEALTH_DB_NAME','')
        if not name.endswith('_smoke') or os.environ.get('HEALTH_SMOKE_ALLOW_RESET')!='1':
            raise RuntimeError('Smoke checks require dedicated HEALTH_DB_NAME ending _smoke and HEALTH_SMOKE_ALLOW_RESET=1')
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.app=create_app({'TESTING':True,'SECRET_KEY':secrets.token_hex(32),'SESSION_COOKIE_SECURE':False,'ATTACHMENT_DIR':self.tmp.name+'/attachments','OSS_ENDPOINT':None,'OSS_BUCKET':None,'OSS_ACCESS_KEY_ID':None,'OSS_ACCESS_KEY_SECRET':None})
        self.repo=self.app.extensions['health_repository']; self.db=self.repo.db
        if self.db.sqlite: raise RuntimeError('MySQL required')
        self.db.migrate()
        with self.db.transaction(True) as c:
            isolation=self.db.execute(c,"SHOW SESSION VARIABLES LIKE 'transaction_isolation'").fetchone()
            if isolation is None: isolation=self.db.execute(c,"SHOW SESSION VARIABLES LIKE 'tx_isolation'").fetchone()
            self.assertIsNotNone(isolation); self.assertEqual(isolation['Value'].upper(),'REPEATABLE-READ')
            for table in ('snapshots','receipts','changelog','records','profiles','attachments','users'):
                self.db.execute(c,'DELETE FROM '+table)
        self.password=secrets.token_urlsafe(24); self.repo.initialize('owner',self.password)
        self.token=self.repo.issue_token(); self.headers={'Authorization':'Bearer '+self.token}; self.client=self.app.test_client()
    def write(self,revision=0,key='write',steps=100):
        return self.client.post('/api/v1/records',headers=self.headers,json={'kind':'activity','payload':{'date':'2026-10-29','steps':steps},'expectedRevision':revision,'requestId':key})
    def test_transaction_concurrency_idempotency_and_restore(self):
        first=self.write(); self.assertEqual(first.status_code,200)
        self.assertEqual(self.write().json,first.json)
        self.assertEqual(self.write(0,'stale').status_code,409)
        self.assertEqual(self.write(0,'write',101).status_code,409)
        def write(index):
            try: return self.repo.mutate('concurrency',{'expectedRevision':1,'requestId':'concurrent'+str(index)},lambda data:{})['revision']
            except Conflict: return 'conflict'
        with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(write,range(2)))
        self.assertEqual(sorted(map(str,results)),['2','conflict'])
        self.repo.restore(0,2,'restore')
        self.assertEqual(self.repo.read()['dailyActivity'],[])
        self.assertEqual(self.repo.read()['meta']['revision'],3)
        self.assertEqual(len(self.repo.history()),4)
    def test_sql_failure_rolls_back_entire_write(self):
        import pymysql
        with self.db.transaction(True) as c:
            self.db.execute(c,"INSERT INTO changelog(user_id,revision,action,created_at) VALUES(1,1,'injected','now')")
        with self.assertRaises(pymysql.IntegrityError): self.write()
        self.assertEqual(self.repo.read()['meta']['revision'],0)
        self.assertEqual(self.repo.read()['dailyActivity'],[])
        with self.db.transaction() as c:
            self.assertEqual(self.db.execute(c,'SELECT COUNT(*) AS n FROM receipts').fetchone()['n'],0)
            self.assertEqual(self.db.execute(c,'SELECT COUNT(*) AS n FROM snapshots').fetchone()['n'],1)
    def test_legacy_roundtrip_cookie_csrf_and_private_attachment(self):
        snapshot=self.repo.read(); snapshot['future']={'保留':[1,2]}; snapshot['meals']=[{'date':'2026-01-01','id':'legacy','futureField':True}]
        self.repo.snapshot({'data':snapshot,'expectedRevision':0,'requestId':'import'})
        exported=self.client.get('/api/v1/export',headers=self.headers).json
        snapshot['meta']['revision']=1; snapshot['meta']['updatedAt']=exported['meta']['updatedAt']; self.assertEqual(exported,snapshot)
        self.assertEqual(self.client.get('/api/v1/data').status_code,401)
        login=self.client.post('/api/v1/auth/login',json={'username':'owner','password':self.password}); self.assertEqual(login.status_code,200)
        patch={'profile':{'name':'smoke'},'expectedRevision':1,'requestId':'profile'}
        self.assertEqual(self.client.patch('/api/v1/profile',json=patch).status_code,403)
        self.assertEqual(self.client.patch('/api/v1/profile',headers={'X-CSRF-Token':login.json['csrfToken']},json=patch).status_code,200)
        from PIL import Image
        file=io.BytesIO(); Image.new('RGB',(2,2)).save(file,format='PNG'); file.seek(0)
        uploaded=self.client.post('/api/v1/attachments',headers=self.headers,data={'file':(file,'test.png')})
        self.assertEqual(uploaded.status_code,200)
        anonymous=self.app.test_client(); self.assertEqual(anonymous.get(uploaded.json['url']).status_code,401)
        response=anonymous.get(uploaded.json['url'],headers=self.headers); self.assertEqual(response.status_code,200); response.close()
        self.assertEqual(self.client.post('/api/v1/recognize',headers=self.headers).status_code,503)
        self.repo.revoke_token(); self.assertEqual(anonymous.get('/api/v1/data',headers=self.headers).status_code,401)
    def test_actual_workbuddy_cli_and_http(self):
        from remote_store import RemoteStore
        from PIL import Image
        server=make_server('127.0.0.1',0,self.app,handler_class=QuietHandler)
        thread=threading.Thread(target=server.serve_forever,daemon=True); thread.start()
        self.addCleanup(server.server_close); self.addCleanup(server.shutdown)
        url='http://127.0.0.1:'+str(server.server_port)
        photo=Path(self.tmp.name)/'photo.jpeg'; Image.new('RGB',(2,2)).save(photo,format='JPEG')
        root=Path(__file__).resolve().parent.parent
        env={**os.environ,'VITALS_CLOUD_URL':url,'VITALS_CLOUD_TOKEN':self.token,'VITALS_CLOUD_ALLOW_LOOPBACK_HTTP':'1','VITALS_DATA_DIR':self.tmp.name+'/unused'}
        args=[sys.executable,str(root/'tools/cloud_client.py'),'log','record','--kind','meal','--file','-','--photo',str(photo),'--source-key','mysql-smoke']
        payload=json.dumps({'date':'2026-10-29','slot':'lunch','items':[{'name':'smoke rice','kcal':100}]})
        first=subprocess.run(args,input=payload,text=True,capture_output=True,env=env,timeout=30)
        self.assertEqual(first.returncode,0,'CLI failed (output withheld to avoid credentials)')
        result=json.loads(first.stdout); self.assertTrue(result['ok']); self.assertTrue(result['record']['photo'].endswith('.jpg'))
        second=subprocess.run(args,input=payload,text=True,capture_output=True,env=env,timeout=30)
        self.assertEqual(second.returncode,0); self.assertTrue(json.loads(second.stdout)['duplicate'])
        store=RemoteStore(url,self.token,directory=self.tmp.name+'/unused',allow_loopback_http=True)
        self.assertEqual(len(store.read()['meals']),1); self.assertFalse(Path(self.tmp.name+'/unused').exists())
        self.repo.revoke_token()
        from remote_store import RemoteError
        with self.assertRaises(RemoteError): store.read()

def main():
    suite=unittest.defaultTestLoader.loadTestsFromTestCase(MySQLSmoke)
    result=unittest.TextTestRunner(verbosity=2).run(suite)
    raise SystemExit(0 if result.wasSuccessful() else 1)

if __name__=='__main__': main()
