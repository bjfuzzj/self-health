#!/usr/bin/env python3
"""Stamp H5 asset URLs with content hashes; never touch runtime data."""
import argparse
import hashlib
from pathlib import Path
import re

ASSETS=('styles.css','voice.js','intake.js','app.js')
def stamp(root,check=False):
    root=Path(root);index=root/'h5/index.html';original=index.read_text(encoding='utf-8');updated=original
    for name in ASSETS:
        digest=hashlib.sha256((root/'h5'/name).read_bytes()).hexdigest()[:12]
        pattern=r'([\"\x27])/h5/'+re.escape(name)+r'(?:\?[^\"\x27]*)?\1'
        updated,count=re.subn(pattern,lambda m:m[1]+'/h5/'+name+'?v='+digest+m[1],updated)
        if not count:raise ValueError('H5 资源引用缺失：'+name)
    changed=original!=updated
    if changed and check:raise ValueError('H5 资源版本过期，请运行 python tools/version_h5.py 并提交 index.html')
    if changed:index.write_text(updated,encoding='utf-8')
    return changed
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    try:print('updated' if stamp(Path(__file__).resolve().parents[1],args.check) else 'current')
    except ValueError as exc:parser.exit(1,str(exc)+'\n')
