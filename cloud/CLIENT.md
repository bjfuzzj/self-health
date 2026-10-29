# WorkBuddy cloud client

The CLI uses the cloud only when `VITALS_STORAGE_MODE=cloud`. An absent or broken cloud connection never enables local JSON fallback. Existing local CLI usage remains available when explicitly using local mode. The remote client does not create a local health JSON, JavaScript proxy, backup, or attachment cache.

Configure the cloud client with a hidden token prompt, after the server and bearer token exist:

```sh
python3 tools/cloud_client.py configure --url https://health.baihejie.cn
python3 tools/cloud_client.py doctor
python3 tools/cloud_client.py log show --date 2026-10-29
python3 tools/cloud_client.py log record --kind activity --file /path/to/record.json --source-key stable-message-id
```

Default credentials live in `~/.config/vitals/cloud.json`, outside this repository, owned by the current user with mode `600`. `VITALS_CLOUD_CONFIG` can select another private file outside the repository. The JSON fields are `url`, `token` and optional `connect_ip`. Environment variables `VITALS_CLOUD_URL`, `VITALS_CLOUD_TOKEN`, `VITALS_CLOUD_CONNECT_IP` override the corresponding fields. Never place real tokens in this document, shell command arguments, Git, or WorkBuddy prompts.

While DNS is being completed, `configure --url https://health.baihejie.cn --connect-ip 123.57.7.39` can connect directly to that address. TLS SNI, certificate validation and HTTP Host still use `health.baihejie.cn`; invalid certificates fail. Remove `connect_ip` from the private configuration once DNS resolves correctly. This option does not edit the hosts file or bypass TLS verification.

`cloud_client.py log` sets cloud mode before running the existing `tools/log.py`, including legacy commands and structured record/list/update/delete operations. A WorkBuddy wrapper may set the same environment variable and invoke the normal CLI. Merely creating a credential file does not switch the local CLI into cloud mode.

Photo recording uploads a private image first and stores its logical `attachments/<sha256>.<extension>` path in the cloud record. The server verifies decoded image content and normalizes JPEG extensions to `.jpg`; currently accepted formats are JPG, PNG and WebP. The original local image is never copied into the repository. A later write conflict can leave an unreferenced uploaded attachment; it does not save a duplicate record.

Writes compare the cloud revision and carry an operation request ID. HTTP 409 requires rereading current records before retrying. Network errors fail visibly; a timed-out write may already have committed, so query cloud state and reuse the original structured record `--source-key` when retrying. The client does not silently retry a snapshot replacement or report an unconfirmed write as successful.

`doctor` emits only mode and revision. Explicit export is available as `python3 tools/cloud_client.py export --output /private/path/new-export.json`; it creates a new mode-600 file and refuses to overwrite existing files. Export is the only command that writes a local health snapshot.

For local HTTP tests only, set `VITALS_CLOUD_ALLOW_LOOPBACK_HTTP=1`; this permits HTTP to loopback addresses and does not permit HTTP to public hosts.
