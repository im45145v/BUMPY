from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path
from typing import Any, Callable

from .chat import CloudError, Endpoint
from .wav import tone_wav

Runner = Callable[..., Any]


class SpeechError(Exception):
    pass


class CommandVoice:
    def __init__(self, argv: list[str], runner: Runner | None = None) -> None:
        self.argv = argv
        self.runner = subprocess.run if runner is None else runner

    @property
    def configured(self) -> bool:
        return self.argv != []

    def transcribe(self, wav: bytes) -> str:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "in.wav"
            path.write_bytes(wav)
            result = self._run(path, None)
            sidecar = Path(str(path) + ".txt")
            if not sidecar.exists():
                sidecar = path.with_suffix(".txt")
            if sidecar.exists():
                return sidecar.read_text(encoding="utf-8", errors="replace").strip()[:500]
            return result.stdout.decode("utf-8", errors="replace").strip()[:500]

    def synthesize(self, text: str) -> bytes:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "out.wav"
            self._run(path, text.encode())
            if not path.is_file():
                raise SpeechError("The local voice failed.")
            return path.read_bytes()

    def _run(self, path: Path, stdin: bytes | None) -> Any:
        argv = [part.replace("{wav}", str(path)) for part in self.argv]
        try:
            result = self.runner(
                argv,
                shell=False,
                capture_output=True,
                timeout=60,
                check=False,
                input=stdin,
            )
        except subprocess.TimeoutExpired as error:
            raise SpeechError("The local voice took too long.") from error
        if result.returncode != 0:
            raise SpeechError("The local voice failed.")
        return result


class HybridSpeech:
    def __init__(self, cloud: Endpoint, whisper: CommandVoice, piper: CommandVoice) -> None:
        self.cloud = cloud
        self.whisper = whisper
        self.piper = piper
        self.last_route = ""

    def transcribe(self, wav: bytes) -> str:
        if self.cloud.healthy():
            try:
                text = self.cloud.transcribe(wav)
                self.last_route = "cloud"
                return text
            except CloudError:
                pass
        if not self.whisper.configured:
            raise SpeechError("The local transcriber is not set up.")
        self.last_route = "local"
        return self.whisper.transcribe(wav)

    def synthesize(self, text: str) -> bytes:
        if self.cloud.healthy():
            try:
                wav = self.cloud.synthesize(text)
                self.last_route = "cloud"
                return wav
            except CloudError:
                pass
        if self.piper.configured:
            self.last_route = "local"
            return self.piper.synthesize(text)
        self.last_route = "tone"
        return tone_wav()
