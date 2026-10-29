#!/usr/bin/env python3
"""Cloud-only WorkBuddy entry point: doctor, configure, export, and log commands."""
import argparse
import getpass
import json
import os
from pathlib import Path
import runpy
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from remote_store import DEFAULT_CONFIG, RemoteError, RemoteStore


def configure(args):
    path = Path(os.environ.get('VITALS_CLOUD_CONFIG') or DEFAULT_CONFIG).expanduser().resolve()
    if path.is_relative_to(ROOT):
        raise ValueError('云凭据文件必须放在项目目录外')
    # Password prompt avoids shell history and process command arguments.
    token = getpass.getpass('Cloud bearer token: ')
    store = RemoteStore(args.url, token, connect_ip=args.connect_ip)
    store.read()  # Verify before replacing existing working credentials.
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    fd, temporary = tempfile.mkstemp(prefix='.cloud-', dir=path.parent)
    try:
        if hasattr(os, 'fchmod'):
            os.fchmod(fd, 0o600)
        else:
            os.chmod(temporary, 0o600)
        config = {'url':args.url, 'token':token}
        if args.connect_ip:
            config['connect_ip'] = args.connect_ip
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(config, handle)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(json.dumps({'ok':True, 'config':str(path)}, ensure_ascii=False))


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'log':
        os.environ['VITALS_STORAGE_MODE'] = 'cloud'
        sys.argv = [str(ROOT / 'tools/log.py')] + sys.argv[2:]
        runpy.run_path(str(ROOT / 'tools/log.py'), run_name='__main__')
        return
    parser = argparse.ArgumentParser(description='VITALS 云端兼容客户端（无本地数据回退）')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('doctor', help='验证认证并读取版本号；不输出个人数据或令牌')
    setup = sub.add_parser('configure', help='通过隐藏输入设置项目外的私有凭据文件')
    setup.add_argument('--url', required=True)
    setup.add_argument('--connect-ip', help='临时指定 TCP 目标；仍验证 URL 域名的 TLS 证书')
    export = sub.add_parser('export', help='显式导出云数据到新建的私有 JSON 文件')
    export.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        if args.command == 'configure':
            configure(args)
            return
        store = RemoteStore(allow_loopback_http=os.environ.get('VITALS_CLOUD_ALLOW_LOOPBACK_HTTP') == '1')
        data = store.read()
        if args.command == 'doctor':
            print(json.dumps({'ok':True, 'mode':'cloud', 'revision':data['meta']['revision']}, ensure_ascii=False))
        else:
            output = Path(args.output).expanduser().resolve()
            # O_EXCL prevents overwriting a local canonical snapshot or existing backup.
            fd = os.open(output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(fd, 'w', encoding='utf-8') as handle:
                json.dump(data, handle, ensure_ascii=False, allow_nan=False, indent=2)
                handle.write('\n')
            print(json.dumps({'ok':True, 'output':str(output), 'revision':data['meta']['revision']}, ensure_ascii=False))
    except (ValueError, OSError, TypeError) as exc:
        print(json.dumps({'ok':False, 'error':str(exc)}, ensure_ascii=False), file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
