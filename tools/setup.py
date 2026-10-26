#!/usr/bin/env python3
"""幂等初始化与只读环境检查，不安装全局依赖。"""
import argparse
import json
from pathlib import Path
import platform
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from storage import Store


def main():
    parser = argparse.ArgumentParser(description="VITALS 安装检查")
    parser.add_argument("--doctor", action="store_true", help="只检查，不初始化或修改数据")
    args = parser.parse_args()
    if sys.version_info < (3, 10):
        parser.exit(1, "需要 Python 3.10 或更高版本\n")
    store = Store()
    try:
        if args.doctor:
            data = store.read()
            proxy = (store.directory / "health-data.js").read_text(encoding="utf-8")
            proxy_data = json.loads(proxy.split("=", 1)[1].strip().removesuffix(";"))
            if proxy_data != data:
                raise ValueError("只读副本不同步；运行 tools/setup.py 可修复副本")
        else:
            data = store.initialize()
        print(json.dumps({"ok": True, "action": "doctor" if args.doctor else "initialize",
                          "python": platform.python_version(), "platform": platform.system(),
                          "dataFile": str(store.path), "revision": data["meta"]["revision"],
                          "skillPresent": (ROOT / ".codebuddy/skills/health-record/SKILL.md").is_file()}, ensure_ascii=False))
    except (OSError, ValueError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False))
        return 1
    return 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
