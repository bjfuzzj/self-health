"""Bearer-authenticated cloud Store. Never reads or writes a local health snapshot."""
from contextlib import contextmanager
import copy
import hashlib
import http.client
import ipaddress
import json
import mimetypes
import os
from pathlib import Path
import socket
import ssl
import stat
import threading
import urllib.error
import urllib.parse
import urllib.request
import uuid

from storage import ConflictError, ROOT, validate

DEFAULT_CONFIG = Path.home() / '.config/vitals/cloud.json'


class RemoteError(OSError):
    """A remote operation failed; callers must not report success or use local data."""


def load_config():
    path = Path(os.environ.get('VITALS_CLOUD_CONFIG') or DEFAULT_CONFIG).expanduser().resolve()
    config = {}
    if path.exists():
        if path.is_relative_to(ROOT):
            raise ValueError('云凭据文件必须放在项目目录外')
        info = path.stat()
        if os.name != 'nt' and (stat.S_IMODE(info.st_mode) & 0o077 or info.st_uid != os.getuid()):
            raise ValueError('云凭据文件必须由当前用户持有且权限为 600')
        config = json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(config, dict):
            raise ValueError('云凭据配置必须是对象')
    for key, env in (('url', 'VITALS_CLOUD_URL'), ('token', 'VITALS_CLOUD_TOKEN'),
                     ('connect_ip', 'VITALS_CLOUD_CONNECT_IP')):
        if env in os.environ:
            config[key] = os.environ[env]
    return config


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class _ConnectIPHTTPSHandler(urllib.request.HTTPSHandler):
    def __init__(self, address):
        super().__init__(context=ssl.create_default_context())
        self.address = str(ipaddress.ip_address(address))

    def https_open(self, req):
        address = self.address
        class Connection(http.client.HTTPSConnection):
            def connect(self):
                # TLS peer name and HTTP Host remain the URL hostname.
                self.sock = socket.create_connection((address, self.port), self.timeout, self.source_address)
                self.sock = self._context.wrap_socket(self.sock, server_hostname=self.host)
        return self.do_open(Connection, req, context=self._context)


class RemoteStore:
    remote = True

    def __init__(self, url=None, token=None, directory=None, *, timeout=20,
                 allow_loopback_http=False, connect_ip=None):
        if url is None or token is None:
            config = load_config()
            url = url or config.get('url')
            token = token or config.get('token')
            connect_ip = connect_ip or config.get('connect_ip')
        parsed = urllib.parse.urlsplit(url or '')
        loopback = parsed.hostname in ('localhost', '127.0.0.1', '::1')
        if (parsed.scheme != 'https' and not (allow_loopback_http and loopback and parsed.scheme == 'http')):
            raise ValueError('云服务必须使用 HTTPS；HTTP 仅允许显式启用的本机测试')
        if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError('云服务 URL 不得包含用户信息、查询参数或片段')
        if not isinstance(token, str) or not token.strip() or any(ord(c) < 33 or ord(c) > 126 for c in token):
            raise ValueError('需要云服务访问令牌')
        self.url = url.rstrip('/')
        if not self.url.endswith('/api/v1'):
            self.url += '/api/v1'
        self.token = token
        self.timeout = float(timeout)
        self.directory = Path(directory or os.environ.get('VITALS_DATA_DIR') or Path.home() / '.cache/vitals-cloud').resolve()
        # Compatibility metadata only; no code in this class opens this path.
        self.path = self.directory / 'health-data.json'
        self._lock = threading.RLock()
        handlers = [_NoRedirect(), urllib.request.ProxyHandler({})]
        if connect_ip:
            if parsed.scheme != 'https':
                raise ValueError('connect_ip 仅用于 HTTPS')
            handlers.append(_ConnectIPHTTPSHandler(connect_ip))
        self._opener = urllib.request.build_opener(*handlers)

    @contextmanager
    def lock(self):
        # Remote revision comparison arbitrates across processes/devices.
        with self._lock:
            yield

    def _request(self, method, endpoint, payload=None, *, raw=None, content_type=None, request_id=None):
        body = raw if raw is not None else (json.dumps(payload, ensure_ascii=False, allow_nan=False).encode('utf-8') if payload is not None else None)
        headers = {'Authorization': 'Bearer ' + self.token, 'Accept':'application/json'}
        if body is not None:
            headers['Content-Type'] = content_type or 'application/json'
        if request_id:
            headers['Idempotency-Key'] = request_id
        request = urllib.request.Request(self.url + endpoint, data=body, headers=headers, method=method)
        try:
            with self._opener.open(request, timeout=self.timeout) as response:
                result = json.loads(response.read(32 * 1024 * 1024).decode('utf-8'))
        except urllib.error.HTTPError as exc:
            exc.close()
            # Do not echo untrusted upstream text, URL or authorization credentials.
            if exc.code == 409:
                raise ConflictError('云端记录已更新；请重新读取后核对重试') from None
            raise RemoteError('云服务请求失败（HTTP %s）；本地数据未启用' % exc.code) from None
        except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
            raise RemoteError('云服务不可用或响应无效；未执行本地回退。写入超时需查询云端核对结果') from None
        if not isinstance(result, dict) or result.get('ok') is False:
            raise RemoteError('云服务返回失败或无效响应')
        return result

    def read(self):
        result = self._request('GET', '/data')
        return validate(result.get('data', result))

    def initialize(self):
        return self.read()

    def sync_proxy(self, data):
        # Browser data is served by the authenticated API, never by a local JS copy.
        return None

    def save(self, data, expected_revision):
        validate(data)
        if type(expected_revision) is not int or expected_revision < 0:
            raise ValueError('expected_revision 必须是非负整数')
        request_id = uuid.uuid4().hex
        result = self._request('PUT', '/data', {'data':data, 'expectedRevision':expected_revision,
                                               'requestId':request_id}, request_id=request_id)
        if 'data' in result or 'schemaVersion' in result:
            saved = validate(result.get('data', result))
        else:
            saved = copy.deepcopy(data)
            saved['meta']['revision'] = result.get('revision')
            validate(saved)
        if saved['meta']['revision'] != expected_revision + 1:
            raise RemoteError('云端未确认预期版本；请查询云端核对结果')
        return saved

    def upload_image(self, path):
        original = Path(path)
        extension = original.suffix.lower()
        if extension not in ('.png', '.jpg', '.jpeg', '.webp', '.heic', '.gif'):
            raise ValueError('仅支持图片附件 png/jpg/jpeg/webp/heic/gif')
        if original.stat().st_size > 20 * 1024 * 1024:
            raise ValueError('原始附件不能超过 20MB')
        raw = original.read_bytes()
        if len(raw) > 20 * 1024 * 1024:
            raise ValueError('原始附件不能超过 20MB')
        digest = hashlib.sha256(raw).hexdigest()
        boundary = 'vitals-' + uuid.uuid4().hex
        filename = digest + extension
        mime = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        body = ('--%s\r\nContent-Disposition: form-data; name="file"; filename="%s"\r\nContent-Type: %s\r\n\r\n' % (boundary, filename, mime)).encode() + raw + ('\r\n--%s--\r\n' % boundary).encode()
        result = self._request('POST', '/attachments', raw=body,
                               content_type='multipart/form-data; boundary=' + boundary, request_id=digest)
        logical = result.get('path') or result.get('photo')
        if logical not in {'attachments/' + digest + ext for ext in ('.png', '.jpg', '.webp')} or result.get('sha256') != digest:
            raise RemoteError('云端附件校验不一致；记录未保存')
        return logical, digest
