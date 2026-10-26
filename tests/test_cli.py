import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CLITests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="健康 CLI ")
        self.addCleanup(self.tmp.cleanup)
        self.directory = Path(self.tmp.name) / "data"
        self.env = {**os.environ, "VITALS_DATA_DIR": str(self.directory)}
        self.run_cli("tools/setup.py")

    def run_cli(self, script, *args, payload=None, ok=True):
        p = subprocess.run([sys.executable, "-B", str(ROOT / script), *args],
                           env=self.env, input=json.dumps(payload, ensure_ascii=False) if payload is not None else None,
                           text=True, encoding="utf-8", capture_output=True)
        self.assertEqual(p.returncode == 0, ok, p.stdout + p.stderr)
        return p

    def test_record_duplicate_update_delete_and_photo(self):
        photo = Path(self.tmp.name) / "meal.png"
        photo.write_bytes(b"test photo fixture")
        meal = {"date": "2026-10-26", "slot": "lunch", "title": "测试午餐",
                "items": [{"name": "米饭", "kcal": 200, "proteinG": 4, "fiberG": 1}]}
        args = ("record", "--kind", "meal", "--file", "-", "--source-key", "test-meal", "--photo", str(photo))
        first = json.loads(self.run_cli("tools/log.py", *args, payload=meal).stdout)
        again = json.loads(self.run_cli("tools/log.py", *args, payload=meal).stdout)
        self.assertEqual(first["record"]["id"], again["record"]["id"])
        self.assertTrue(again["duplicate"])
        self.assertTrue((self.directory / first["record"]["photo"]).is_file())
        ident = first["record"]["id"]
        changed = json.loads(self.run_cli("tools/log.py", "update", "--kind", "meal", "--id", ident,
                                        "--file", "-", payload={"items": [{"name": "半碗饭", "kcal": 100}]}).stdout)
        self.assertEqual(changed["record"]["totals"]["kcal"], 100)
        listed = json.loads(self.run_cli("tools/log.py", "list", "--kind", "meal", "--date", "2026-10-26").stdout)
        self.assertEqual(len(listed["records"]), 1)
        self.run_cli("tools/log.py", "delete", "--kind", "meal", "--id", ident)
        self.assertEqual(json.loads(self.run_cli("tools/log.py", "list", "--kind", "meal").stdout)["records"], [])

    def test_screenshot_hash_deduplicates_and_body_modes_preserved(self):
        photo = Path(self.tmp.name) / "scale.png"
        photo.write_bytes(b"scale screenshot fixture")
        rec = {"date": "2026-10-26", "measureMode": "fasting", "weightKg": 70}
        args = ("record", "--kind", "body", "--file", "-", "--photo", str(photo))
        a = json.loads(self.run_cli("tools/log.py", *args, payload=rec).stdout)
        b = json.loads(self.run_cli("tools/log.py", *args, payload=rec).stdout)
        self.assertEqual(a["record"]["id"], b["record"]["id"])
        self.run_cli("tools/log.py", "body", "--date", "2026-10-26", "--time", "22:00", "--weight", "71", "--mode", "bedtime")
        listed = json.loads(self.run_cli("tools/log.py", "list", "--kind", "body").stdout)
        self.assertEqual(len(listed["records"]), 2)

    def test_invalid_record_and_unknown_patch_are_rejected(self):
        self.run_cli("tools/log.py", "record", "--kind", "body", "--file", "-",
                     payload={"date": "2026-10-26", "weightKg": -3, "measureMode": "fasting"}, ok=False)
        self.run_cli("tools/log.py", "record", "--kind", "body", "--file", "-",
                     payload={"date": "2026-10-26", "weightKg": 70}, ok=False)

    def test_setup_doctor_and_legacy_commands(self):
        self.run_cli("tools/log.py", "profile", "--sex", "female", "--height", "160", "--birth", "1960-01-01")
        self.run_cli("tools/log.py", "meal", "--date", "2026-10-26", "--slot", "breakfast", "--item", "鸡蛋|50|70|6|5|0|0")
        self.run_cli("tools/log.py", "show", "--date", "2026-10-26")
        doctor = json.loads(self.run_cli("tools/setup.py", "--doctor").stdout)
        self.assertTrue(doctor["ok"])
        before = (self.directory / "health-data.json").read_bytes()
        self.run_cli("tools/setup.py")
        self.assertEqual((self.directory / "health-data.json").read_bytes(), before)

    def test_old_message_retry_does_not_undo_newer_daily_update(self):
        args = ("record", "--kind", "body", "--file", "-")
        first = {"date": "2026-10-26", "measureMode": "fasting", "weightKg": 70}
        newer = {**first, "weightKg": 69.9}
        self.run_cli("tools/log.py", *args, "--source-key", "message-a", payload=first)
        self.run_cli("tools/log.py", *args, "--source-key", "message-b", payload=newer)
        retried = json.loads(self.run_cli("tools/log.py", *args, "--source-key", "message-a", payload=first).stdout)
        self.assertTrue(retried["duplicate"])
        self.assertEqual(retried["record"]["weightKg"], 69.9)

    def test_retry_after_delete_does_not_recreate_record(self):
        args = ("record", "--kind", "workout", "--file", "-", "--source-key", "walk-message")
        payload = {"date": "2026-10-26", "type": "walking", "durationMin": 30}
        a = json.loads(self.run_cli("tools/log.py", *args, payload=payload).stdout)
        self.run_cli("tools/log.py", "delete", "--kind", "workout", "--id", a["record"]["id"])
        b = json.loads(self.run_cli("tools/log.py", *args, payload=payload).stdout)
        self.assertTrue(b["duplicate"])
        self.assertTrue(b["deleted"])

    def test_legacy_activity_can_be_corrected_by_id(self):
        self.run_cli("tools/log.py", "activity", "--date", "2026-10-26", "--steps", "3000")
        listed = json.loads(self.run_cli("tools/log.py", "list", "--kind", "activity").stdout)
        self.assertTrue(listed["records"][0].get("id"))
        ident = listed["records"][0]["id"]
        self.run_cli("tools/log.py", "update", "--kind", "activity", "--id", ident, "--file", "-", payload={"steps": 4000})
        self.run_cli("tools/log.py", "delete", "--kind", "activity", "--id", ident)

    def test_legacy_workout_needs_actual_duration_and_does_not_invent_weight(self):
        self.run_cli("tools/log.py", "workout", "--type", "walking", ok=False)
        self.run_cli("tools/log.py", "workout", "--type", "walking", "--minutes", "30")
        listed = json.loads(self.run_cli("tools/log.py", "list", "--kind", "workout").stdout)
        self.assertIsNone(listed["records"][0].get("kcal"))

    def test_legacy_body_upsert_preserves_id_and_receipt(self):
        payload = {"date": "2026-10-26", "measureMode": "fasting", "weightKg": 70, "source": "manual"}
        args = ("record", "--kind", "body", "--file", "-", "--source-key", "body-original")
        first = json.loads(self.run_cli("tools/log.py", *args, payload=payload).stdout)
        self.run_cli("tools/log.py", "body", "--date", "2026-10-26", "--time", "07:30", "--mode", "fasting", "--weight", "69.9")
        retried = json.loads(self.run_cli("tools/log.py", *args, payload=payload).stdout)
        self.assertFalse(retried.get("deleted", False))
        self.assertEqual(retried["record"]["id"], first["record"]["id"])
        self.assertEqual(retried["record"]["weightKg"], 69.9)
