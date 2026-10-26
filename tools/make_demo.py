#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 data/demo-data.json —— 一份 60 天的演示数据。
用途：① 预览完整面板效果（?demo=1）；② 作为数据结构范例。
不会写入 health-data.json。
"""

import json
import os
import random
from datetime import date, datetime, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(20261018)

TODAY = date.today()
DAYS = 60
SEX = "male"
BIRTH = "1993-04-12"
HEIGHT = 176.0

START_W = 78.6
END_W = 74.9
START_FAT = 23.1
END_FAT = 20.9


def iso(d: date, h: int, m: int) -> str:
    return d.isoformat() + "T%02d:%02d:00+08:00" % (h, m)


MEAL_LIB = {
    "breakfast": [
        ("燕麦牛奶 + 鸡蛋", [("燕麦片（干）", 50, 188, 6.6, 3.4, 33.0, 5.0),
                        ("牛奶（全脂）", 250, 153, 8.0, 8.3, 12.0, 0),
                        ("鸡蛋", 100, 143, 12.6, 9.5, 1.1, 0)]),
        ("全麦面包 + 希腊酸奶", [("全麦面包", 70, 172, 6.8, 2.4, 28.7, 4.2),
                          ("希腊酸奶", 150, 146, 13.5, 7.5, 6.0, 0),
                          ("蓝莓", 80, 46, 0.6, 0.2, 11.2, 1.9)]),
        ("豆浆 + 肉包", [("豆浆（无糖）", 300, 93, 9.0, 4.8, 3.6, 1.5),
                      ("包子（肉）", 100, 227, 8.0, 7.0, 32.0, 1.2)]),
        ("白粥 + 鸡蛋 + 小菜", [("白粥", 300, 138, 3.3, 0.9, 29.7, 0.9),
                          ("鸡蛋", 100, 143, 12.6, 9.5, 1.1, 0),
                          ("黄瓜", 100, 15, 0.7, 0.1, 3.6, 0.5)]),
    ],
    "lunch": [
        ("鸡胸肉饭 + 西兰花", [("米饭（熟）", 180, 209, 4.7, 0.5, 46.6, 0.5),
                         ("鸡胸肉（熟）", 150, 248, 46.5, 5.4, 0, 0),
                         ("西兰花", 150, 51, 4.2, 0.6, 10.5, 3.9)]),
        ("牛肉面", [("面条（熟）", 250, 345, 11.3, 2.3, 67.5, 3.0),
                  ("牛肉（瘦）", 100, 250, 26.0, 15.0, 0, 0),
                  ("生菜 / 绿叶菜", 80, 12, 1.1, 0.2, 2.3, 1.0)]),
        ("三文鱼糙米饭", [("糙米饭", 180, 202, 4.7, 1.6, 41.4, 3.2),
                     ("三文鱼", 130, 270, 26.0, 16.9, 0, 0),
                     ("番茄", 150, 27, 1.4, 0.3, 5.9, 1.8)]),
        ("外食 · 麻辣烫", [("麻辣烫", 450, 585, 31.5, 31.5, 45.0, 6.8)]),
        ("鸡胸沙拉 + 红薯", [("鸡胸沙拉", 260, 312, 26.0, 15.6, 15.6, 5.2),
                        ("红薯", 180, 155, 2.9, 0.2, 36.0, 5.4)]),
        ("饺子 + 拌菜", [("饺子（猪肉）", 220, 528, 19.8, 22.0, 61.6, 3.1),
                     ("黄瓜", 120, 18, 0.8, 0.1, 4.3, 0.6)]),
    ],
    "dinner": [
        ("虾仁豆腐 + 米饭", [("虾", 150, 149, 36.0, 0.5, 0.3, 0),
                        ("豆腐（北）", 150, 174, 18.3, 7.2, 3.0, 0.8),
                        ("米饭（熟）", 120, 139, 3.1, 0.4, 31.1, 0.4)]),
        ("牛肉 + 西兰花 + 玉米", [("牛肉（瘦）", 130, 325, 33.8, 19.5, 0, 0),
                            ("西兰花", 180, 61, 5.0, 0.7, 12.6, 4.7),
                            ("玉米（煮）", 150, 144, 5.1, 2.3, 31.5, 2.6)]),
        ("鸡胸意面", [("面条（熟）", 220, 304, 9.9, 2.0, 59.4, 2.6),
                  ("鸡胸肉（熟）", 120, 198, 37.2, 4.3, 0, 0),
                  ("橄榄油", 8, 71, 0, 8.0, 0, 0)]),
        ("火锅（清汤）", [("火锅（清汤涮肉）", 400, 720, 56.0, 48.0, 16.0, 4.0)]),
        ("三明治 + 牛奶", [("三明治", 160, 384, 17.6, 12.8, 48.0, 3.2),
                       ("牛奶（全脂）", 250, 153, 8.0, 8.3, 12.0, 0)]),
        ("火锅聚餐（约）", [("火锅（清汤涮肉）", 500, 900, 70.0, 60.0, 20.0, 5.0),
                       ("啤酒", 330, 142, 1.7, 0, 11.9, 0)]),
    ],
}

SNACKS = [
    ("混合坚果", 25, 152, 5.0, 13.5, 5.0, 1.8),
    ("苹果", 200, 104, 0.6, 0.4, 28.0, 4.8),
    ("香蕉", 120, 107, 1.3, 0.4, 27.6, 3.1),
    ("无糖酸奶", 150, 89, 5.3, 5.0, 6.8, 0),
    ("美式咖啡", 300, 6, 0.3, 0, 1.2, 0),
]

WORKOUT_PLAN = [
    ("pushup", 5, 20, 12, 82),
    ("squat", 5, 25, 14, 96),
    ("plank", 0, 0, 6, 26),
    ("strength", 0, 0, 55, 285),
    ("running", 0, 0, 32, 355),
    ("swimming", 0, 0, 45, 430),
    ("basketball", 0, 0, 75, 520),
    ("badminton", 0, 0, 60, 330),
]


def build():
    data = {
        "schemaVersion": 1,
        "meta": {
            "app": "VITALS",
            "createdAt": iso(TODAY - timedelta(days=DAYS), 21, 30),
            "updatedAt": iso(TODAY, 21, 40),
            "timezone": "Asia/Shanghai",
            "revision": 42,
            "demo": True,
        },
        "profile": {
            "name": "示例",
            "sex": SEX,
            "birthDate": BIRTH,
            "age": None,
            "heightCm": HEIGHT,
            "weightKg": END_W,
            "activityFactor": 1.375,
            "activityLabel": "轻度活动（每周 1-3 次训练）",
            "bmrMode": "mifflin",
            "goal": {
                "type": "fat_loss",
                "targetWeightKg": 70.0,
                "targetBodyFatPct": 16.0,
                "targetDate": "2027-03-31",
                "weeklyRateKg": 0.5,
                "proteinPerKg": 1.8,
            },
            "targets": {
                "kcal": None, "proteinG": None, "fatG": None, "carbG": None,
                "fiberG": 30, "steps": 9000, "sleepMin": 450, "waterMl": 2200,
            },
        },
        "sources": {
            "scale": {"key": "xiaomi_scale", "label": "小米体脂秤", "status": "active",
                      "lastSync": iso(TODAY, 7, 12)},
            "band": {"key": "xiaomi_band", "label": "小米手环", "status": "active",
                     "lastSync": iso(TODAY, 21, 5)},
            "conversation": {"key": "conversation", "label": "对话录入", "status": "active",
                             "lastSync": iso(TODAY, 20, 40)},
        },
        "bodyMetrics": [],
        "dailyActivity": [],
        "meals": [],
        "workouts": [],
        "supplements": [],
        "journal": [],
        "imports": [{"at": iso(TODAY - timedelta(days=30), 9, 12), "kind": "band", "rows": 30}],
    }

    n = 0
    for i in range(DAYS):
        d = TODAY - timedelta(days=DAYS - 1 - i)
        t = i / (DAYS - 1)
        base_w = START_W + (END_W - START_W) * t
        base_fat = START_FAT + (END_FAT - START_FAT) * t

        # 体重：每周称 5 次，带一点水分波动
        if random.random() < 0.78 or i == DAYS - 1:
            w = round(base_w + random.uniform(-0.28, 0.28), 1)
            fat = round(base_fat + random.uniform(-0.25, 0.25), 1)
            muscle = round(w * (0.435 + 0.012 * t) + random.uniform(-0.2, 0.2), 1)
            water = round(56.8 + 0.9 * t + random.uniform(-0.5, 0.5), 1)
            bmr = int(round(10 * w + 6.25 * HEIGHT - 5 * 33 + 5))
            data["bodyMetrics"].append({
                "id": "bm_%02d" % i,
                "ts": iso(d, 7, random.choice([8, 12, 15, 18])),
                "date": d.isoformat(),
                "weightKg": w,
                "bmi": round(w / (HEIGHT / 100) ** 2, 1),
                "bodyFatPct": fat,
                "muscleKg": muscle,
                "musclePct": round(muscle / w * 100, 1),
                "waterPct": water,
                "visceralFat": max(6, int(round(11 - 4 * t))),
                "boneKg": 3.0,
                "proteinPct": round(18.6 + 0.8 * t, 1),
                "bmrKcal": bmr,
                "bodyAge": max(29, int(round(34 - 3 * t))),
                "scaleScore": int(round(70 + 9 * t)),
                "source": "xiaomi_scale",
                "note": "",
            })

        # 手环：几乎每天都有
        bmr_base = 10 * base_w + 6.25 * HEIGHT - 5 * 33 + 5
        steps = int(random.gauss(8800, 2600))
        steps = max(2600, min(17000, steps))
        active = int(steps * 0.038 + random.uniform(40, 160))
        sleep_min = int(random.gauss(438, 42))
        sleep_min = max(320, min(540, sleep_min))
        data["dailyActivity"].append({
            "date": d.isoformat(),
            "steps": steps,
            "distanceKm": round(steps * 0.00072, 2),
            "activeKcal": active,
            "totalKcal": int(round(bmr_base * 1.28 + active * 0.55)),
            "restingHr": int(random.gauss(59, 2.1)),
            "hrAvg": int(random.gauss(73, 3)),
            "hrMax": int(random.gauss(138, 12)),
            "hrvMs": int(random.gauss(46, 6)),
            "spo2": int(random.gauss(96.4, 1)),
            "stressAvg": int(random.gauss(36, 8)),
            "sleepMin": sleep_min,
            "deepSleepMin": int(sleep_min * random.uniform(0.18, 0.25)),
            "remSleepMin": int(sleep_min * random.uniform(0.19, 0.26)),
            "lightSleepMin": int(sleep_min * random.uniform(0.5, 0.58)),
            "awakeMin": int(random.uniform(6, 22)),
            "sleepScore": int(random.gauss(78, 6)),
            "standHours": int(random.gauss(9, 1.6)),
            "source": "xiaomi_band",
        })

        # 三餐
        for slot, hour in (("breakfast", 7), ("lunch", 12), ("dinner", 19)):
            if slot == "breakfast" and random.random() < 0.08:
                continue
            if slot == "dinner" and random.random() < 0.05:
                continue
            title, items = random.choice(MEAL_LIB[slot])
            its, tk, tp, tf, tc, tfb = [], 0, 0, 0, 0, 0
            for name, g, k, p, f, c, fb in items:
                its.append({
                    "name": name, "amount": "%d g" % g, "kcal": k,
                    "proteinG": p, "fatG": f, "carbG": c, "fiberG": fb,
                })
                tk += k; tp += p; tf += f; tc += c; tfb += fb
            data["meals"].append({
                "id": "ml_%02d_%s" % (i, slot),
                "ts": iso(d, hour, random.choice([5, 10, 15, 20, 25, 30, 40])),
                "date": d.isoformat(),
                "slot": slot,
                "title": title,
                "items": its,
                "totals": {"kcal": tk, "proteinG": round(tp, 1), "fatG": round(tf, 1),
                           "carbG": round(tc, 1), "fiberG": round(tfb, 1)},
                "confidence": random.choice(["estimated", "estimated", "measured"]),
                "source": "conversation",
                "photo": None,
                "note": "",
            })
            # 加餐
            if random.random() < 0.35:
                name, g, k, p, f, c, fb = random.choice(SNACKS)
                data["meals"].append({
                    "id": "ml_%02d_%s_snack" % (i, slot),
                    "ts": iso(d, hour + 3, 0),
                    "date": d.isoformat(),
                    "slot": "snack",
                    "title": name,
                    "items": [{"name": name, "amount": "%d g" % g, "kcal": k,
                               "proteinG": p, "fatG": f, "carbG": c, "fiberG": fb}],
                    "totals": {"kcal": k, "proteinG": p, "fatG": f, "carbG": c, "fiberG": fb},
                    "confidence": "measured",
                    "source": "conversation",
                    "photo": None,
                    "note": "",
                })

        # 训练：每周 3-4 次
        if d.weekday() in (0, 2, 4, 6) and random.random() < 0.82:
            kind, sets, reps, mins, kcal = random.choice(WORKOUT_PLAN)
            vol = None
            if kind in ("pushup", "squat"):
                vol = {"sets": [reps] * sets, "totalReps": sets * reps,
                       "setReps": reps}
            data["workouts"].append({
                "id": "wk_%02d" % i,
                "ts": iso(d, random.choice([18, 19, 20]), random.choice([5, 20, 35])),
                "date": d.isoformat(),
                "type": kind,
                "typeLabel": {"pushup": "俯卧撑", "squat": "深蹲", "plank": "平板支撑",
                              "strength": "力量训练", "running": "跑步",
                              "swimming": "游泳", "basketball": "打篮球",
                              "badminton": "羽毛球"}[kind],
                "durationMin": mins,
                "kcal": kcal,
                "intensity": random.choice(["moderate", "moderate", "high"]),
                "volume": vol,
                "distanceKm": round(random.uniform(0.9, 1.3), 2) if kind == "swimming" else None,
                "avgHr": int(random.gauss(132, 9)),
                "source": "conversation",
                "note": "",
            })

        # 补剂
        if random.random() < 0.86:
            data["supplements"].append({
                "id": "sp_%02d_a" % i, "ts": iso(d, 8, 10), "date": d.isoformat(),
                "name": "复合维生素", "dose": "1 片", "timing": "早餐后",
                "nutrients": {"kcal": 0, "proteinG": 0, "fatG": 0, "carbG": 0},
                "source": "conversation", "note": "",
            })
        if random.random() < 0.9:
            data["supplements"].append({
                "id": "sp_%02d_b" % i, "ts": iso(d, 20, 30), "date": d.isoformat(),
                "name": "乳清蛋白", "dose": "30 g", "timing": "训练后",
                "nutrients": {"kcal": 118, "proteinG": 24.0, "fatG": 1.2, "carbG": 2.4},
                "source": "conversation", "note": "",
            })
        if random.random() < 0.7:
            data["supplements"].append({
                "id": "sp_%02d_c" % i, "ts": iso(d, 22, 15), "date": d.isoformat(),
                "name": "镁", "dose": "300 mg", "timing": "睡前",
                "nutrients": {"kcal": 0, "proteinG": 0, "fatG": 0, "carbG": 0},
                "source": "conversation", "note": "",
            })

    return data


if __name__ == "__main__":
    out = build()
    path = os.path.join(ROOT, "templates", "demo-data.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print("demo-data.json 已生成：%d 天体成分 / %d 天活动 / %d 餐 / %d 次训练 / %d 条补剂" % (
        len(out["bodyMetrics"]), len(out["dailyActivity"]), len(out["meals"]),
        len(out["workouts"]), len(out["supplements"])))
