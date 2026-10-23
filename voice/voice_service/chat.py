from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from typing import Any, Callable

from .local_process import LocalProcess

Transport = Callable[[str, str, dict[str, str], bytes | None, float], tuple[int, bytes]]


class CloudError(Exception):
    pass


class Endpoint:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        transport: Transport,
        stt_model: str = "whisper-1",
        tts_model: str = "tts-1",
        voice: str = "alloy",
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.transport = transport
        self.stt_model = stt_model
        self.tts_model = tts_model
        self.voice = voice
        self._healthy = False
        self._healthy_until = 0.0

    def healthy(self, now: float | None = None) -> bool:
        if self.base_url == "":
            return False
        current = time.monotonic() if now is None else now
        if current < self._healthy_until:
            return self._healthy
        try:
            status, _body = self.transport("GET", join_url(self.base_url, "models"), self.headers(), None, 2)
            self._healthy = 200 <= status < 300
        except Exception:
            self._healthy = False
        self._healthy_until = current + 15
        return self._healthy

    def complete(self, messages: list[dict[str, str]]) -> str:
        status, body = self._post(
            "chat/completions",
            {"model": self.model, "messages": messages},
        )
        if status == 401 or status == 403:
            raise CloudError("The model key was refused.")
        if status < 200 or status >= 300:
            raise CloudError("The model request failed.")
        try:
            payload = json.loads(body.decode())
            text = payload["choices"][0]["message"]["content"]
        except (json.JSONDecodeError, KeyError, IndexError, TypeError) as error:
            raise CloudError("The model returned an empty reply.") from error
        if not isinstance(text, str) or text.strip() == "":
            raise CloudError("The model returned an empty reply.")
        return text.strip()

    def transcribe(self, wav: bytes) -> str:
        content, content_type = multipart(
            {"model": self.stt_model},
            {"file": ("speech.wav", wav, "audio/wav")},
        )
        status, body = self.transport(
            "POST",
            join_url(self.base_url, "audio/transcriptions"),
            {**self.headers(), "Content-Type": content_type},
            content,
            60,
        )
        if status < 200 or status >= 300:
            raise CloudError("The transcriber failed.")
        try:
            payload = json.loads(body.decode())
        except json.JSONDecodeError as error:
            raise CloudError("The transcriber failed.") from error
        text = payload.get("text") if isinstance(payload, dict) else ""
        if not isinstance(text, str):
            raise CloudError("The transcriber failed.")
        return text.strip()[:500]

    def synthesize(self, text: str) -> bytes:
        status, body = self._post(
            "audio/speech",
            {
                "model": self.tts_model,
                "voice": self.voice or "alloy",
                "input": text[:500],
                "response_format": "wav",
            },
        )
        if status < 200 or status >= 300 or not body.startswith(b"RIFF"):
            raise CloudError("The voice failed.")
        return body

    def headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _post(self, path: str, payload: dict[str, Any]) -> tuple[int, bytes]:
        try:
            return self.transport(
                "POST",
                join_url(self.base_url, path),
                self.headers(),
                json.dumps(payload).encode(),
                60,
            )
        except Exception as error:
            raise CloudError("The model request failed.") from error


class HybridChat:
    def __init__(self, cloud: Endpoint, local: Endpoint, process: LocalProcess) -> None:
        self.cloud = cloud
        self.local = local
        self.process = process
        self.last_route = ""

    def complete(self, messages: list[dict[str, str]]) -> str:
        if self.cloud.healthy():
            try:
                text = self.cloud.complete(messages)
                self.last_route = "cloud"
                return text
            except CloudError:
                pass
        if self.process.ensure():
            self.wait_for_local()
        self.last_route = "local"
        return self.local.complete(messages)

    def wait_for_local(self, timeout: float = 30) -> None:
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            self.local._healthy_until = 0
            if self.local.healthy():
                return
            time.sleep(0.05)


def join_url(base: str, path: str) -> str:
    return base.rstrip("/") + "/" + path.lstrip("/")


def urllib_transport(
    method: str,
    url: str,
    headers: dict[str, str],
    body: bytes | None,
    timeout: float,
) -> tuple[int, bytes]:
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        return error.code, error.read()


def multipart(
    fields: dict[str, str],
    files: dict[str, tuple[str, bytes, str]],
) -> tuple[bytes, str]:
    boundary = "bumpyvoiceboundary"
    chunks: list[bytes] = []
    for name, value in fields.items():
        chunks.append(
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"\r\n\r\n{value}\r\n".encode()
        )
    for name, (filename, data, content_type) in files.items():
        chunks.append(
            (
                f"--{boundary}\r\n"
                f"Content-Disposition: form-data; name=\"{name}\"; filename=\"{filename}\"\r\n"
                f"Content-Type: {content_type}\r\n\r\n"
            ).encode()
            + data
            + b"\r\n"
        )
    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"
