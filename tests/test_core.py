import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class StorageTests(unittest.TestCase):
    def setUp(self):
        from storage import Store
        self.tmp = tempfile.TemporaryDirectory(prefix="健康 test ")
        self.addCleanup(self.tmp.cleanup)
        self.store = Store(Path(self.tmp.name) / "data")
        self.store.initialize()

    def test_blank_and_reinstall_preserves_data(self):
        d = self.store.read()
        self.assertFalse(d["profile"].get("sex"))
        self.assertEqual(d["profile"]["goal"]["type"], "record_only")
        d["profile"]["name"] = "测试用户"
        saved = self.store.save(d, d["meta"]["revision"])
        self.store.initialize()
        self.assertEqual(self.store.read(), saved)

    def test_invalid_schema_and_numbers_rejected_without_writing(self):
        d = self.store.read()
        for bad in [{"profile": None}, {**d, "meals": "wrong"},
                    {**d, "bodyMetrics": [{"date": "2026-10-26", "weightKg": -2}]},
                    {**d, "dailyActivity": [{"date": "2026-02-30"}]},
                    {**d, "profile": {"heightCm": float("nan")}}]:
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.store.save(bad, d["meta"]["revision"])
        self.assertEqual(self.store.read(), d)

    def test_stale_revision_rejected(self):
        from storage import ConflictError
        a = self.store.read()
        b = copy.deepcopy(a)
        a["profile"]["name"] = "new"
        self.store.save(a, a["meta"]["revision"])
        with self.assertRaises(ConflictError):
            self.store.save(b, b["meta"]["revision"])
        self.assertEqual(self.store.read()["profile"]["name"], "new")

    def test_backup_retention_and_proxy(self):
        self.store.max_backups = 3
        for i in range(5):
            d = self.store.read()
            d["profile"]["name"] = str(i)
            self.store.save(d, d["meta"]["revision"])
        self.assertEqual(len(list((self.store.directory / "backups").glob("*.json"))), 3)
        js = (self.store.directory / "health-data.js").read_text(encoding="utf-8")
        self.assertEqual(json.loads(js.split("=", 1)[1].strip().removesuffix(";")), self.store.read())

    def test_concurrent_process_updates_not_lost(self):
        code = """from storage import Store
import sys,time
s=Store(sys.argv[1])
for _ in range(8):
 with s.lock():
  d=s.read();time.sleep(.002)
  d['meta']['counter']=d['meta'].get('counter',0)+1
  s.save(d,d['meta']['revision'])
"""
        processes = [subprocess.Popen([sys.executable, "-B", "-c", code, str(self.store.directory)], cwd=ROOT)
                     for _ in range(3)]
        for p in processes:
            self.assertEqual(p.wait(timeout=30), 0)
        self.assertEqual(self.store.read()["meta"]["counter"], 24)


if __name__ == "__main__":
    unittest.main()
