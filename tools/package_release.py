#!/usr/bin/env python3
"""按文件白名单打包源码；不扫描或复制运行时 data。"""
import argparse
import hashlib
import json
from pathlib import Path
import sys
import zipfile
from version_h5 import stamp

ROOT = Path(__file__).resolve().parents[1]
FILES = (
    "README.md", "INSTALL.md", "CODEBUDDY.md", "LICENSE", ".gitignore", ".gitattributes",
    "server.py", "storage.py", "records.py", "index.html", "启动.command", "启动.bat",
    "assets/app.js", "assets/app.css", "assets/charts.js",
    "templates/empty-data.json", "templates/demo-data.json",
    "tools/log.py", "tools/setup.py", "tools/make_demo.py", "tools/package_release.py", "tools/version_h5.py",
    ".codebuddy/skills/health-record/SKILL.md", ".github/workflows/test.yml",
    "docs/数据字典.md", "docs/对话录入.md", "docs/维护与备份.md", "docs/隐私说明.md", "docs/验证记录.md",
    "docs/superpowers/specs/2026-10-26-public-release-design.md",
    "docs/superpowers/plans/2026-10-26-public-release.md",
    "tests/test_core.py", "tests/test_cli.py", "tests/test_http.py", "tests/test_package.py", "tests/frontend.test.cjs",
    "remote_store.py", "tools/cloud_client.py", "tools/prepare_migration.py",
    "h5/index.html", "h5/styles.css", "h5/app.js", "h5/voice.js", "h5/intake.js",
    "cloud/__init__.py", "cloud/db.py", "cloud/repository.py", "cloud/manage.py", "cloud/wsgi.py",
    "cloud/attachments.py", "cloud/smoke.py", "cloud/requirements.txt", "cloud/requirements-oss.txt",
    "cloud/backup.py",
    "cloud/recognition.py", "tests/test_cloud_recognition.py", "tests/test_h5_intake.cjs", "tests/test_h5_inline.cjs", "tests/test_h5_cache.cjs", "cloud/metrics.py", "tests/test_cloud_metrics.py",
    "cloud/.env.example", "cloud/README.md", "cloud/CLIENT.md",
    "cloud/DEPLOYMENT.md", "cloud/vitals-health.service.example",
    "cloud/vitals-health-backup.service.example", "cloud/vitals-health-backup.timer.example",
    "tests/test_cloud_api.py", "tests/test_remote_client.py", "tests/test_migration.py", "tests/test_h5_frontend.cjs",
    "tests/test_h5_composer.cjs", "tests/test_cloud_attachments.py", "tests/test_remote_integration.py",
)


def main():
    parser = argparse.ArgumentParser(description="打包 VITALS 干净源码")
    parser.add_argument("--output", type=Path, default=ROOT / "dist/vitals-source.zip")
    args = parser.parse_args()
    try: stamp(ROOT,check=True)
    except ValueError as exc: parser.exit(1,str(exc)+'\n')
    missing = [name for name in FILES if not (ROOT / name).is_file()]
    if missing:
        parser.exit(1, "发行文件缺失：" + ", ".join(missing) + "\n")
    if any((ROOT / name).is_symlink() for name in FILES):
        parser.exit(1, "发行文件不能是符号链接\n")
    target = args.output.resolve()
    if target in {(ROOT / name).resolve() for name in FILES}:
        parser.exit(1, "输出不能覆盖源码文件\n")
    target.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        for name in FILES:
            archive.write(ROOT / name, "self-health/" + name)
    print(json.dumps({"ok": True, "file": str(target), "files": len(FILES), "sha256": hashlib.sha256(target.read_bytes()).hexdigest()}, ensure_ascii=False))


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
