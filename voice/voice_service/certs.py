from __future__ import annotations

import os
import socket
import subprocess
from pathlib import Path


def ensure_certificate(directory: Path) -> tuple[Path, Path]:
    directory.mkdir(parents=True, exist_ok=True)
    cert = directory / "cert.pem"
    key = directory / "key.pem"
    dns, ips = certificate_names()
    if cert.is_file() and key.is_file() and cert.stat().st_size > 0 and key.stat().st_size > 0:
        if certificate_covers(cert, dns, ips):
            os.chmod(key, 0o600)
            return cert, key
        cert.unlink(missing_ok=True)
        key.unlink(missing_ok=True)
    config = directory / "openssl.cnf"
    config.write_text(openssl_config(dns, ips), encoding="utf-8")
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
            "-config",
            str(config),
        ],
        check=True,
        capture_output=True,
        shell=False,
    )
    config.unlink(missing_ok=True)
    os.chmod(key, 0o600)
    return cert, key


def certificate_names() -> tuple[list[str], list[str]]:
    return ["localhost", "bumpy-voice"], local_ips()


def local_ips() -> list[str]:
    ips = {"127.0.0.1"}
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            address = info[4][0]
            if isinstance(address, str) and address != "0.0.0.0":
                ips.add(address)
    except OSError:
        pass
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            probe.connect(("192.0.2.1", 9))
            address = probe.getsockname()[0]
            if isinstance(address, str) and address != "0.0.0.0":
                ips.add(address)
        finally:
            probe.close()
    except OSError:
        pass
    return sorted(ips)


def certificate_covers(cert: Path, dns: list[str], ips: list[str]) -> bool:
    try:
        result = subprocess.run(
            ["openssl", "x509", "-in", str(cert), "-noout", "-text"],
            check=False,
            capture_output=True,
            text=True,
            shell=False,
        )
    except OSError:
        return False
    text = result.stdout
    if result.returncode != 0 or "Subject Alternative Name" not in text:
        return False
    return all(name in text for name in dns) and all(ip in text for ip in ips)


def openssl_config(dns: list[str], ips: list[str]) -> str:
    lines = [
        "[req]",
        "distinguished_name = dn",
        "x509_extensions = v3_req",
        "prompt = no",
        "[dn]",
        "CN = bumpy-voice",
        "[v3_req]",
        "subjectAltName = @alt_names",
        "basicConstraints = CA:FALSE",
        "[alt_names]",
    ]
    for index, name in enumerate(dns, start=1):
        lines.append(f"DNS.{index} = {name}")
    for index, ip in enumerate(ips, start=1):
        lines.append(f"IP.{index} = {ip}")
    return "\n".join(lines) + "\n"
