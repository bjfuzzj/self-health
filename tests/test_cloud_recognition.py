import io
import json
import tempfile
import unittest
from unittest.mock import Mock
from PIL import Image
from cloud import create_app

class RecognitionAPI(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.provider=Mock(); self.provider.configured=True
        self.app=create_app({'TESTING':True,'SECRET_KEY':'test','SQLITE_PATH':self.tmp.name+'/db','ATTACHMENT_DIR':self.tmp.name+'/files','VISION_PROVIDER':self.provider})
        self.repo=self.app.extensions['health_repository'];self.repo.initialize('owner','correct-password')
        self.headers={'Authorization':'Bearer '+self.repo.issue_token()};self.c=self.app.test_client()
    def tearDown(self):self.tmp.cleanup()
    def test_recognition_drafts_do_not_write_and_ignore_injected_ids(self):
        self.provider.recognize.return_value={'drafts':[{'kind':'meal','payload':{'id':'injected','source':'admin','slot':'lunch','items':[{'name':'米饭','kcal':100}],'confidence':'measured'}}]}
        before=self.repo.read();r=self.c.post('/api/v1/recognize',headers=self.headers,json={'note':'午饭米饭半碗','date':'2026-10-29'})
        self.assertEqual(r.status_code,200);p=r.json['drafts'][0]['payload']
        self.assertNotIn('id',p);self.assertEqual(p['source'],'h5-ai');self.assertEqual(p['confidence'],'estimated');self.assertEqual(p['date'],'2026-10-29');self.assertEqual(self.repo.read(),before)
    def test_missing_fields_ask_instead_of_inventing(self):
        self.provider.recognize.return_value={'drafts':[{'kind':'body','payload':{'weightKg':73.5}}]}
        r=self.c.post('/api/v1/recognize',headers=self.headers,json={'note':'体重截图','date':'2026-10-29'})
        self.assertEqual(r.status_code,200);p=r.json['drafts'][0]
        self.assertNotIn('measureMode',p['payload']);self.assertTrue(p['questions']);self.assertNotIn('bodyFatPct',p['payload'])
    def test_invalid_numbers_fail_and_never_write(self):
        for value in [-1,float('nan'),'not number']:
            self.provider.recognize.return_value={'drafts':[{'kind':'meal','payload':{'slot':'lunch','items':[{'name':'米饭','kcal':value}]}}]}
            r=self.c.post('/api/v1/recognize',headers=self.headers,json={'note':'饭','date':'2026-10-29'})
            self.assertEqual(r.status_code,502)
        self.assertEqual(self.repo.read()['meta']['revision'],0)
    def test_private_attachment_only_and_image_is_reencoded(self):
        image=io.BytesIO();Image.new('RGB',(10,10)).save(image,format='PNG');image.seek(0)
        photo=self.c.post('/api/v1/attachments',headers=self.headers,data={'file':(image,'a.png')}).json['photo']
        self.provider.recognize.return_value={'drafts':[],'message':'没有发现健康记录'}
        r=self.c.post('/api/v1/recognize',headers=self.headers,json={'photo':photo,'date':'2026-10-29'})
        self.assertEqual(r.status_code,200);args=self.provider.recognize.call_args.kwargs
        self.assertTrue(args['image'].startswith('data:image/jpeg;base64,'))
        for bad in ['https://evil.invalid/x','attachments/../x','attachments/missing.png']:
            self.assertIn(self.c.post('/api/v1/recognize',headers=self.headers,json={'photo':bad,'date':'2026-10-29'}).status_code,(400,404))
    def test_batch_atomic_retry_and_conflict(self):
        drafts=[{'kind':'meal','payload':{'date':'2026-10-29','slot':'lunch','items':[{'name':'米饭','kcal':100}]}},{'kind':'workout','payload':{'date':'2026-10-29','type':'walk','durationMin':30}}]
        body={'drafts':drafts,'expectedRevision':0,'requestId':'batch-one'}
        r=self.c.post('/api/v1/records/batch',headers=self.headers,json=body);self.assertEqual(r.status_code,200);self.assertEqual(len(r.json['records']),2)
        self.assertEqual(self.c.post('/api/v1/records/batch',headers=self.headers,json=body).json,r.json)
        body['requestId']='batch-stale';self.assertEqual(self.c.post('/api/v1/records/batch',headers=self.headers,json=body).status_code,409)
        body['expectedRevision']=1;body['drafts'][1]['payload']['durationMin']=-2
        self.assertEqual(self.c.post('/api/v1/records/batch',headers=self.headers,json=body).status_code,400)
        data=self.repo.read();self.assertEqual(data['meta']['revision'],1);self.assertEqual(len(data['meals']),1)
    def test_batch_does_not_overwrite_previous_activity_fields(self):
        def batch(payload,revision,rid):return self.c.post('/api/v1/records/batch',headers=self.headers,json={'drafts':[{'kind':'activity','payload':{'date':'2026-10-29',**payload}}],'expectedRevision':revision,'requestId':rid})
        self.assertEqual(batch({'steps':5000,'sleepMin':420},0,'a').status_code,200)
        self.assertEqual(batch({'steps':6000},1,'b').status_code,200)
        data=self.repo.read();self.assertEqual(len(data['dailyActivity']),1);self.assertEqual(data['dailyActivity'][0]['sleepMin'],420)

class VisionTransport(unittest.TestCase):
    def test_https_contract_and_sanitized_failures(self):
        from cloud.recognition import VisionProvider,RecognitionError
        from unittest.mock import patch
        config={'MODEL_BASE_URL':'https://example.invalid/v1','MODEL_API_KEY':'secret-test-only','MODEL_NAME':'vision-test'}
        provider=VisionProvider(config);response=Mock();response.read.return_value=json.dumps({'choices':[{'finish_reason':'stop','message':{'content':'{"drafts":[]}'}}]}).encode()
        opener=Mock();opener.open.return_value.__enter__=Mock(return_value=response);opener.open.return_value.__exit__=Mock(return_value=False)
        with patch('cloud.recognition.urllib.request.build_opener',return_value=opener):
            self.assertEqual(provider.recognize(note='饭',image='data:image/jpeg;base64,eA==',day='2026-10-29',correction='',previous=[]),{'drafts':[]})
            req=opener.open.call_args.args[0];body=json.loads(req.data)
            self.assertEqual(req.full_url,'https://example.invalid/v1/chat/completions');self.assertEqual(body['messages'][1]['content'][1]['type'],'image_url')
            opener.open.side_effect=OSError('internal secret-test-only connection detail')
            with self.assertRaises(RecognitionError) as caught:provider.recognize(note='饭',image=None,day='2026-10-29',correction='',previous=[])
            self.assertNotIn('secret-test-only',str(caught.exception))
        with self.assertRaises(ValueError):VisionProvider({**config,'MODEL_BASE_URL':'http://example.invalid/v1'})
    def test_nonfinite_and_percent_overflow_rejected(self):
        from cloud.recognition import clean_drafts,RecognitionError
        for p in [{'weightKg':0},{'weightKg':70,'bodyFatPct':120},{'weightKg':70,'bodyFatPct':float('inf')}]:
            with self.assertRaises(RecognitionError):clean_drafts({'drafts':[{'kind':'body','payload':p}]},'2026-10-29','')
