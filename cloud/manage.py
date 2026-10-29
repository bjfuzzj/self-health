"""Administrative CLI. Secrets come from environment or hidden terminal input."""
import argparse
import getpass
import json
import os
from pathlib import Path
import sys
import uuid
from . import create_app
from storage import validate

def main():
    parser=argparse.ArgumentParser(description='Private health database management')
    sub=parser.add_subparsers(dest='command',required=True)
    init=sub.add_parser('init'); init.add_argument('--username',default='owner')
    imp=sub.add_parser('import'); imp.add_argument('file'); imp.add_argument('--expected-revision',type=int,required=True); imp.add_argument('--request-id')
    exp=sub.add_parser('export'); exp.add_argument('file')
    restore=sub.add_parser('restore'); restore.add_argument('revision',type=int); restore.add_argument('--expected-revision',type=int,required=True); restore.add_argument('--request-id',required=True)
    sub.add_parser('history'); sub.add_parser('migrate')
    sub.add_parser('check'); sub.add_parser('set-password'); sub.add_parser('token'); sub.add_parser('revoke-token')
    args=parser.parse_args(); app=create_app(); repo=app.extensions['health_repository']
    if args.command=='init':
        password=os.environ.get('HEALTH_OWNER_PASSWORD') or getpass.getpass('Owner password: ')
        repo.initialize(args.username,password); result={'ok':True,'initialized':True}
    elif args.command=='import':
        snapshot=json.loads(Path(args.file).read_text(encoding='utf-8-sig')); validate(snapshot)
        result=repo.snapshot({'data':snapshot,'expectedRevision':args.expected_revision,'requestId':args.request_id or 'import-'+uuid.uuid4().hex})
        result.pop('data',None)
    elif args.command=='export':
        data=repo.read(); validate(data)
        # Exclusive creation prevents accidental export overwrite and keeps health data private.
        fd=os.open(args.file,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w',encoding='utf-8') as handle: json.dump(data,handle,ensure_ascii=False,indent=2,allow_nan=False)
        result={'ok':True,'revision':data['meta']['revision']}
    elif args.command=='migrate': repo.db.migrate(); result={'ok':True}
    elif args.command=='history': result={'ok':True,'snapshots':repo.history()}
    elif args.command=='restore':
        result=repo.restore(args.revision,args.expected_revision,args.request_id); result.pop('data',None)
    elif args.command=='check':
        data=repo.read(); validate(data)
        result={'ok':True,'revision':data['meta']['revision'],'counts':{key:len(data[key]) for key in ('bodyMetrics','dailyActivity','meals','workouts','supplements')}}
    elif args.command=='set-password':
        repo.set_password(os.environ.get('HEALTH_OWNER_PASSWORD') or getpass.getpass('New password: ')); result={'ok':True}
    elif args.command=='token':
        # Deliberately output the newly generated token only to caller. Never redirect into logs.
        print(repo.issue_token()); return
    else: repo.revoke_token(); result={'ok':True}
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':
    try: main()
    except (ValueError,OSError) as exc:
        print(json.dumps({'ok':False,'error':str(exc)},ensure_ascii=False),file=sys.stderr); raise SystemExit(1)
    except Exception:
        print(json.dumps({'ok':False,'error':'数据库操作失败，请检查配置与服务状态'},ensure_ascii=False),file=sys.stderr); raise SystemExit(1)
