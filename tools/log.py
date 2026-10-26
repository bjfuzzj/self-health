#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
VITALS 命令行录入器
==================
给「对话录入」提供确定性的写入通道：助手在对话里听到你的描述后，用这个脚本
把数据写进 data/health-data.json，与面板共用同一份数据、同一套口径。

示例
----
# 体成分（体脂秤读数）—— 晨起空腹，趋势口径
python3 tools/log.py body --weight 74.7 --fat 20.7 --muscle 33.2 --water 57.5 --visceral 7 --mode fasting

# 睡前一次（单独成序列，不与晨起比）
python3 tools/log.py body --weight 75.3 --fat 21.0 --mode bedtime --time 22:10

# 一餐：名称|克数|热量|蛋白|脂肪|碳水
python3 tools/log.py meal --slot lunch --title "鸡胸肉饭" \
    --item "米饭|180|209|4.7|0.5|46.6" \
    --item "鸡胸肉|150|248|46.5|5.4|0"

# 自重训练
python3 tools/log.py workout --type pushup --sets 5 --reps 20
python3 tools/log.py workout --type plank --minutes 3
python3 tools/log.py workout --type swimming --minutes 40 --distance 1.0

# 补剂
python3 tools/log.py supp --name 乳清蛋白 --dose "30 g" --timing 训练后 --kcal 118 --protein 24

# 手环
python3 tools/log.py activity --steps 9200 --sleep-min 445 --resting-hr 58 --hrv 46 --total-kcal 2450

# 查看当天
python3 tools/log.py show
"""

import argparse
import json
import os
import shutil
import sys
from datetime import date, datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from storage import Store, now_iso
from records import KINDS, execute
STORE = Store()
DATA_FILE = str(STORE.path)

MET = {
    "pushup": (6.0, "俯卧撑", "reps"),
    "squat": (5.5, "深蹲", "reps"),
    "plank": (3.6, "平板支撑", "time"),
    "basketball": (8.0, "打篮球", "time"),
    "swimming": (8.0, "游泳", "distance"),
    "running": (9.8, "跑步", "distance"),
    "cycling": (7.5, "骑行", "distance"),
    "strength": (5.0, "力量训练", "time"),
    "walking": (4.3, "快走", "time"),
    "badminton": (5.5, "羽毛球", "time"),
    "jumprope": (11.0, "跳绳", "time"),
    "rowing": (7.0, "划船机", "time"),
    "yoga": (3.0, "瑜伽 / 拉伸", "time"),
    "hiking": (6.0, "爬山 / 徒步", "time"),
    "football": (7.0, "足球", "time"),
    "other": (5.0, "其他", "time"),
}

SLOTS = ("breakfast", "lunch", "dinner", "snack")


def now_iso() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def load() -> dict:
    with open(DATA_FILE, encoding="utf-8") as f:
        return json.load(f)


def save(data: dict) -> None:
    saved = STORE.save(data, data["meta"]["revision"])
    data.clear()
    data.update(saved)


def new_id(prefix: str) -> str:
    return "%s_%s%03d" % (prefix, datetime.now().strftime("%y%m%d%H%M%S"),
                          int(datetime.now().microsecond / 1000))


def dstr(v):
    return v or date.today().isoformat()


def age_of(profile):
    bd = profile.get("birthDate")
    if not bd:
        return profile.get("age")
    b = datetime.strptime(bd, "%Y-%m-%d").date()
    t = date.today()
    return t.year - b.year - ((t.month, t.day) < (b.month, b.day))


def weight_of(data):
    """体重基准：优先最近一次「晨起空腹」，与前端 refBody() 同口径。

    睡前一称会比晨起高一截（食物+饮水未排），若拿它当基准会把 BMR/TDEE/
    目标热量连带带偏。只有在完全没有空腹记录时才退回最新一条。
    """
    bm = sorted(data.get("bodyMetrics") or [],
                key=lambda x: (x.get("date", ""), x.get("ts", "")))
    fasting = [b for b in bm
               if b.get("measureMode", "fasting") == "fasting" and b.get("weightKg")]
    if fasting:
        return fasting[-1].get("weightKg")
    if bm:
        return bm[-1].get("weightKg")
    return data.get("profile", {}).get("weightKg")


# ---------------------------------------------------------------- 命令
def cmd_body(a):
    d = load()
    d.setdefault("bodyMetrics", [])
    h = d.get("profile", {}).get("heightCm")
    w = a.weight
    if not w:
        sys.exit("体重必填：--weight")
    src = "xiaomi_scale" if a.scale else "manual"
    # 测量时段：晨起空腹 / 睡前。两者不可比，趋势只认同一时段。
    t = a.time or datetime.now().strftime("%H:%M")
    if not a.mode:
        sys.exit("请明确 --mode fasting 或 bedtime，不能仅根据上传时间推断测量时段")
    mode = a.mode
    calc_bmi = round(w / (h / 100) ** 2, 1) if h else None
    if calc_bmi is not None and a.bmi is not None and abs(calc_bmi - a.bmi) >= 0.3:
        print("  ! 注意：按身高 %.0f cm 算 BMI 是 %.1f，秤上显示 %.1f —— 身高可能填错了（"
              "可用 log.py profile --height 修正）" % (h, calc_bmi, a.bmi))
    # 同一天 + 同一来源 + 同一测量时段只保留最新一条（重复称重即覆盖）；
    # 晨起与睡前是两条独立序列，各自保留，不同来源可并存。
    previous = next((b for b in d["bodyMetrics"] if b.get("date") == dstr(a.date)
                     and b.get("source") == src and b.get("measureMode", "fasting") == mode), {})
    d["bodyMetrics"] = [b for b in d["bodyMetrics"]
                        if not (b.get("date") == dstr(a.date) and b.get("source") == src
                                and b.get("measureMode", "fasting") == mode)]
    d["bodyMetrics"].append({
        "id": previous.get("id") or new_id("bm"),
        "ts": "%sT%s:00+08:00" % (dstr(a.date), t),
        "date": dstr(a.date),
        "measureMode": mode,
        "weightKg": w,
        "bmi": calc_bmi if calc_bmi is not None else a.bmi,
        "bodyFatPct": a.fat,
        "muscleKg": a.muscle,
        "waterPct": a.water,
        "visceralFat": a.visceral,
        "bmrKcal": a.bmr,
        "boneKg": a.bone,
        "proteinPct": a.protein,
        "bodyAge": a.body_age,
        "source": src,
        "note": a.note or "",
    })
    for key in ("photo", "sourceKey", "createdAt"):
        if key in previous:
            d["bodyMetrics"][-1][key] = previous[key]
    d["bodyMetrics"][-1]["updatedAt"] = now_iso()
    d["bodyMetrics"].sort(key=lambda x: (x.get("date", ""), x.get("ts", "")))
    # 基线体重只吃晨起空腹读数：睡前一次称重不该改掉明天的 BMR / TDEE / 热量目标基数
    prof = d.setdefault("profile", {})
    if mode == "fasting" or not prof.get("weightKg"):
        prof["weightKg"] = w
    if a.scale:
        d.setdefault("sources", {}).setdefault("scale", {}).update(
            {"status": "connected", "lastSync": now_iso()})
    save(d)
    bmi_txt = " · BMI %.1f" % calc_bmi if calc_bmi is not None else ""
    print("已记录体重 %.1f kg%s（%s %s %s）" % (
        w, bmi_txt, dstr(a.date), t, "晨起空腹" if mode == "fasting" else "睡前"))


ACTIVITY_LABELS = {
    1.2: "久坐（几乎不运动）",
    1.375: "轻度活动（每周 1-3 次训练）",
    1.55: "中度活动（每周 3-5 次训练）",
    1.725: "高强度（每周 6-7 次训练）",
    1.9: "极高强度（体力工作 / 一天两练）",
}


def cmd_profile(a):
    """基线：性别 / 生日 / 身高 / 目标。写入后自动回显派生指标。"""
    d = load()
    p = d.setdefault("profile", {})
    p.setdefault("goal", {})
    p.setdefault("targets", {})
    done = []

    if a.name is not None:
        p["name"] = a.name
        done.append("称呼 " + a.name)
    if a.sex:
        p["sex"] = a.sex
        done.append("性别 %s" % ("男" if a.sex == "male" else "女"))
    if a.birth:
        datetime.strptime(a.birth, "%Y-%m-%d")  # 校验格式
        p["birthDate"] = a.birth
        p["age"] = age_of(p)
        done.append("生日 %s（%d 岁）" % (a.birth, p["age"]))
    if a.height:
        p["heightCm"] = a.height
        done.append("身高 %.1f cm" % a.height)
    if a.activity:
        p["activityFactor"] = a.activity
        p["activityLabel"] = ACTIVITY_LABELS.get(a.activity, "活动系数 %.3f" % a.activity)
        done.append(p["activityLabel"])
    if a.bmr_mode:
        p["bmrMode"] = a.bmr_mode
        done.append("基础代谢取值 %s" % ("体脂秤读数" if a.bmr_mode == "scale" else "Mifflin-St Jeor 公式"))
    if a.goal:
        p["goal"]["type"] = a.goal
        done.append({"record_only": "仅记录", "fat_loss": "目标减脂", "maintain": "目标维持",
                     "muscle_gain": "目标增肌"}[a.goal])
    if a.target_weight is not None:
        p["goal"]["targetWeightKg"] = a.target_weight
        done.append("目标体重 %.1f kg" % a.target_weight)
    if a.target_fat is not None:
        p["goal"]["targetBodyFatPct"] = a.target_fat
        done.append("目标体脂 %.1f%%" % a.target_fat)
    if a.weekly_rate is not None:
        p["goal"]["weeklyRateKg"] = a.weekly_rate
        done.append("每周变化 %.2f kg" % a.weekly_rate)
    if a.protein_per_kg is not None:
        p["goal"]["proteinPerKg"] = a.protein_per_kg
        done.append("蛋白 %.1f g/kg" % a.protein_per_kg)
    if a.target_kcal is not None:
        p["targets"]["kcal"] = a.target_kcal
        done.append("热量目标 %d kcal" % a.target_kcal)

    if not done:
        # 无参数：只打印
        pass
    else:
        save(d)

    # ---- 回显派生指标 ----
    w = weight_of(d)
    h = p.get("heightCm")
    age = age_of(p)
    bm = sorted([b for b in d.get("bodyMetrics", []) if b.get("weightKg")],
                key=lambda x: (x.get("date", ""), x.get("ts", "")))
    last = bm[-1] if bm else {}
    print("已更新基线：" + "、".join(done) if done else "当前基线：")
    print("  " + "-" * 46)
    if w and h:
        print("  体重 %.1f kg · 身高 %.0f cm · BMI %.1f" % (w, h, w / (h / 100) ** 2))
    mifflin = None
    if w and h and age and p.get("sex") in ("male", "female"):
        mifflin = round(10 * w + 6.25 * h - 5 * age + (-161 if p.get("sex") == "female" else 5))
        print("  BMR：Mifflin %.0f kcal%s" % (
            mifflin, (" · 体脂秤 %s kcal" % last["bmrKcal"]) if last.get("bmrKcal") else ""))
    bmr = (last.get("bmrKcal") if p.get("bmrMode") == "scale" and last.get("bmrKcal") else mifflin)
    if bmr and p.get("goal", {}).get("type") != "record_only":
        tdee = round(bmr * (p.get("activityFactor") or 1.375))
        g = p.get("goal", {})
        rate = g.get("weeklyRateKg", 0.5) or 0
        deficit = 0
        if g.get("type") == "fat_loss":
            deficit = rate * 7700 / 7
        elif g.get("type") == "muscle_gain":
            deficit = -rate * 7700 / 7 * 0.55
        kcal = p["targets"].get("kcal") or round((tdee - deficit) / 10) * 10
        protein = p["targets"].get("proteinG") or (round(w * (g.get("proteinPerKg") or 1.6)) if w else None)
        print("  TDEE %.0f kcal → 每日目标 %d kcal（缺口 %+d）" % (tdee, kcal, -round(deficit)))
        if protein:
            print("  蛋白 %.0f g / 脂肪 %.0f g / 碳水 %.0f g" % (
                protein, kcal * 0.27 / 9, max(0, (kcal - protein * 4 - kcal * 0.27) / 4)))
    print()


def cmd_meal(a):
    d = load()
    d.setdefault("meals", [])
    items, tk, tp, tf, tc, tfb = [], 0.0, 0.0, 0.0, 0.0, 0.0
    for spec in a.item or []:
        parts = [p.strip() for p in spec.split("|")]
        if len(parts) != 7:
            sys.exit("条目格式应为 名称|克数|热量|蛋白|脂肪|碳水|纤维，收到：%s" % spec)
        name = parts[0]
        gram = parts[1] if len(parts) > 1 else ""
        num = [float(x) if x else 0.0 for x in parts[2:6]] + [0.0] * (4 - len(parts[2:6]))
        k, p, f, c = num[0], num[1], num[2], num[3]
        fiber = float(parts[6]) if len(parts) > 6 and parts[6] else 0.0
        items.append({
            "name": name, "amount": ("%s g" % gram) if gram else "",
            "kcal": round(k), "proteinG": p, "fatG": f, "carbG": c, "fiberG": fiber,
        })
        tk += k
        tp += p
        tf += f
        tc += c
        tfb += fiber
    if not items:
        sys.exit("至少一个 --item")
    slot = a.slot or ("lunch" if datetime.now().hour < 15 else "dinner")
    if slot not in SLOTS:
        sys.exit("--slot 只能是 %s" % "/".join(SLOTS))
    d["meals"].append({
        "id": new_id("ml"),
        "ts": "%sT%s:00+08:00" % (dstr(a.date), a.time or datetime.now().strftime("%H:%M")),
        "date": dstr(a.date),
        "slot": slot,
        "title": a.title or " + ".join(i["name"] for i in items),
        "items": items,
        "totals": {"kcal": round(tk), "proteinG": round(tp, 1), "fatG": round(tf, 1),
                   "carbG": round(tc, 1), "fiberG": round(tfb, 1)},
        "confidence": "measured" if a.measured else "estimated",
        "source": "conversation",
        "photo": a.photo,
        "note": a.note or "",
    })
    save(d)
    print("已记录 %s：%d kcal · 蛋白 %.0f g · 脂肪 %.0f g · 碳水 %.0f g" % (
        d["meals"][-1]["title"], tk, tp, tf, tc))


def cmd_workout(a):
    d = load()
    d.setdefault("workouts", [])
    if a.type not in MET:
        sys.exit("未知项目，可选：%s" % ", ".join(MET))
    met, label, unit = MET[a.type]
    w = weight_of(d)
    volume = None
    minutes = a.minutes
    if minutes is None or minutes <= 0:
        sys.exit("请提供实际运动时长 --minutes；不能用默认时长代替")
    if unit == "reps" and a.sets and a.reps:
        volume = {"sets": [a.reps] * a.sets, "totalReps": a.sets * a.reps}
    kcal = a.kcal if a.kcal is not None else (round(met * w * (minutes / 60.0)) if w else None)
    d["workouts"].append({
        "id": new_id("wk"),
        "ts": "%sT%s:00+08:00" % (dstr(a.date), a.time or datetime.now().strftime("%H:%M")),
        "date": dstr(a.date),
        "type": a.type,
        "typeLabel": label,
        "durationMin": int(minutes),
        "kcal": int(kcal) if kcal is not None else None,
        "intensity": a.intensity,
        "volume": volume,
        "distanceKm": a.distance,
        "avgHr": a.hr,
        "source": "conversation",
        "note": a.note or "",
    })
    desc = ("%d 组 × %d 次" % (a.sets, a.reps)) if volume else ("%d 分钟" % minutes)
    save(d)
    print("已记录 %s：%s · %s" % (label, desc, ("约 %d kcal" % kcal) if kcal is not None else "消耗未估算"))


def cmd_supp(a):
    d = load()
    d.setdefault("supplements", [])
    d["supplements"].append({
        "id": new_id("sp"),
        "ts": "%sT%s:00+08:00" % (dstr(a.date), a.time or datetime.now().strftime("%H:%M")),
        "date": dstr(a.date),
        "name": a.name,
        "dose": a.dose or "",
        "timing": a.timing or "",
        "nutrients": {"kcal": a.kcal or 0, "proteinG": a.protein or 0,
                      "fatG": a.fat or 0, "carbG": a.carb or 0},
        "source": "conversation",
        "note": a.note or "",
    })
    save(d)
    print("已记录补剂：%s %s" % (a.name, a.dose or ""))


def cmd_activity(a):
    d = load()
    d.setdefault("dailyActivity", [])
    day = dstr(a.date)
    old = next((x for x in d["dailyActivity"] if x.get("date") == day), {})
    rec = dict(old)
    rec.setdefault("id", new_id("act"))
    rec.update({"date": day, "source": "xiaomi_band"})
    mapping = {
        "steps": a.steps, "distanceKm": a.distance, "activeKcal": a.active_kcal,
        "totalKcal": a.total_kcal, "sleepMin": a.sleep_min, "sleepScore": a.sleep_score,
        "restingHr": a.resting_hr, "hrvMs": a.hrv, "spo2": a.spo2, "hrAvg": a.hr,
    }
    for k, v in mapping.items():
        if v is not None:
            rec[k] = v
    d["dailyActivity"] = [x for x in d["dailyActivity"] if x.get("date") != day] + [rec]
    d["dailyActivity"].sort(key=lambda x: x.get("date", ""))
    d.setdefault("sources", {}).setdefault("band", {}).update(
        {"status": "connected", "lastSync": now_iso()})
    save(d)
    print("已更新 %s 的手环数据" % day)


def cmd_show(a):
    d = load()
    day = dstr(a.date)
    prof = d.get("profile", {})
    bm = [b for b in d.get("bodyMetrics", []) if b.get("date") == day]
    meals = [m for m in d.get("meals", []) if m.get("date") == day]
    wks = [w for w in d.get("workouts", []) if w.get("date") == day]
    sps = [s for s in d.get("supplements", []) if s.get("date") == day]
    act = next((x for x in d.get("dailyActivity", []) if x.get("date") == day), {})
    intake = {"kcal": 0, "p": 0.0, "f": 0.0, "c": 0.0}
    for m in meals:
        t = m.get("totals", {})
        intake["kcal"] += t.get("kcal", 0)
        intake["p"] += t.get("proteinG", 0)
        intake["f"] += t.get("fatG", 0)
        intake["c"] += t.get("carbG", 0)
    for s in sps:
        n = s.get("nutrients", {})
        intake["kcal"] += n.get("kcal", 0)
        intake["p"] += n.get("proteinG", 0)
        intake["f"] += n.get("fatG", 0)
        intake["c"] += n.get("carbG", 0)
    wk_kcal = sum(w.get("kcal") or 0 for w in wks)

    print("\n  %s  %s" % (day, prof.get("name") or ""))
    print("  " + "-" * 46)
    if bm:
        # 展示口径与前端一致：有晨起空腹就只认它，睡前读数只在标题里标注
        fb = [x for x in bm if x.get("measureMode", "fasting") == "fasting"]
        b = (fb or bm)[-1]
        mode_txt = "晨起空腹" if b.get("measureMode", "fasting") == "fasting" else "睡前"
        print("  体重 %.1f kg · 体脂 %s%% · BMI %s（%s）" % (
            b.get("weightKg", 0), b.get("bodyFatPct", "—"), b.get("bmi", "—"), mode_txt))
    print("  摄入 %d kcal  (P %.0f / F %.0f / C %.0f)" % (
        intake["kcal"], intake["p"], intake["f"], intake["c"]))
    print("  消耗 %s kcal  (训练 %d kcal)" % (act.get("totalKcal", "—"), wk_kcal))
    if act:
        print("  步数 %s · 睡眠 %s 分钟 · 静息心率 %s" % (
            act.get("steps", "—"), act.get("sleepMin", "—"), act.get("restingHr", "—")))
    print("  记录：%d 餐 · %d 次训练 · %d 项补剂" % (len(meals), len(wks), len(sps)))
    for m in meals:
        print("    · %s %s  %d kcal" % (m.get("ts", "")[11:16], m.get("title", ""),
                                        m.get("totals", {}).get("kcal", 0)))
    for w in wks:
        print("    · %s %s  %s" % (w.get("ts", "")[11:16], w.get("typeLabel", ""), ("%s kcal" % w["kcal"]) if w.get("kcal") is not None else "消耗未估算"))
    for s in sps:
        print("    · %s %s %s" % (s.get("ts", "")[11:16], s.get("name", ""), s.get("dose", "")))
    print()


def main():
    ap = argparse.ArgumentParser(description="VITALS 命令行录入器")
    sub = ap.add_subparsers(dest="cmd", required=True)

    b = sub.add_parser("body", help="录入体成分")
    b.add_argument("--date")
    b.add_argument("--time")
    b.add_argument("--weight", type=float)
    b.add_argument("--bmi", type=float)
    b.add_argument("--fat", type=float)
    b.add_argument("--muscle", type=float)
    b.add_argument("--water", type=float)
    b.add_argument("--visceral", type=int)
    b.add_argument("--bmr", type=int)
    b.add_argument("--bone", type=float)
    b.add_argument("--protein", type=float, help="蛋白质占比（%%）")
    b.add_argument("--body-age", type=int)
    b.add_argument("--mode", choices=("fasting", "bedtime"),
                   help="fasting=晨起空腹 / bedtime=睡前；不填则按时间自动判断（<12:00 记空腹）")
    b.add_argument("--scale", action="store_true", help="标记为体脂秤读数")
    b.add_argument("--note")
    b.set_defaults(func=cmd_body)

    p = sub.add_parser("profile", help="设置基线（性别/生日/身高/目标）")
    p.add_argument("--name", help="称呼")
    p.add_argument("--sex", choices=("male", "female"))
    p.add_argument("--birth", help="YYYY-MM-DD")
    p.add_argument("--height", type=float, help="cm")
    p.add_argument("--activity", type=float, choices=tuple(ACTIVITY_LABELS))
    p.add_argument("--bmr-mode", choices=("mifflin", "scale"))
    p.add_argument("--goal", choices=("record_only", "fat_loss", "maintain", "muscle_gain"))
    p.add_argument("--target-weight", type=float)
    p.add_argument("--target-fat", type=float)
    p.add_argument("--weekly-rate", type=float)
    p.add_argument("--protein-per-kg", type=float)
    p.add_argument("--target-kcal", type=int)
    p.set_defaults(func=cmd_profile)

    m = sub.add_parser("meal", help="录入一餐")
    m.add_argument("--date")
    m.add_argument("--time")
    m.add_argument("--slot", choices=SLOTS)
    m.add_argument("--title")
    m.add_argument("--item", action="append", help="名称|克数|热量|蛋白|脂肪|碳水|纤维")
    m.add_argument("--measured", action="store_true", help="精确称重（非估算）")
    m.add_argument("--photo")
    m.add_argument("--note")
    m.set_defaults(func=cmd_meal)

    w = sub.add_parser("workout", help="录入训练")
    w.add_argument("--date")
    w.add_argument("--time")
    w.add_argument("--type", required=True, help=", ".join(MET))
    w.add_argument("--sets", type=int)
    w.add_argument("--reps", type=int)
    w.add_argument("--minutes", type=int)
    w.add_argument("--default-minutes", type=int, default=30)
    w.add_argument("--kcal", type=int)
    w.add_argument("--distance", type=float)
    w.add_argument("--hr", type=int)
    w.add_argument("--intensity", default="moderate", choices=("low", "moderate", "high"))
    w.add_argument("--note")
    w.set_defaults(func=cmd_workout)

    s = sub.add_parser("supp", help="录入补剂")
    s.add_argument("--name", required=True)
    s.add_argument("--dose")
    s.add_argument("--timing")
    s.add_argument("--date")
    s.add_argument("--time")
    s.add_argument("--kcal", type=float)
    s.add_argument("--protein", type=float)
    s.add_argument("--fat", type=float)
    s.add_argument("--carb", type=float)
    s.add_argument("--note")
    s.set_defaults(func=cmd_supp)

    a = sub.add_parser("activity", help="更新手环数据")
    a.add_argument("--date")
    a.add_argument("--steps", type=int)
    a.add_argument("--distance", type=float)
    a.add_argument("--active-kcal", type=int)
    a.add_argument("--total-kcal", type=int)
    a.add_argument("--sleep-min", type=int)
    a.add_argument("--sleep-score", type=int)
    a.add_argument("--resting-hr", type=int)
    a.add_argument("--hrv", type=int)
    a.add_argument("--spo2", type=int)
    a.add_argument("--hr", type=int)
    a.set_defaults(func=cmd_activity)

    sh = sub.add_parser("show", help="查看某天汇总")
    sh.add_argument("--date")
    sh.set_defaults(func=cmd_show)

    for command in ("record", "list", "update", "delete"):
        parser = sub.add_parser(command, help={"record": "JSON 录入（幂等）", "list": "JSON 查询", "update": "按 ID 纠错", "delete": "按 ID 删除"}[command])
        parser.add_argument("--kind", choices=tuple(KINDS), required=True)
        if command in ("record", "update"):
            parser.add_argument("--file", required=True, help="UTF-8 JSON 文件，- 表示标准输入")
        if command in ("update", "delete"):
            parser.add_argument("--id", required=True)
        if command == "record":
            parser.add_argument("--source-key", help="稳定的原始消息标识；重试使用同一值")
            parser.add_argument("--photo", help="可选：原始图片文件路径")
        if command == "list":
            parser.add_argument("--date")

    args = ap.parse_args()
    if not os.path.exists(DATA_FILE):
        sys.exit("找不到数据文件：%s" % DATA_FILE)
    try:
        with STORE.lock():
            if args.cmd in ("record", "list", "update", "delete"):
                print(json.dumps(execute(STORE, args), ensure_ascii=False, allow_nan=False))
            else:
                args.func(args)
    except (ValueError, OSError, TypeError, TimeoutError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr, sys.stdin):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    main()
