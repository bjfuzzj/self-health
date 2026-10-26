import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]


class PackageTests(unittest.TestCase):
    def test_archive_excludes_private_data_and_initializes_after_extraction(self):
        with tempfile.TemporaryDirectory(prefix="分发包 test ") as temporary:
            target = Path(temporary) / "vitals.zip"
            p = subprocess.run([sys.executable, "-B", str(ROOT / "tools/package_release.py"), "--output", str(target)], capture_output=True, text=True)
            self.assertEqual(p.returncode, 0, p.stderr)
            with zipfile.ZipFile(target) as archive:
                names = archive.namelist()
                self.assertIn("self-health/.codebuddy/skills/health-record/SKILL.md", names)
                self.assertIn("self-health/启动.bat", names)
                self.assertFalse(any(n.startswith(("self-health/data/", "self-health/.workbuddy/", "self-health/.git/")) for n in names))
                self.assertFalse(any("__pycache__" in n or n.endswith(".pyc") for n in names))
                archive.extractall(Path(temporary) / "中文 空格")
            unpacked = Path(temporary) / "中文 空格/self-health"
            env = {k: v for k, v in os.environ.items() if k != "VITALS_DATA_DIR"}
            p = subprocess.run([sys.executable, "-B", "tools/setup.py"], cwd=unpacked, env=env, capture_output=True, text=True, encoding="utf-8")
            self.assertEqual(p.returncode, 0, p.stdout + p.stderr)
            d = json.loads((unpacked / "data/health-data.json").read_text(encoding="utf-8"))
            self.assertEqual(d["meals"], [])
            self.assertEqual(d["profile"]["goal"]["type"], "record_only")
