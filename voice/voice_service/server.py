from __future__ import annotations

import ssl
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

from .app import App


class QuietHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "BumpyVoice"
    surface = "call"

    def do_GET(self) -> None:
        self.respond()

    def do_POST(self) -> None:
        self.respond()

    def respond(self) -> None:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length < 0 or length > 200_000:
            self.reply(413, b"The request was too large.", "text/plain; charset=utf-8")
            return
        body = self.rfile.read(length) if length else b""
        path = urlsplit(self.path).path or "/"
        headers = {key.lower(): value for key, value in self.headers.items()}
        app: App = self.server.app  # type: ignore[attr-defined]
        response = app.dispatch(self.command, path, headers, body, self.surface)
        self.reply(response.status, response.body, response.content_type)

    def reply(self, status: int, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:
        return


def handler_for(surface: str) -> type[QuietHandler]:
    class SurfaceHandler(QuietHandler):
        pass

    SurfaceHandler.surface = surface
    return SurfaceHandler


class Serving(ThreadingHTTPServer):
    allow_reuse_address = True
    app: App

    def __init__(self, address: tuple[str, int], handler: type[QuietHandler], app: App) -> None:
        super().__init__(address, handler)
        self.app = app


class TlsServer(Serving):
    def __init__(
        self,
        address: tuple[str, int],
        handler: type[QuietHandler],
        app: App,
        cert: str,
        key: str,
    ) -> None:
        super().__init__(address, handler, app)
        self.ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        self.ssl_context.load_cert_chain(certfile=cert, keyfile=key)

    def get_request(self) -> tuple:
        sock, address = super().get_request()
        return self.ssl_context.wrap_socket(sock, server_side=True), address


def start(server: ThreadingHTTPServer) -> ThreadingHTTPServer:
    thread = threading.Thread(target=server.serve_forever, name="bumpy-http", daemon=True)
    thread.start()
    return server
