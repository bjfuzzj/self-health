import copy
import io
import json
import tempfile
import unittest
from pathlib import Path

class CloudAPI(unittest.TestCase):
    def setUp(self):
        from cloud import create_app
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app({'TESTING': True, 'SECRET_KEY':'test-secret', 'SQLITE_PATH': self.tmp.name+'/db', 'ATTACHMENT_DIR':self.tmp.name+'/attachments', 'SESSION_COOKIE_SECURE':False})
        self.repo=self.app.extensions['health_repository']; self.repo.initialize('owner','correct-password')
        self.token=self.repo.issue_token(); self.headers={'Authorization':'Bearer '+self.token}
        self.c=self.app.test_client()
    def tearDown(self): self.tmp.cleanup()
    def get(self): return self.c.get('/api/v1/data',headers=self.headers).json
    def write(self,payload,request_id='one',revision=0):
        return self.c.post('/api/v1/records',json={'kind':'activity','payload':payload,'expectedRevision':revision,'requestId':request_id},headers=self.headers)
    def test_speech_placeholder_is_private_and_never_changes_records(self):
        self.assertEqual(self.c.post('/api/v1/speech/transcriptions').status_code,401)
        before=self.get()
        status=self.c.get('/api/v1/status',headers=self.headers)
        self.assertEqual(status.json['speech'],{'configured':False,'available':False})
        result=self.c.post('/api/v1/speech/transcriptions',headers=self.headers)
        self.assertEqual(result.status_code,503)
        self.assertFalse(result.json['configured'])
        self.assertEqual(self.get(),before)
        login=self.c.post('/api/v1/auth/login',json={'username':'owner','password':'correct-password'})
        self.assertEqual(self.c.post('/api/v1/speech/transcriptions').status_code,403)
        self.assertEqual(self.c.post('/api/v1/speech/transcriptions',headers={'X-CSRF-Token':login.json['csrfToken']}).status_code,503)
    def test_auth_csrf_and_revocation(self):
        self.assertEqual(self.c.get('/api/v1/data').status_code,401)
        self.assertEqual(self.c.post('/api/v1/auth/login',json={'username':'owner','password':'wrong'}).status_code,401)
        login=self.c.post('/api/v1/auth/login',json={'username':'owner','password':'correct-password'})
        self.assertTrue(login.json['csrfToken'])
        self.assertEqual(self.c.patch('/api/v1/profile',json={'profile':{},'expectedRevision':0,'requestId':'x'}).status_code,403)
        self.repo.revoke_token()
        self.assertEqual(self.c.get('/api/v1/data',headers=self.headers).status_code,401)
    def test_idempotency_conflict_and_no_old_retry_overwrite(self):
        first=self.write({'date':'2026-10-29','steps':100}); self.assertEqual(first.status_code,200)
        self.assertEqual(self.write({'date':'2026-10-28','steps':200},'two',1).status_code,200)
        retry=self.write({'date':'2026-10-29','steps':100}); self.assertEqual(retry.json,first.json)
        self.assertEqual(self.get()['meta']['revision'],2)
        self.assertEqual(self.write({'date':'2026-10-29','steps':101}).status_code,409)
        self.assertEqual(self.write({'date':'2026-10-29','steps':101},'stale').status_code,409)
    def test_roundtrip_unknown_fields_and_snapshot_conflict(self):
        snapshot=self.get(); snapshot['future']={'nested':[1,2]}; snapshot['meals']=[{'id':'legacy','date':'2026-01-01','future':True}]
        result=self.c.put('/api/v1/data',json={'data':snapshot,'expectedRevision':0,'requestId':'snapshot'},headers=self.headers)
        self.assertEqual(result.status_code,200)
        actual=self.get(); snapshot['meta']['revision']=1; snapshot['meta']['updatedAt']=actual['meta']['updatedAt']
        self.assertEqual(actual,snapshot)
        self.assertEqual(self.c.put('/api/v1/data',json={'data':snapshot,'expectedRevision':0,'requestId':'other'},headers=self.headers).status_code,409)
    def test_failed_mutation_rollback_and_missing_nutrients(self):
        self.assertEqual(self.write({'date':'bad','steps':-1}).status_code,400)
        self.assertEqual(self.get()['meta']['revision'],0)
        result=self.c.post('/api/v1/records',json={'kind':'meal','payload':{'date':'2026-10-29','slot':'lunch','items':[{'name':'饭','kcal':100}]},'expectedRevision':0,'requestId':'meal'},headers=self.headers)
        self.assertEqual(result.status_code,200); self.assertNotIn('proteinG',result.json['record']['totals'])
    def test_attachments_private_and_model_unconfigured(self):
        self.assertEqual(self.c.post('/api/v1/recognize',headers=self.headers).status_code,503)
        bad=self.c.post('/api/v1/attachments',data={'file':(io.BytesIO(b'not png'),'a.png')},headers=self.headers)
        self.assertEqual(bad.status_code,400)
        from PIL import Image
        buf=io.BytesIO(); Image.new('RGB',(2,2)).save(buf,format='PNG'); buf.seek(0)
        uploaded=self.c.post('/api/v1/attachments',data={'file':(buf,'a.png')},headers=self.headers)
        self.assertEqual(uploaded.status_code,200)
        self.assertEqual(self.c.get(uploaded.json['url']).status_code,401)
        response=self.c.get(uploaded.json['url'],headers=self.headers); self.assertEqual(response.status_code,200); response.close()
    def test_parallel_writes_have_one_winner(self):
        from concurrent.futures import ThreadPoolExecutor
        from cloud.repository import Conflict
        def run(index):
            try:
                return self.repo.mutate('parallel',{'expectedRevision':0,'requestId':str(index)},lambda data: data['profile'].update({'name':str(index)}) or {})['revision']
            except Conflict: return 'conflict'
        with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(run,range(2)))
        self.assertEqual(sorted(map(str,results)),['1','conflict'])
        self.assertEqual(self.repo.read()['meta']['revision'],1)
    def test_database_failure_rolls_back_records_receipt_and_revision(self):
        from cloud.repository import dumps
        # Seed a conflicting changelog to force a SQL error after record persistence.
        with self.repo.db.transaction(True) as conn:
            self.repo.db.execute(conn,"INSERT INTO changelog(user_id,revision,action,created_at) VALUES(1,1,'injected','now')")
        import sqlite3
        with self.assertRaises(sqlite3.IntegrityError): self.write({'date':'2026-10-29','steps':100})
        self.assertEqual(self.get()['meta']['revision'],0); self.assertEqual(self.get()['dailyActivity'],[])
        with self.repo.db.transaction(True) as conn:
            self.assertEqual(self.repo.db.execute(conn,'SELECT COUNT(*) AS n FROM receipts').fetchone()['n'],0)
            self.repo.db.execute(conn,'DELETE FROM changelog')
        self.assertEqual(self.write({'date':'2026-10-29','steps':100}).status_code,200)
    def test_cookie_csrf_success_logout_and_snapshot_bearer_only(self):
        login=self.c.post('/api/v1/auth/login',json={'password':'correct-password'}).json
        csrf={'X-CSRF-Token':login['csrfToken']}
        profile=self.c.patch('/api/v1/profile',json={'profile':{'name':'owner'},'expectedRevision':0,'requestId':'profile'},headers=csrf)
        self.assertEqual(profile.status_code,200)
        self.assertEqual(self.c.put('/api/v1/data',json={},headers=csrf).status_code,403)
        self.assertEqual(self.c.post('/api/v1/auth/logout',headers=csrf).status_code,200)
        self.assertEqual(self.c.get('/api/v1/data').status_code,401)
    def test_legacy_unknown_record_field_survives_correction(self):
        snapshot=self.get(); snapshot['dailyActivity']=[{'id':'old','date':'2026-10-29','steps':1,'unexpected':{'hello':'world'}}]
        self.assertEqual(self.c.put('/api/v1/data',json={'data':snapshot,'expectedRevision':0,'requestId':'import'},headers=self.headers).status_code,200)
        response=self.c.patch('/api/v1/records/activity/old',json={'patch':{'steps':2},'expectedRevision':1,'requestId':'patch'},headers=self.headers)
        self.assertEqual(response.status_code,200); self.assertEqual(response.json['record']['unexpected'],{'hello':'world'})
    def test_daily_activity_add_merges_existing_fields(self):
        first=self.write({'date':'2026-10-29','steps':100}).json
        second=self.write({'date':'2026-10-29','sleepMin':400},'merge',1)
        self.assertEqual(second.status_code,200)
        rows=self.get()['dailyActivity']; self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['steps'],100); self.assertEqual(rows[0]['id'],first['record']['id'])
    def test_revision_snapshots_restore_and_keep_eighty(self):
        self.write({'date':'2026-10-29','steps':100})
        self.repo.restore(0,1,'restore-zero')
        self.assertEqual(self.repo.read()['meta']['revision'],2)
        self.assertEqual(self.repo.read()['dailyActivity'],[])
        self.assertEqual(self.repo.history()[0]['revision'],2)
        for index in range(80):
            self.repo.mutate('test',{'expectedRevision':index+2,'requestId':'history'+str(index)},lambda data:{})
        self.assertEqual(len(self.repo.history()),80)
        from cloud.repository import Missing
        with self.assertRaises(Missing): self.repo.restore(0,82,'expired-restore')
    def test_unicode_owner_and_long_record_id(self):
        with self.repo.db.transaction(True) as conn: self.repo.db.execute(conn,'UPDATE users SET username=%s WHERE id=1',('张三',))
        self.assertEqual(self.c.post('/api/v1/auth/login',json={'username':'张三','password':'correct-password'}).status_code,200)
        long_id='x'*191
        snapshot=self.get(); snapshot['dailyActivity']=[{'id':long_id,'date':'2026-10-29','steps':1}]
        self.repo.snapshot({'data':snapshot,'expectedRevision':0,'requestId':'long-import'})
        response=self.c.patch('/api/v1/records/activity/'+long_id,json={'patch':{'steps':2},'expectedRevision':1,'requestId':'long-patch'},headers=self.headers)
        self.assertEqual(response.status_code,200)
        with self.repo.db.transaction() as conn:
            action=self.repo.db.execute(conn,'SELECT action FROM changelog WHERE revision=2').fetchone()['action']
            self.assertLessEqual(len(action),64)
