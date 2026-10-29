"""Prepare an explicit, lossless compatibility snapshot, never edit the source."""
import argparse
import copy
import json
import os
from pathlib import Path
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from storage import COLLECTIONS, validate


def prepare(source):
    data = copy.deepcopy(source)
    report = {'assignedIds': 0, 'unavailablePhotos': 0, 'counts': {}}
    for collection in COLLECTIONS:
        rows = data.get(collection, [])
        report['counts'][collection] = len(rows)
        for position, record in enumerate(rows):
            if not record.get('id'):
                seed = 'vitals-migration:' + collection + ':' + str(position) + ':' + json.dumps(record, ensure_ascii=False, sort_keys=True)
                record['id'] = collection + '_' + uuid.uuid5(uuid.NAMESPACE_URL, seed).hex[:20]
                report['assignedIds'] += 1
            photo = record.get('photo')
            if photo and (not isinstance(photo, str) or not photo.startswith('attachments/') or '..' in photo or '\\' in photo):
                if 'legacyPhotoReference' in record:
                    raise ValueError('历史图片字段已存在，需人工核对，未覆盖')
                record['legacyPhotoReference'] = photo
                record['photo'] = None
                record['attachmentStatus'] = 'unavailable'
                report['unavailablePhotos'] += 1
    validate(data)
    return data, report


def private_json(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w', encoding='utf-8') as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2, allow_nan=False)
        handle.write('\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    data, report = prepare(json.loads(args.source.read_text(encoding='utf-8-sig')))
    if args.output.resolve() == args.source.resolve() or args.report.resolve() == args.source.resolve():
        parser.error('输出不能覆盖历史事实源')
    private_json(args.output, data)
    private_json(args.report, report)
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
