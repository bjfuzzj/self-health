import copy
import http.client
import json
from pathlib import Path
import tempfile
import threading
import unittest
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import server
from storage import Store


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(self.tmp.name)
        self.store.initialize()
        self.httpd = server.create_server(0, self.store)
        self.addCleanup(self.httpd.server_close)
        threading.Thread(target=self.httpd.serve_forever, daemon=True).start()
        self.addCleanup(self.httpd.shutdown)
        self.port = self.httpd.server_port
        _, body = self.request("GET", "/api/ping")
        self.token = json.loads(body)["csrfToken"]

    def request(self, method, path, body=None, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        try:
            conn.request(method, path, body, headers or {})
            response = conn.getresponse()
            return response.status, response.read()
        finally:
            conn.close()

    def write_headers(self):
        return {"Origin": "http://127.0.0.1:%d" % self.port, "X-Vitals-Token": self.token,
                "Content-Type": "application/json"}

    def test_save_conflict_and_bad_schema(self):
        d = self.store.read()
        d["profile"]["name"] = "from browser"
        status, body = self.request("PUT", "/api/data", json.dumps(d), self.write_headers())
        self.assertEqual(status, 200, body)
        self.assertEqual(json.loads(body)["revision"], 1)
        self.assertEqual(self.request("PUT", "/api/data", json.dumps(d), self.write_headers())[0], 409)
        bad = {**self.store.read(), "profile": None}
        self.assertEqual(self.request("PUT", "/api/data", json.dumps(bad), self.write_headers())[0], 400)

    def test_cross_site_and_bad_host_rejected(self):
        d = json.dumps(self.store.read())
        self.assertEqual(self.request("POST", "/api/data", d, {"Origin": "https://example.invalid", "Content-Type": "text/plain"})[0], 403)
        self.assertEqual(self.request("PUT", "/api/data", d, {"Content-Type": "application/json"})[0], 403)
        self.assertEqual(self.request("GET", "/api/data", headers={"Host": "example.invalid:%s" % self.port})[0], 403)

    def test_only_public_assets_accessible(self):
        self.assertEqual(self.request("GET", "/")[0], 200)
        self.assertEqual(self.request("GET", "/assets/app.js")[0], 200)
        for path in ("/data/", "/data/health-data.json", "/data/health-data.js", "/data/backups/", "/server.py", "/CODEBUDDY.md", "/assets/../storage.py"):
            with self.subTest(path=path):
                self.assertEqual(self.request("GET", path)[0], 404)
                self.assertEqual(self.request("HEAD", path)[0], 404)
