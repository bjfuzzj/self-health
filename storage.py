"""本地数据的唯一持久化入口。仅使用 Python 标准库。"""
from contextlib import contextmanager
import copy
from datetime import date, datetime
import json
import math
import os
from pathlib import Path
import shutil
import tempfile
import threading
import time
import uuid

ROOT = Path(__file__).resolve().parent
COLLECTIONS = ("bodyMetrics", "dailyActivity", "meals", "workouts", "supplements", "journal", "imports")
_THREAD_LOCK = threading.RLock()


class ConflictError(ValueError):
    pass


def now_iso():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def validate(data):
    if not isinstance(data, dict) or not isinstance(data.get("profile"), dict):
        raise ValueError("profile 必须是对象")
    if data.get("schemaVersion") != 1:
        raise ValueError("不支持的数据版本；需要 schemaVersion=1")
    if not isinstance(data.get("meta"), dict) or not isinstance(data.get("sources"), dict):
        raise ValueError("meta/sources 必须是对象")
    revision = data["meta"].get("revision")
    if type(revision) is not int or revision < 0:
        raise ValueError("revision 必须是非负整数")
    if not isinstance(data["meta"].get("receipts", {}), dict) or any(not isinstance(v, str) for v in data["meta"].get("receipts", {}).values()):
        raise ValueError("meta.receipts 必须是记录 ID 映射")
    if data["profile"].get("sex") not in (None, "", "male", "female"):
        raise ValueError("sex 应为 male/female 或留空")
    for key in ("goal", "targets"):
        if not isinstance(data["profile"].get(key, {}), dict):
            raise ValueError("profile.%s 必须是对象" % key)
    for key in COLLECTIONS:
        if not isinstance(data.get(key), list) or any(not isinstance(r, dict) for r in data[key]):
            raise ValueError("%s 必须是对象数组" % key)
    numeric = {"bmi", "weightKg", "heightCm", "age", "bodyFatPct", "muscleKg", "waterPct", "visceralFat",
               "bmrKcal", "boneKg", "proteinPct", "bodyAge", "steps", "sleepMin", "restingHr", "hrvMs",
               "totalKcal", "activeKcal", "distanceKm", "durationMin", "kcal", "proteinG", "fatG", "carbG",
               "fiberG", "avgHr", "spo2", "weeklyRateKg", "proteinPerKg", "activityFactor", "targetWeightKg",
               "targetBodyFatPct", "hrAvg", "hrMax", "deepSleepMin", "remSleepMin", "lightSleepMin",
               "awakeMin", "sleepScore", "standHours", "waterMl"}

    def walk(obj):
        if isinstance(obj, dict):
            for key, value in obj.items():
                if key in numeric and value is not None:
                    if type(value) not in (int, float) or not math.isfinite(value) or value < 0:
                        raise ValueError("%s 必须是非负有限数字" % key)
                    if key in ("heightCm", "weightKg") and value == 0:
                        raise ValueError("%s 必须大于零" % key)
                    if key in ("bodyFatPct", "waterPct", "proteinPct", "spo2", "targetBodyFatPct") and value > 100:
                        raise ValueError("%s 不能超过 100" % key)
                if key in ("date", "birthDate") and value:
                    try:
                        date.fromisoformat(value)
                    except (TypeError, ValueError):
                        raise ValueError("%s 日期无效" % key)
                if key == "ts" and value:
                    try:
                        datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except (AttributeError, TypeError, ValueError):
                        raise ValueError("ts 时间无效")
                if key == "photo" and value:
                    if not isinstance(value, str) or not value.startswith("attachments/") or ".." in value or "\\" in value:
                        raise ValueError("photo 必须指向本地 attachments 文件")
                if key == "measureMode" and value not in ("fasting", "bedtime"):
                    raise ValueError("measureMode 应为 fasting 或 bedtime")
                if key in ("items",) and (not isinstance(value, list) or any(not isinstance(x, dict) for x in value)):
                    raise ValueError("items 必须是对象数组")
                if key in ("totals", "nutrients") and not isinstance(value, dict):
                    raise ValueError("%s 必须是对象" % key)
                if key in ("id", "sourceKey", "name", "title", "note", "source", "ts", "photo") and value is not None and not isinstance(value, str):
                    raise ValueError("%s 必须是文本" % key)
                walk(value)
        elif isinstance(obj, list):
            for item in obj:
                walk(item)
        elif isinstance(obj, float) and not math.isfinite(obj):
            raise ValueError("不接受 NaN 或 Infinity")
    walk(data)
    for collection in COLLECTIONS[:5]:
        ids = set()
        for record in data[collection]:
            if not record.get("date"):
                raise ValueError("%s 缺少 date" % collection)
            ident = record.get("id")
            if ident and ident in ids:
                raise ValueError("%s 存在重复 id" % collection)
            ids.add(ident)
    for collection, key in (("bodyMetrics", lambda r: (r["date"], r.get("source"), r.get("measureMode", "fasting"))),
                            ("dailyActivity", lambda r: r["date"])):
        identities = [key(r) for r in data[collection]]
        if len(identities) != len(set(identities)):
            raise ValueError("%s 同一日期/来源/时段存在重复记录，请先核对" % collection)
    return data


class Store:
    max_backups = 80

    def __init__(self, directory=None):
        self.directory = Path(directory or os.environ.get("VITALS_DATA_DIR") or ROOT / "data").resolve()
        self.path = self.directory / "health-data.json"
        self._local = threading.local()

    @contextmanager
    def lock(self):
        """Windows 字节锁 / POSIX flock；同一实例可重入，进程异常退出自动释放。"""
        with _THREAD_LOCK:
            if getattr(self._local, "depth", 0):
                self._local.depth += 1
                try:
                    yield
                finally:
                    self._local.depth -= 1
                return
            self.directory.mkdir(parents=True, exist_ok=True)
            with (self.directory / ".write.lock").open("a+b") as handle:
                handle.seek(0, 2)
                if handle.tell() == 0:
                    handle.write(b"0")
                    handle.flush()
                deadline = time.monotonic() + 15
                while True:
                    try:
                        handle.seek(0)
                        if os.name == "nt":
                            import msvcrt
                            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                        else:
                            import fcntl
                            fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                        break
                    except OSError:
                        if time.monotonic() > deadline:
                            raise TimeoutError("数据正在被其他进程使用，请稍后重试")
                        time.sleep(.05)
                self._local.depth = 1
                try:
                    yield
                finally:
                    self._local.depth = 0
                    handle.seek(0)
                    if os.name == "nt":
                        import msvcrt
                        msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        import fcntl
                        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def _atomic(self, path, text):
        fd, temporary = tempfile.mkstemp(prefix=".vitals-", suffix=".tmp", dir=path.parent)
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
                handle.write(text)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)

    def sync_proxy(self, data):
        raw = json.dumps(data, ensure_ascii=False, allow_nan=False, indent=2)
        self._atomic(self.directory / "health-data.js", "window.__HEALTH_DATA__ = " + raw.replace("\u2028", "\\u2028").replace("\u2029", "\\u2029") + ";\n")

    def initialize(self):
        with self.lock():
            if self.path.exists():
                data = self.read()
            else:
                data = json.loads((ROOT / "templates/empty-data.json").read_text(encoding="utf-8"))
                data["meta"].update(createdAt=now_iso(), updatedAt=now_iso(), timezone=str(datetime.now().astimezone().tzinfo))
                self._atomic(self.path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")
            self.sync_proxy(data)
            return data

    def read(self):
        return validate(json.loads(self.path.read_text(encoding="utf-8")))

    def save(self, data, expected_revision):
        validate(data)
        with self.lock():
            current = self.read()
            if type(expected_revision) is not int or current["meta"]["revision"] != expected_revision:
                raise ConflictError("记录已被其他窗口或命令行更新；请先导出未保存内容，再刷新重试")
            result = copy.deepcopy(data)
            result["meta"].update(revision=expected_revision + 1, updatedAt=now_iso())
            raw = json.dumps(result, ensure_ascii=False, allow_nan=False, indent=2) + "\n"
            backups = self.directory / "backups"
            backups.mkdir(exist_ok=True)
            name = datetime.now().strftime("health-data-%Y%m%d-%H%M%S-%f-") + uuid.uuid4().hex[:6] + ".json"
            shutil.copy2(self.path, backups / name)
            self._atomic(self.path, raw)
            # JSON 是事实源；代理失败不应让调用者误以为主文件没有保存。
            try:
                self.sync_proxy(result)
            except OSError as exc:
                import warnings
                warnings.warn("主记录已保存，只读副本更新失败：%s" % exc)
            files = sorted(backups.glob("*.json"), key=lambda p: (p.stat().st_mtime_ns, p.name))
            for old in files[:-self.max_backups]:
                old.unlink()
            return result


def create_store(directory=None):
    """Explicit cloud mode has no automatic local fallback."""
    mode = os.environ.get('VITALS_STORAGE_MODE', 'local')
    if mode == 'cloud':
        from remote_store import RemoteStore
        return RemoteStore(directory=directory,
                           allow_loopback_http=os.environ.get('VITALS_CLOUD_ALLOW_LOOPBACK_HTTP') == '1')
    if mode != 'local':
        raise ValueError('VITALS_STORAGE_MODE 应为 local/cloud')
    return Store(directory)
