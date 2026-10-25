from __future__ import annotations

import threading

from .app import build_app
from .certs import ensure_certificate
from .config import ConfigError, load_config
from .server import TlsServer, handler_for, start


def main() -> None:
    try:
        config = load_config()
    except ConfigError as error:
        raise SystemExit(str(error)) from error
    if config.token == "":
        raise SystemExit("Set VOICE_TOKEN in the service environment.")
    app = build_app(config)
    cert, key = ensure_certificate(config.cert_dir)
    call = TlsServer((config.host, config.https_port), handler_for("call"), app, str(cert), str(key))
    bridge = TlsServer((config.host, config.bridge_port), handler_for("bridge"), app, str(cert), str(key))
    start(call)
    start(bridge)
    print(f"Call: https://{config.host}:{config.https_port}", flush=True)
    print(f"Bridge: https://{config.host}:{config.bridge_port}", flush=True)
    if config.host in {"0.0.0.0", "::"}:
        print(
            "This board is open to the network. Set VOICE_HOST=127.0.0.1 to keep it on this computer.",
            flush=True,
        )
    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        app.close()
        call.shutdown()
        bridge.shutdown()


if __name__ == "__main__":
    main()
