# Private health backend

Python 3.11+, MySQL 5.7+, InnoDB/utf8mb4. Run from repository root.

```
python3.11 -m venv .venv
.venv/bin/pip install -r cloud/requirements.txt
# Set HEALTH_* from cloud/.env.example through protected service environment.
.venv/bin/python -m cloud.manage init --username owner
.venv/bin/python -m cloud.manage import /private/health-data.json --expected-revision 0 --request-id first-import
.venv/bin/python -m cloud.manage check
.venv/bin/gunicorn --workers 2 --bind 127.0.0.1:8766 cloud.wsgi:app
```

Terminate HTTPS at reverse proxy. Cookies require HTTPS. Do not serve the repository or attachments directory as a web root. Only expose Gunicorn through the proxy. `/` serves H5; explicit `/assets/*` and `/h5/*` are static. All health JSON and attachments require authentication and are `no-store`.

`python -m cloud.manage token` emits a new WorkBuddy bearer token, replacing any previous token. Run in a private terminal; keep its output out of logs. `revoke-token` disables it immediately. `set-password` also invalidates existing browser sessions. Login password is PBKDF2 hashed. Browser mutations use session CSRF; bearer writes are exempt. In-memory login throttling applies per process; production proxy should additionally limit login attempts across workers.

Every record/profile/snapshot write requires `expectedRevision` and stable `requestId`. A successful retry returns its original receipt, even after later revisions; reuse with a changed payload is 409. Global revision is serialized by an InnoDB row lock, with data, records, receipt, and changelog committed together. Imports preserve unknown legacy fields; only explicit new record input uses current strict validation. Snapshot `PUT /api/v1/data` is bearer-only. Export retains legacy schema and updates the revision. Unknown nutrient quantities are omitted from new calculated totals.

Attachments use decoded image verification, 20 MB limits, random-free SHA256 names, private local disk outside the repository, and authenticated download. Recognition reports `configured:false` and HTTP 503 until a real adapter exists. OSS is not configured or claimed available; private local attachment storage is the current backend. Back up MySQL and the attachment directory together. No credentials or health payloads are logged by this application.


Each successful mutation retains a full private JSON snapshot in the same transaction. The latest 80 revisions (including current) are retained. `python -m cloud.manage history` lists revision/time metadata. `python -m cloud.manage restore 12 --expected-revision 27 --request-id recovery-unique-key` creates revision 28 from snapshot 12; it never rewinds the revision counter or overwrites concurrent changes. Attachment files remain available across restores. Receipt responses remain immutable for retry safety. `python -m cloud.manage migrate` adds missing tables on existing installations before service restart.

Run the real MySQL integration harness only against a separately provisioned database:

```
HEALTH_DB_NAME=vitals_health_smoke HEALTH_SMOKE_ALLOW_RESET=1 python -m cloud.smoke
```

The harness refuses production database names and clears its known tables inside the dedicated `_smoke` database. It verifies MySQL row locking/concurrency, rollback, snapshot restore, authentication/CSRF, private attachments, legacy roundtrip and the actual WorkBuddy subprocess/HTTP flow. It never falls back to SQLite. The smoke DB and credentials should be separate from production. Production DB backups should still run independently because retained snapshots share the same database.


Optional OSS adapter: install `cloud/requirements-oss.txt`, then supply all `HEALTH_OSS_ENDPOINT` (HTTPS), `HEALTH_OSS_BUCKET`, `HEALTH_OSS_ACCESS_KEY_ID`, `HEALTH_OSS_ACCESS_KEY_SECRET`, and optional `HEALTH_OSS_KEY_PREFIX`. The SDK is not imported for local disk mode. An incomplete configuration or public bucket blocks startup. The bucket ACL is checked at startup and before every upload/sign request; object uploads explicitly require private ACL. Authenticated attachment GET may redirect to an OSS HTTPS URL signed for 300 seconds. Unauthenticated requests never receive a signature. Keep this bucket private and grant only required bucket ACL read/object operations to its dedicated key. No actual OSS account was configured or verified; mocked adapter tests cover the contract, while production uses private local files until configured.

`GET /api/v1/summary?date=YYYY-MM-DD` and `GET /api/v1/trends?from=YYYY-MM-DD&to=YYYY-MM-DD` are authenticated, read-only deterministic calculations over one database snapshot. Dates are required, canonical calendar dates; invalid or reversed ranges return 400. Each response includes the snapshot `revision`.

Summary returns `date`, `body.latestByMode` (`fasting`, `bedtime`, `unspecified`, each latest same-day original record or null), `meals`, `supplements`, `workouts`, and `activity.steps/sleepMin`. A missing body mode is classified `unspecified`, never guessed; modes never borrow measurements from each other or another date. Within one mode, latest means stored timestamp order, then original import order for equal or absent timestamps. Activity uses the latest same-day activity record. Missing activity fields return null; explicit zero remains zero.

Meal nutrient fields (`kcal`, `proteinG`, `fatG`, `carbG`, `fiberG`) each return `{knownSum, knownCount, missingCount, complete}`. Only finite nonnegative numbers contribute; zero is known. `knownSum` is null when nothing is known, and a partial known sum remains explicitly incomplete. Counts refer to individual food entries; a legacy meal without food items contributes one aggregate entry using its recorded `totals` (or one unknown entry). With food items present, reported totals never fill missing item quantities. `nutritionEntryCount`, `count`, `hasEstimates`, `estimatedCount`, and `unclassifiedConfidenceCount` expose coverage and original meal confidence without reclassifying unknown confidence as measured. Supplements apply the same nutrient counters per supplement record. Workouts return count and the same known/missing statistics for `durationMin` and `kcal`; no duration or expenditure is estimated.

Trends returns `from`, `to`, `revision`, `records` (the five original filtered record collections), `days` (summaries for dates having at least one actual record), and `body[mode].weightKg/bodyFatPct` point arrays. Points retain actual `date`, `ts`, `id`, `value`; missing metric values and missing dates create no points. Every actual measurement is retained, including multiple sources on a date. No interpolation, prior-date carry-forward, or inferred fasting measurements occur. MySQL connections explicitly set session `REPEATABLE READ`, independent of the server global default; no global server configuration is changed.
