#!/usr/bin/env python3
"""只监听本机的面板服务；运行时数据由 storage.Store 管理。"""
import argparse
import json
import mimetypes
from pathlib import Path
import secrets
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

from storage import create_store, ConflictError, now_iso

ROOT = Path(__file__).resolve().parent
MAX_BODY = 8 * 1024 * 1024


class Handler(BaseHTTPRequestHandler):
    server_version = "VITALS/0.1"

    def log_message(self, fmt, *args):
        # 不把图片内容、记录正文或完整查询参数写入服务日志。
        sys.stderr.write("%s %s\n" % (self.command, self.path.split("?", 1)[0]))

    def _host_ok(self):
        return self.headers.get("Host", "") in self.server.allowed_hosts

    def _send(self, status, body, content_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status, value):
        self._send(status, json.dumps(value, ensure_ascii=False, allow_nan=False).encode("utf-8"))

    def do_GET(self):
        if not self._host_ok() or self.headers.get("Sec-Fetch-Site") == "cross-site":
            return self._json(403, {"ok": False, "error": "仅接受本机同源请求"})
        path = unquote(urlparse(self.path).path)
        if path == "/api/ping":
            return self._json(200, {"ok": True, "mode": "read-write", "serverTime": now_iso(), "csrfToken": self.server.csrf_token})
        if path == "/api/data":
            try:
                return self._json(200, self.server.store.read())
            except (OSError, ValueError) as exc:
                return self._json(500, {"ok": False, "error": str(exc)})
        if path == "/":
            path = "/index.html"
        allowed = path in ("/index.html", "/templates/demo-data.json") or (path.startswith("/assets/") and path.endswith((".css", ".js", ".svg")))
        target = (ROOT / path.lstrip("/")).resolve()
        if not allowed or not target.is_relative_to(ROOT) or not target.is_file() or ".." in path.split("/"):
            return self._json(404, {"ok": False, "error": "not found"})
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if mime.startswith("text/") or mime in ("application/javascript", "application/json"):
            mime += "; charset=utf-8"
        return self._send(200, target.read_bytes(), mime)

    do_HEAD = do_GET

    def do_PUT(self):
        if not self._host_ok() or self.headers.get("Origin") not in self.server.allowed_origins:
            return self._json(403, {"ok": False, "error": "拒绝非同源写入"})
        token = self.headers.get("X-Vitals-Token", "")
        if not secrets.compare_digest(token, self.server.csrf_token):
            return self._json(403, {"ok": False, "error": "缺少有效的本机会话令牌，请刷新页面"})
        if urlparse(self.path).path != "/api/data":
            return self._json(404, {"ok": False, "error": "not found"})
        if self.headers.get("Content-Type", "").split(";", 1)[0].strip() != "application/json":
            return self._json(415, {"ok": False, "error": "仅接受 application/json"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if not 0 < length <= MAX_BODY:
                raise ValueError("请求体为空或超过 8MB")
            self.connection.settimeout(10)
            raw = self.rfile.read(length)
            if len(raw) != length:
                raise ValueError("请求体不完整")
            data = json.loads(raw.decode("utf-8"))
            revision = data.get("meta", {}).get("revision") if isinstance(data, dict) else None
            saved = self.server.store.save(data, revision)
        except ConflictError as exc:
            return self._json(409, {"ok": False, "error": str(exc)})
        except (ValueError, TypeError, AttributeError) as exc:
            return self._json(400, {"ok": False, "error": str(exc)})
        except (OSError, TimeoutError) as exc:
            return self._json(500, {"ok": False, "error": str(exc)})
        return self._json(200, {"ok": True, "revision": saved["meta"]["revision"], "savedAt": saved["meta"]["updatedAt"]})

    do_POST = do_PUT


def create_server(port, store=None):
    store = store or create_store()
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    server.store = store
    server.csrf_token = secrets.token_urlsafe(32)
    server.allowed_hosts = {"127.0.0.1:%d" % server.server_port, "localhost:%d" % server.server_port}
    server.allowed_origins = {"http://" + host for host in server.allowed_hosts}
    return server


def main():
    parser = argparse.ArgumentParser(description="VITALS 本地面板")
    parser.add_argument("--port", type=int, default=8931)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()
    if not 0 <= args.port <= 65506:
        parser.error("端口范围为 0..65506")
    store = create_store()
    try:
        store.initialize()
    except (OSError, ValueError) as exc:
        parser.exit(1, "初始化失败：%s\n" % exc)
    httpd = None
    for port in range(args.port, args.port + 30):
        try:
            httpd = create_server(port, store)
            break
        except OSError as exc:
            import errno
            if exc.errno not in (errno.EADDRINUSE, 10048):
                raise
    if httpd is None:
        parser.exit(1, "找不到可用端口\n")
    url = "http://127.0.0.1:%d/" % httpd.server_port
    source = "云端（不读取本地数据文件）" if getattr(store, "remote", False) else str(store.path)
    print("VITALS 面板：%s\n数据来源：%s\n停止：Ctrl+C" % (url, source), flush=True)
    if not args.no_open:
        import webbrowser
        threading.Timer(.5, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    main()
