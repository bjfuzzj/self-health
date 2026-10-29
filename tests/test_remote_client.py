import copy
import hashlib
import json
import os
from pathlib import Path
import tempfile
import subprocess
import sys
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


class RemoteClientTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.data = json.loads((ROOT / 'templates/empty-data.json').read_text())
        self.calls = []
        outer = self
        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass
            def reply(self, code, payload):
                raw = json.dumps(payload).encode()
                self.send_response(code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(raw)
            def do_GET(self):
                outer.calls.append((self.command, self.path, self.headers, None))
                if self.headers.get('Authorization') != 'Bearer test-secret':
                    return self.reply(401, {'error': 'unauthorized'})
                if self.path == '/api/v1/data': return self.reply(200, outer.data)
                if self.path == '/api/v1/redirect':
                    self.send_response(302)
                    self.send_header('Location', '/api/v1/data')
                    return self.end_headers()
                self.reply(404, {})
            def do_POST(self):
                raw = self.rfile.read(int(self.headers['Content-Length']))
                outer.calls.append((self.command, self.path, self.headers, raw))
                body = raw.split(b'\r\n\r\n', 1)[1].rsplit(b'\r\n--', 1)[0]
                digest = hashlib.sha256(body).hexdigest()
                self.reply(201, {'path':'attachments/' + digest + '.png', 'sha256':digest})
            def do_PUT(self):
                payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                outer.calls.append((self.command, self.path, self.headers, payload))
                if payload['expectedRevision'] != outer.data['meta']['revision']:
                    return self.reply(409, {'error':'conflict'})
                outer.data = copy.deepcopy(payload['data'])
                outer.data['meta']['revision'] += 1
                self.reply(200, {'data':outer.data})
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:%s' % self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.tmp.cleanup()

    def store(self, **kwargs):
        from remote_store import RemoteStore
        return RemoteStore(self.url, 'test-secret', allow_loopback_http=True,
                           directory=Path(self.tmp.name) / 'untouched', **kwargs)

    def test_remote_read_save_cas_and_no_local_snapshot(self):
        store = self.store()
        with store.lock():
            data = store.read()
            data['profile']['name'] = 'remote only'
            result = store.save(data, data['meta']['revision'])
        self.assertEqual(result['meta']['revision'], 1)
        self.assertEqual(self.data['profile']['name'], 'remote only')
        put = self.calls[-1]
        self.assertEqual(put[2]['Idempotency-Key'], put[3]['requestId'])
        self.assertFalse(store.directory.exists())
        from storage import ConflictError
        with self.assertRaises(ConflictError): store.save(data, 0)

    def test_unavailable_never_falls_back(self):
        store = self.store(timeout=.1)
        store.directory.mkdir()
        sentinel = store.directory / 'health-data.json'
        sentinel.write_text('local canonical must stay untouched')
        self.server.shutdown()
        self.server.server_close()
        from remote_store import RemoteError
        with self.assertRaises(RemoteError): store.initialize()
        self.assertEqual(sentinel.read_text(), 'local canonical must stay untouched')
        self.assertEqual(list(store.directory.iterdir()), [sentinel])

    def test_http_requires_explicit_loopback_opt_in(self):
        from remote_store import RemoteStore
        for url in (self.url, 'http://example.com', 'https://user:pass@example.com'):
            with self.assertRaises(ValueError): RemoteStore(url, 'test-secret')
        with self.assertRaises(ValueError):
            RemoteStore('http://example.com', 'test-secret', allow_loopback_http=True)

    def test_auth_and_redirect_errors_do_not_expose_secret(self):
        from remote_store import RemoteError
        store = self.store()
        store.token = 'private-wrong-token'
        with self.assertRaises(RemoteError) as caught: store.read()
        self.assertNotIn(store.token, str(caught.exception))
        with self.assertRaises(RemoteError): store._request('GET', '/redirect')

    def test_attachment_upload_is_remote_and_digest_checked(self):
        path = Path(self.tmp.name) / 'meal.png'
        path.write_bytes(b'\x89PNG\r\n\x1a\nmeal-image')
        store = self.store()
        logical, digest = store.upload_image(path)
        self.assertEqual(logical, 'attachments/' + hashlib.sha256(path.read_bytes()).hexdigest() + '.png')
        self.assertEqual(self.calls[-1][2]['Idempotency-Key'], digest)
        self.assertFalse(store.directory.exists())

    def test_cloud_wrapper_uses_existing_cli_and_never_local_json(self):
        env = {**os.environ, 'VITALS_CLOUD_CONFIG':str(Path(self.tmp.name)/'no-config.json'), 'VITALS_CLOUD_URL':self.url, 'VITALS_CLOUD_TOKEN':'test-secret',
               'VITALS_CLOUD_ALLOW_LOOPBACK_HTTP':'1',
               'VITALS_DATA_DIR':str(Path(self.tmp.name) / 'no-local-data')}
        payload = {'date':'2026-10-29', 'steps':4321}
        result = subprocess.run([sys.executable, str(ROOT / 'tools/cloud_client.py'), 'log',
                                 'record', '--kind','activity','--file','-', '--source-key','remote-message-1'],
                                input=json.dumps(payload),text=True,capture_output=True,env=env)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.data['dailyActivity'][0]['steps'],4321)
        again = subprocess.run([sys.executable, str(ROOT / 'tools/cloud_client.py'), 'log',
                                'record','--kind','activity','--file','-','--source-key','remote-message-1'],
                               input=json.dumps(payload),text=True,capture_output=True,env=env)
        self.assertTrue(json.loads(again.stdout)['duplicate'],again.stderr)
        legacy = subprocess.run([sys.executable, str(ROOT / 'tools/cloud_client.py'),'log',
                                 'body','--date','2026-10-29','--weight','70','--mode','fasting'],
                                text=True,capture_output=True,env=env)
        self.assertEqual(legacy.returncode,0,legacy.stderr)
        self.assertEqual(self.data['bodyMetrics'][0]['weightKg'],70)
        self.assertFalse(Path(env['VITALS_DATA_DIR']).exists())
        doctor = subprocess.run([sys.executable, str(ROOT / 'tools/cloud_client.py'),'doctor'],
                                text=True,capture_output=True,env=env)
        self.assertEqual(json.loads(doctor.stdout)['revision'],2)
        self.assertNotIn('test-secret',doctor.stdout + doctor.stderr)

    def test_local_desktop_server_factory_proxies_cloud_data(self):
        from server import create_server
        import urllib.request
        env = {'VITALS_CLOUD_CONFIG':str(Path(self.tmp.name)/'no-config.json'), 'VITALS_STORAGE_MODE':'cloud','VITALS_CLOUD_URL':self.url,
               'VITALS_CLOUD_TOKEN':'test-secret','VITALS_CLOUD_ALLOW_LOOPBACK_HTTP':'1',
               'VITALS_DATA_DIR':str(Path(self.tmp.name)/'no-local-desktop')}
        with patch.dict(os.environ,env):
            desktop = create_server(0)
        self.addCleanup(desktop.server_close)
        thread = threading.Thread(target=desktop.serve_forever,daemon=True)
        thread.start()
        self.addCleanup(desktop.shutdown)
        with urllib.request.urlopen('http://127.0.0.1:%s/api/data' % desktop.server_port) as response:
            self.assertEqual(json.load(response)['schemaVersion'],1)
        self.assertTrue(desktop.store.remote)
        self.assertFalse(Path(env['VITALS_DATA_DIR']).exists())

    def test_private_config_and_environment(self):
        from remote_store import load_config
        path = Path(self.tmp.name) / 'cloud.json'
        path.write_text(json.dumps({'url': self.url, 'token':'file-secret'}))
        path.chmod(0o600)
        with patch.dict(os.environ, {'VITALS_CLOUD_CONFIG': str(path)}, clear=True):
            self.assertEqual(load_config()['token'], 'file-secret')
            os.environ['VITALS_CLOUD_TOKEN'] = 'env-secret'
            self.assertEqual(load_config()['token'], 'env-secret')
        path.chmod(0o644)
        with patch.dict(os.environ, {'VITALS_CLOUD_CONFIG':str(path)}, clear=True):
            with self.assertRaises(ValueError): load_config()


if __name__ == '__main__': unittest.main()
