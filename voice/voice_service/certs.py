from __future__ import annotations

import subprocess
from pathlib import Path


def ensure_certificate(directory: Path) -> tuple[Path, Path]:
    directory.mkdir(parents=True, exist_ok=True)
    cert = directory / "cert.pem"
    key = directory / "key.pem"
    if cert.is_file() and key.is_file() and cert.stat().st_size > 0 and key.stat().st_size > 0:
        return cert, key
    subprocess.run(
        [
            "openssl",
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-keyout",
            str(key),
            "-out",
            str(cert),
            "-days",
            "825",
            "-nodes",
            "-subj",
            "/CN=bumpy-voice",
        ],
        check=True,
        capture_output=True,
        shell=False,
    )
    return cert, key
