from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field
from pathlib import Path


class ConfigError(Exception):
    pass


@dataclass
class VoiceConfig:
    host: str = "0.0.0.0"
    https_port: int = 8443
    bridge_port: int = 8444
    token: str = ""
    cert_dir: Path = Path("certs")
    cloud_base_url: str = ""
    cloud_api_key: str = ""
    cloud_model: str = ""
    cloud_stt_model: str = "whisper-1"
    cloud_tts_model: str = "tts-1"
    cloud_voice: str = "alloy"
    local_base_url: str = "http://127.0.0.1:8080/v1"
    local_model: str = "local"
    local_argv: list[str] = field(default_factory=list)
    whisper_argv: list[str] = field(default_factory=list)
    piper_argv: list[str] = field(default_factory=list)
    files_root: Path | None = None
    scripts: dict[str, list[str]] = field(default_factory=dict)
    script_timeout: float = 10.0
    bridge_timeout: float = 20.0


def load_config(environ: dict[str, str] | None = None) -> VoiceConfig:
    env = os.environ if environ is None else environ
    return VoiceConfig(
        host=text(env, "VOICE_HOST", "0.0.0.0"),
        https_port=port(env, "VOICE_PORT", 8443),
        bridge_port=port(env, "VOICE_BRIDGE_PORT", 8444),
        token=text(env, "VOICE_TOKEN", ""),
        cert_dir=Path(text(env, "VOICE_CERT_DIR", "certs")),
        cloud_base_url=text(env, "VOICE_CLOUD_BASE_URL", "").rstrip("/"),
        cloud_api_key=text(env, "VOICE_CLOUD_API_KEY", ""),
        cloud_model=text(env, "VOICE_CLOUD_MODEL", ""),
        cloud_stt_model=text(env, "VOICE_CLOUD_STT_MODEL", "whisper-1"),
        cloud_tts_model=text(env, "VOICE_CLOUD_TTS_MODEL", "tts-1"),
        cloud_voice=text(env, "VOICE_CLOUD_VOICE", "alloy"),
        local_base_url=text(env, "VOICE_LOCAL_BASE_URL", "http://127.0.0.1:8080/v1").rstrip("/"),
        local_model=text(env, "VOICE_LOCAL_MODEL", "local"),
        local_argv=json_strings(text(env, "VOICE_LOCAL_ARGV", ""), "VOICE_LOCAL_ARGV"),
        whisper_argv=json_strings(text(env, "VOICE_WHISPER_ARGV", ""), "VOICE_WHISPER_ARGV"),
        piper_argv=json_strings(text(env, "VOICE_PIPER_ARGV", ""), "VOICE_PIPER_ARGV"),
        files_root=folder(text(env, "VOICE_FILES_ROOT", "")),
        scripts=json_scripts(text(env, "VOICE_SCRIPTS", "")),
        script_timeout=number(env, "VOICE_SCRIPT_TIMEOUT", 10.0),
        bridge_timeout=number(env, "VOICE_BRIDGE_TIMEOUT", 20.0),
    )


def folder(raw: str) -> Path | None:
    if raw == "":
        return None
    return Path(raw)


def text(env: dict[str, str], name: str, default: str) -> str:
    value = env.get(name, default)
    return value.strip() if isinstance(value, str) else default


def port(env: dict[str, str], name: str, default: int) -> int:
    raw = text(env, name, str(default))
    try:
        value = int(raw)
    except ValueError as error:
        raise ConfigError(f"{name} must be a port number.") from error
    if value < 0 or value > 65535:
        raise ConfigError(f"{name} must be a port number.")
    return value


def number(env: dict[str, str], name: str, default: float) -> float:
    raw = text(env, name, str(default))
    try:
        value = float(raw)
    except ValueError as error:
        raise ConfigError(f"{name} must be a number.") from error
    if value <= 0 or value > 120:
        raise ConfigError(f"{name} must be a number of seconds.")
    return value


def json_strings(raw: str, label: str) -> list[str]:
    if raw == "":
        return []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ConfigError(f"{label} must be a JSON list of strings.") from error
    if not isinstance(parsed, list) or any(not isinstance(item, str) or item == "" for item in parsed):
        raise ConfigError(f"{label} must be a JSON list of strings.")
    return list(parsed)


def json_scripts(raw: str) -> dict[str, list[str]]:
    if raw == "":
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ConfigError("VOICE_SCRIPTS must be a JSON object.") from error
    if not isinstance(parsed, dict):
        raise ConfigError("VOICE_SCRIPTS must be a JSON object.")
    scripts: dict[str, list[str]] = {}
    for name, argv in parsed.items():
        if not isinstance(name, str) or re.fullmatch(r"[a-z0-9-]{1,40}", name) is None:
            raise ConfigError("Script names use lowercase letters, numbers, and hyphens.")
        if (
            not isinstance(argv, list)
            or argv == []
            or any(not isinstance(part, str) or part == "" for part in argv)
        ):
            raise ConfigError(f"Script {name} must be a JSON list of strings.")
        scripts[name] = list(argv)
    return scripts
