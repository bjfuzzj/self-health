"""Private JSON recovery export; environment is supplied by the service manager."""
from datetime import datetime, timezone
import json
import os
import tempfile
from pathlib import Path
from . import create_app, ROOT
from storage import validate


def main():
    directory = Path(os.environ.get('HEALTH_BACKUP_DIR', '/www/server/vitals/backups')).resolve()
    if directory.is_relative_to(ROOT):
        raise ValueError('备份必须在 Web 目录外')
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    data = create_app().extensions['health_repository'].read()
    validate(data)
    name = 'health-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '-r' + str(data['meta']['revision']) + '.json'
    fd, temporary = tempfile.mkstemp(prefix='.health-backup-', dir=directory)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, directory/name)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    for path in sorted(directory.glob('health-*.json'), key=lambda p: p.stat().st_mtime_ns)[:-14]:
        path.unlink()
    print(json.dumps({'ok': True, 'revision': data['meta']['revision'], 'backup': name}))


if __name__ == '__main__':
    main()
