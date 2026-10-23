from __future__ import annotations

import json
import ssl
import subprocess
import threading
import time
import urllib.request
from pathlib import Path

from voice_service.app import build_app
from voice_service.certs import ensure_certificate
from voice_service.config import ConfigError, VoiceConfig, load_config
from voice_service.server import TlsServer, handler_for, start
from voice_service.wav import greeting_wav, read_wav


class FakePeer:
    def __init__(self) -> None:
        self.offers: list[str] = []
        self.hung = False

    def offer(self, sdp: str, sdp_type: str) -> tuple[str, str]:
        self.offers.append(sdp)
        return "answer-sdp", "answer"

    def hangup(self) -> None:
        self.hung = True


def make_app(token: str = "secret-token") -> tuple[object, FakePeer]:
    peer = FakePeer()
    config = VoiceConfig(token=token, files_root=Path())
    return build_app(config, peer=peer), peer


def auth(token: str = "secret-token") -> dict[str, str]:
    return {"authorization": f"Bearer {token}"}


def offer(app, token: str = "secret-token"):
    body = json.dumps({"sdp": "v=0", "type": "offer"}).encode()
    return app.dispatch("POST", "/call", auth(token), body, "call")


def test_page_is_a_call_screen_without_the_token() -> None:
    app, _peer = make_app()
    page = app.dispatch("GET", "/", {}, b"", "call")
    assert page.status == 200
    assert b">Call<" in page.body
    assert b">Hang up<" in page.body
    assert b"secret-token" not in page.body
    assert b"iceServers: []" in page.body


def test_greeting_is_a_spoken_sentence() -> None:
    rate, samples = read_wav(greeting_wav())
    assert rate == 16000
    assert len(samples) / rate > 0.5


def test_one_call_plays_the_greeting_and_hangup_frees_it() -> None:
    app, peer = make_app()
    first = offer(app)
    assert first.status == 200
    assert json.loads(first.body)["type"] == "answer"
    assert peer.offers == ["v=0"]
    assert app.playback.pending() > 0
    assert app.caption.get() == "Bumpy is on the call."
    assert offer(app).status == 409
    hung = app.dispatch("POST", "/call/hangup", auth(), b"", "call")
    assert hung.status == 200
    assert peer.hung is True
    assert app.playback.pending() == 0
    assert offer(app).status == 200


def test_call_requires_the_token() -> None:
    app, _peer = make_app()
    assert offer(app, token="nope").status == 401
    empty, _peer = make_app(token="")
    assert offer(empty).status == 401


def test_plain_bridge_does_not_serve_the_call() -> None:
    app, _peer = make_app()
    assert app.dispatch("POST", "/call", auth(), b"{}", "bridge").status == 404
    assert app.dispatch("GET", "/health", {}, b"", "bridge").status == 200


def test_bridge_tls_round_trip(tmp_path: Path) -> None:
    app, _peer = make_app()
    cert, key = ensure_certificate(tmp_path / "bridge")
    httpd = start(TlsServer(("127.0.0.1", 0), handler_for("bridge"), app, str(cert), str(key)))
    port = httpd.server_address[1]
    context = ssl._create_unverified_context()
    found: dict[str, object] = {}

    def wait() -> None:
        found["value"] = app.bridge.submit("vault.tasks", {}, 3, lambda: False)

    thread = threading.Thread(target=wait)
    thread.start()
    job = None
    for _ in range(50):
        job = get_json(port, "/bridge/jobs", context)
        if job.get("job"):
            break
        time.sleep(0.02)
    assert job is not None and job["job"]["name"] == "vault.tasks"
    post_json(port, f"/bridge/jobs/{job['job']['id']}", {"ok": True, "result": "No open tasks."}, context)
    thread.join(timeout=3)
    assert found["value"]["result"] == "No open tasks."
    httpd.shutdown()
    httpd.server_close()


def test_drop_clears_the_preview() -> None:
    app, _peer = make_app()
    app.conversation.tools.pending.store({"path": "Home.md", "original": "old", "proposed": "new"})
    response = app.dispatch("POST", "/bridge/preview/drop", auth(), b"{}", "bridge")
    assert response.status == 200
    assert app.conversation.tools.has_pending() is False


def test_certificate_names_localhost(tmp_path: Path) -> None:
    cert, key = ensure_certificate(tmp_path)
    assert key.stat().st_mode & 0o777 == 0o600
    text = subprocess.check_output(
        ["openssl", "x509", "-in", str(cert), "-noout", "-text"],
        text=True,
    )
    assert "localhost" in text
    assert "127.0.0.1" in text


def test_https_page_loads(tmp_path: Path) -> None:
    app, _peer = make_app()
    cert, key = ensure_certificate(tmp_path)
    httpd = start(TlsServer(("127.0.0.1", 0), handler_for("call"), app, str(cert), str(key)))
    port = httpd.server_address[1]
    context = ssl._create_unverified_context()
    with urllib.request.urlopen(f"https://127.0.0.1:{port}/", context=context, timeout=3) as response:
        body = response.read()
    assert b">Call<" in body
    httpd.shutdown()
    httpd.server_close()


def test_config_reads_allow_listed_scripts() -> None:
    config = load_config(
        {
            "VOICE_TOKEN": "t",
            "VOICE_SCRIPTS": '{"ping": ["python3", "ping.py"]}',
            "VOICE_LOCAL_ARGV": '["llama-server", "-m", "small"]',
        }
    )
    assert config.scripts["ping"] == ["python3", "ping.py"]
    assert config.local_argv[0] == "llama-server"
    assert load_config({"VOICE_TOKEN": "t"}).files_root is None
    assert load_config({"VOICE_TOKEN": "t", "VOICE_FILES_ROOT": "/tmp/bumpy-notes"}).files_root == Path(
        "/tmp/bumpy-notes"
    )
    try:
        load_config({"VOICE_SCRIPTS": "[]"})
    except ConfigError as error:
        assert "VOICE_SCRIPTS" in str(error)
    else:
        raise AssertionError("expected a config error")


def get_json(port: int, path: str, context: ssl.SSLContext) -> dict:
    request = urllib.request.Request(
        f"https://127.0.0.1:{port}{path}",
        headers={"Authorization": "Bearer secret-token"},
    )
    with urllib.request.urlopen(request, context=context, timeout=2) as response:
        return json.loads(response.read().decode())


def post_json(port: int, path: str, payload: dict, context: ssl.SSLContext) -> None:
    request = urllib.request.Request(
        f"https://127.0.0.1:{port}{path}",
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer secret-token", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, context=context, timeout=2) as response:
        assert response.status == 200
