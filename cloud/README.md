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


## 图片与语音说明

同一条记录先选择图片和补充说明，再核对表单并保存。附件上传失败保留文件及说明，记录保存失败保留已上传附件标识；不重复上传同一份已成功附件。未提交草稿仅保留在当前页面内存，刷新会丢失，离开页面会提示。

语音 API 由使用者后续提供，本版本没有接入真实转写服务。`GET /api/v1/status` 的 `speech` 返回 `configured:false, available:false`；`POST /api/v1/speech/transcriptions` 经过现有认证与 CSRF 检查后返回 503，不存储录音或修改健康数据。配置环境变量不会自动启用该接口。

前端录音交互已预留：服务可用时申请麦克风权限，最长60秒、最大6MB，multipart `file` 上传到上述接口，成功响应约定为 `{ "ok": true, "text": "转写内容" }`。文字追加到说明，用户可编辑并确认保存；转写失败可重试或取消，原始录音仅在当前页面内存中。后续供应商适配必须验证格式、大小、时限、错误响应与鉴权，再启用 `available`。此交互的模拟测试不代表真实供应商或微信设备验收。

演示空间不上传录音，用户选图仅用于当前预览、不保存到演示记录；内置虚构示例与用户上传图片区分。语音服务未配置时可以使用手机输入法的语音输入。


## AI 图片与说明整理

H5 主流程无需选择类型：输入图片或说明，AI 返回待确认卡；自然语言修改会重新整理，必要字段缺失时补问。详细表单在卡片“查看 / 修改详细数据”中，提交此表单只更新待确认草稿，不写数据库。另保留“手动记录”备用入口。

设置服务端 `HEALTH_MODEL_BASE_URL`、`HEALTH_MODEL_API_KEY`、`HEALTH_MODEL_NAME` 后启用 OpenAI-compatible Chat Completions 适配，BASE_URL 是包含 `/v1` 等前缀的 API 根地址，必须 HTTPS。适配发送 text/image_url 内容块、JSON mode 和 max_tokens；上游必须同时支持这些能力。参考 [OpenAI 图片理解格式](https://developers.openai.com/api/docs/guides/images-vision?api-mode=chat)。其他供应商若格式不同，应新增适配，不能仅填入任意地址后声称联通。

`POST /api/v1/recognize` JSON：`{photo?:"attachments/<id>", note:"说明", date:"YYYY-MM-DD", correction?:"修改意见", previousDrafts?:[]}`。输入照片仅接受当前用户已有附件，不接受外部URL；服务器从私有存储读取并缩放、重编码为JPEG，去除EXIF后发送给配置的模型。照片和说明将发送至所配置模型供应商。模型消息仅含本次输入、修改意见和待确认草稿，不附带完整档案和历史记录，密钥只用于服务端鉴权；健康记录不会因识别而写入。最多6条白名单草稿，未确定数字留空，餐食营养标记估算。接口返回 `{ok:true,drafts:[{kind,payload,questions}],message}`；配置缺失503、上游错误502、并行整理忙429。35秒上游超时，禁止携带密钥重定向；单进程同一时间仅处理一次识别，限制2GB主机图片解码峰值。

`POST /api/v1/records/batch`：`{drafts:[{kind,payload}],expectedRevision,requestId}`。只有点击确认后调用；1–6条同事务、一次版本递增，任一记录无效全部回滚。重复相同请求返回原回执，过期版本409。新同日活动合并保留其他字段，体测按日期/来源/时段处理；同一批重复活动身份会拒绝。保存失败保留冻结请求重试，防止未收到回执后修改内容导致重复记录；版本冲突须读取最新数据、重新整理并核对。

配置状态只表示适配已配置，不代表真实模型识别准确率或供应商验收通过。未配置时保留输入，允许手动录入；演示空间仅内置虚构示例，不对真实上传图片生成假识别结果。真实供应商联调、费用观察和微信真机验收尚需配置后完成。


## 首页常驻录入

首页直接提供拍照/选图、文字和语音补充，识别后的确认卡在原页展开，录入不再打开弹窗。日期、手动录入和演示示例折叠收起；详细数据编辑仍使用备用对话框，提交草稿后返回首页确认卡。

云端数据同步仅更新连接提示和最近记录，不替换录入DOM，因此保留文件选择、输入焦点、光标和录音。页面切换保留当前内存草稿并取消未完成录音；正在请求识别或保存时暂不切换页面。未提交草稿依然只保留在当前浏览器页面内存中，刷新或关闭页面会丢失。模型和语音API的配置状态不因界面调整而改变。
