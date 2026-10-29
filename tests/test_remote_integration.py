"""Real HTTP integration against the backend and TLS hostname validation."""
import io
import json
import os
from pathlib import Path
import shutil
import ssl
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
from wsgiref.simple_server import make_server, WSGIRequestHandler

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(WSGIRequestHandler):
    def log_message(self, *args): pass


class RemoteBackendIntegration(unittest.TestCase):
    def setUp(self):
        from cloud import create_app
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app({'TESTING': True, 'SECRET_KEY':'remote-integration-test',
                              'SQLITE_PATH':self.tmp.name+'/db',
                              'ATTACHMENT_DIR':self.tmp.name+'/attachments'})
        self.repo = self.app.extensions['health_repository']
        self.repo.initialize('owner','integration-password')
        self.token = self.repo.issue_token()
        self.server = make_server('127.0.0.1',0,self.app,handler_class=QuietHandler)
        self.thread = threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:%s' % self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def test_real_cli_record_photo_duplicate_conflict_and_revocation(self):
        from PIL import Image
        from remote_store import RemoteStore, RemoteError
        from storage import ConflictError
        photo = Path(self.tmp.name) / 'photo.jpeg'
        Image.new('RGB',(2,2)).save(photo,'JPEG')
        directory = Path(self.tmp.name) / 'no-local'
        env = {**os.environ,'VITALS_CLOUD_CONFIG':str(Path(self.tmp.name)/'no-config.json'),'VITALS_CLOUD_URL':self.url,'VITALS_CLOUD_TOKEN':self.token,
               'VITALS_CLOUD_ALLOW_LOOPBACK_HTTP':'1','VITALS_DATA_DIR':str(directory)}
        args = [sys.executable,str(ROOT/'tools/cloud_client.py'),'log','record','--kind','meal',
                '--file','-','--photo',str(photo),'--source-key','integration-meal']
        payload = json.dumps({'date':'2026-10-29','slot':'lunch','items':[{'name':'test rice','kcal':100}]})
        first = subprocess.run(args,input=payload,text=True,capture_output=True,env=env)
        self.assertEqual(first.returncode,0,first.stdout+first.stderr)
        result = json.loads(first.stdout)
        self.assertEqual(result['record']['totals'], {'kcal':100})
        self.assertTrue(result['record']['photo'].endswith('.jpg'))
        self.assertTrue((Path(self.tmp.name)/result['record']['photo']).is_file())
        second = subprocess.run(args,input=payload,text=True,capture_output=True,env=env)
        self.assertTrue(json.loads(second.stdout)['duplicate'],second.stderr)
        store = RemoteStore(self.url,self.token,directory=directory,allow_loopback_http=True)
        data = store.read()
        self.assertEqual(len(data['meals']),1)
        data['meta']['updatedAt'] = '2000-01-01T00:00:00+00:00'
        data['sources']['integrationSource'] = {'status':'verified'}
        saved = store.save(data,data['meta']['revision'])
        self.assertEqual(saved['sources']['integrationSource'],{'status':'verified'})
        self.assertNotEqual(saved['meta']['updatedAt'],'2000-01-01T00:00:00+00:00')
        self.assertEqual(saved,store.read())
        with self.assertRaises(ConflictError): store.save(data,0)
        self.assertFalse(directory.exists())
        self.repo.revoke_token()
        with self.assertRaises(RemoteError): store.read()

    @unittest.skipUnless(shutil.which('openssl'),'openssl required for ephemeral TLS test cert')
    def test_connect_ip_preserves_certificate_hostname_verification(self):
        from remote_store import RemoteStore, RemoteError
        from http.server import BaseHTTPRequestHandler, HTTPServer
        cert = Path(self.tmp.name)/'cert.pem'
        key = Path(self.tmp.name)/'key.pem'
        made = subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1',
                               '-keyout',str(key),'-out',str(cert),'-subj','/CN=vitals.invalid',
                               '-addext','subjectAltName=DNS:vitals.invalid'],capture_output=True)
        self.assertEqual(made.returncode,0)
        data = json.loads((ROOT/'templates/empty-data.json').read_text())
        seen = []
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args): pass
            def do_GET(self):
                seen.append(self.headers['Host'])
                self.send_response(200)
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
        server = HTTPServer(('127.0.0.1',0),Handler)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(cert,key)
        server.socket = context.wrap_socket(server.socket,server_side=True)
        thread = threading.Thread(target=server.serve_forever,daemon=True)
        thread.start()
        self.addCleanup(server.server_close)
        self.addCleanup(server.shutdown)
        url = 'https://vitals.invalid:%s' % server.server_port
        with self.assertRaises(RemoteError):
            RemoteStore(url,'test',connect_ip='127.0.0.1').read()
        with patch.dict(os.environ,{'SSL_CERT_FILE':str(cert)}):
            self.assertEqual(RemoteStore(url,'test',connect_ip='127.0.0.1').read()['schemaVersion'],1)
            wrong = 'https://wrong.invalid:%s' % server.server_port
            with self.assertRaises(RemoteError):
                RemoteStore(wrong,'test',connect_ip='127.0.0.1').read()
        self.assertEqual(seen,['vitals.invalid:%s' % server.server_port])


if __name__ == '__main__': unittest.main()
