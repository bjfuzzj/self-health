"""对话记录的结构化录入、幂等、附件与纠错。"""
import copy
from datetime import datetime
import hashlib
import json
import math
from pathlib import Path
import uuid

from storage import now_iso

KINDS = {"body": "bodyMetrics", "activity": "dailyActivity", "meal": "meals", "workout": "workouts", "supp": "supplements"}
NUTRIENTS = ("kcal", "proteinG", "fatG", "carbG", "fiberG")


def normalize(kind, record):
    r = copy.deepcopy(record)
    if not isinstance(r, dict) or not r.get("date"):
        raise ValueError("记录需要 date（YYYY-MM-DD），不能猜测截图日期")
    allowed = {
        "body": {"measureMode", "weightKg", "bmi", "bodyFatPct", "muscleKg", "waterPct", "visceralFat", "bmrKcal", "boneKg", "proteinPct", "bodyAge"},
        "activity": {"steps", "distanceKm", "activeKcal", "totalKcal", "sleepMin", "restingHr", "hrvMs", "spo2", "sleepScore", "hrAvg", "hrMax", "deepSleepMin", "remSleepMin", "lightSleepMin", "awakeMin", "standHours"},
        "meal": {"slot", "title", "items", "totals", "confidence"},
        "workout": {"type", "typeLabel", "durationMin", "kcal", "intensity", "volume", "distanceKm", "avgHr"},
        "supp": {"name", "dose", "timing", "nutrients"},
    }[kind] | {"id", "date", "ts", "source", "note", "photo", "sourceKey", "createdAt", "updatedAt"}
    unknown = set(r) - allowed
    if unknown:
        raise ValueError("未知字段：" + ", ".join(sorted(unknown)))
    r.setdefault("id", kind + "_" + uuid.uuid4().hex[:16])
    r.setdefault("source", "conversation")
    r.setdefault("note", "")
    r.setdefault("createdAt", now_iso())
    r["updatedAt"] = now_iso()
    if kind == "body":
        if r.get("measureMode") not in ("fasting", "bedtime") or not r.get("weightKg"):
            raise ValueError("体重记录必须提供 weightKg 和 measureMode（fasting/bedtime）")
    if kind == "meal":
        if r.get("slot") not in ("breakfast", "lunch", "dinner", "snack"):
            raise ValueError("饮食记录需要 slot（breakfast/lunch/dinner/snack）")
        if not isinstance(r.get("items"), list) or not r["items"]:
            raise ValueError("饮食记录需要非空 items")
        for item in r["items"]:
            if not isinstance(item, dict) or not item.get("name"):
                raise ValueError("食物条目需要 name")
            for key in NUTRIENTS:
                value = item.get(key)
                if value is not None and (type(value) not in (int, float) or not math.isfinite(value) or value < 0):
                    raise ValueError("食物营养必须是非负有限数字或留空")
        r["totals"] = {k: round(sum(i[k] for i in r["items"]), 1) for k in NUTRIENTS
                       if all(i.get(k) is not None for i in r["items"])}
        r.setdefault("title", " + ".join(i["name"] for i in r["items"]))
        r.setdefault("confidence", "estimated")
        if r["confidence"] not in ("estimated", "measured"):
            raise ValueError("confidence 应为 estimated 或 measured")
    if kind == "workout":
        if not r.get("type") or not r.get("durationMin"):
            raise ValueError("运动记录需要 type 和实际 durationMin，不能用默认时长替代")
        r.setdefault("typeLabel", r["type"])
        r.setdefault("intensity", "moderate")
        # 没有体重或强度信息时不编造训练消耗。
    if kind == "supp" and not r.get("name"):
        raise ValueError("补剂记录需要 name")
    if kind == "activity" and not any(r.get(k) is not None for k in allowed - {"id", "date", "ts", "source", "note", "photo", "sourceKey", "createdAt", "updatedAt"}):
        raise ValueError("活动记录至少需要一个测量字段")
    return r


def read_payload(path):
    if path == "-":
        import sys
        value = json.load(sys.stdin)
    else:
        value = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError("JSON 顶层必须是对象")
    return value


def attach(store, path):
    if hasattr(store, "upload_image"):
        return store.upload_image(path)
    original = Path(path)
    raw = original.read_bytes()
    if len(raw) > 20 * 1024 * 1024:
        raise ValueError("原始附件不能超过 20MB")
    digest = hashlib.sha256(raw).hexdigest()
    extension = original.suffix.lower()
    if extension not in (".png", ".jpg", ".jpeg", ".webp", ".heic", ".gif"):
        raise ValueError("仅支持图片附件 png/jpg/jpeg/webp/heic/gif")
    directory = store.directory / "attachments"
    directory.mkdir(exist_ok=True)
    target = directory / (digest + extension)
    if not target.exists():
        # 附件同样临时文件替换，避免中断后存在半个文件。
        import os
        import tempfile
        fd, temporary = tempfile.mkstemp(dir=directory, prefix=".attachment-")
        try:
            with os.fdopen(fd, "wb") as handle:
                handle.write(raw)
                handle.flush()
                os.fsync(handle.fileno())
            os.replace(temporary, target)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
    return "attachments/" + target.name, digest


def execute(store, args):
    collection = KINDS[args.kind]
    data = store.read()
    if args.cmd == "list":
        records = [r for r in data[collection] if not args.date or r["date"] == args.date]
        return {"ok": True, "revision": data["meta"]["revision"], "records": records}
    original_revision = data["meta"]["revision"]
    receipts = data["meta"].setdefault("receipts", {})
    if args.cmd in ("update", "delete"):
        found = next((r for r in data[collection] if r.get("id") == args.id), None)
        if found is None:
            raise ValueError("找不到记录 ID；先 list 查询，不要猜测")
        if args.cmd == "delete":
            data[collection].remove(found)
            result = found
        else:
            patch = read_payload(args.file)
            if set(patch) & {"id", "sourceKey", "createdAt", "photo"}:
                raise ValueError("纠错不能修改 id/sourceKey/createdAt/photo")
            result = normalize(args.kind, {**found, **patch})
            data[collection][data[collection].index(found)] = result
    else:
        payload = read_payload(args.file)
        if set(payload) & {"id", "sourceKey", "photo", "createdAt", "updatedAt"}:
            raise ValueError("系统字段由工具生成；图片用 --photo，幂等键用 --source-key")
        result = normalize(args.kind, payload)
        key = args.source_key
        photo_key = None
        if args.photo:
            result["photo"], digest = attach(store, args.photo)
            # 相同图片不能因重试时换了 source-key 而重复记账。
            photo_key = args.kind + ":photo:" + digest
            existing_photo = next((r for r in data[collection] if r.get("photo") == result["photo"]), None)
            if existing_photo:
                return {"ok": True, "duplicate": True, "record": existing_photo, "revision": original_revision}
            key = key or photo_key
        key = key or args.kind + ":content:" + hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
        receipt_keys = [args.kind + ":" + hashlib.sha256(value.encode()).hexdigest() for value in (key, photo_key) if value]
        for receipt_key in receipt_keys:
            if receipt_key in receipts:
                existing = next((r for r in data[collection] if r.get("id") == receipts[receipt_key]), None)
                return {"ok": True, "duplicate": True, "deleted": existing is None, "record": existing, "revision": original_revision}
        result["sourceKey"] = key
        found = next((r for r in data[collection] if r.get("sourceKey") == key), None)
        if found:
            return {"ok": True, "duplicate": True, "record": found, "revision": original_revision}
        if args.kind == "activity":
            previous = next((r for r in data[collection] if r["date"] == result["date"]), {})
            result = {**previous, **result, "id": previous.get("id", result["id"])}
            data[collection] = [r for r in data[collection] if r["date"] != result["date"]]
        if args.kind == "body":
            previous = next((r for r in data[collection] if (r["date"], r.get("source"), r.get("measureMode", "fasting")) ==
                             (result["date"], result["source"], result["measureMode"])), None)
            if previous:
                result["id"] = previous["id"]
                data[collection].remove(previous)
        data[collection].append(result)
        for receipt_key in receipt_keys:
            receipts[receipt_key] = result["id"]
    data[collection].sort(key=lambda r: (r["date"], r.get("ts", "")))
    saved = store.save(data, original_revision)
    return {"ok": True, "duplicate": False, "action": args.cmd, "record": result, "revision": saved["meta"]["revision"]}
