from __future__ import annotations

import threading
import wave

from .wav import to_pcm48


class Playback:
    """16-bit mono PCM at 48 kHz. Silence fills the gaps between sentences."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.pcm = bytearray()

    def enqueue_wav(self, wav: bytes, generation: int, gate: TurnGate) -> None:
        try:
            pcm = to_pcm48(wav)
        except (ValueError, EOFError, wave.Error, struct_error()):
            return
        with self.lock:
            if not gate.current(generation):
                return
            self.pcm.extend(pcm)

    def read(self, samples: int) -> bytes:
        need = samples * 2
        with self.lock:
            take = bytes(self.pcm[:need])
            del self.pcm[:need]
        if len(take) < need:
            take += bytes(need - len(take))
        return take

    def pending(self) -> int:
        with self.lock:
            return len(self.pcm) // 2

    def clear(self) -> None:
        with self.lock:
            self.pcm.clear()


class TurnGate:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.generation = 0
        self.speaking = False

    def begin(self) -> int:
        with self.lock:
            return self.generation

    def current(self, generation: int) -> bool:
        with self.lock:
            return generation == self.generation

    def interrupt(self) -> None:
        with self.lock:
            self.generation += 1
            self.speaking = False

    def set_speaking(self, value: bool) -> None:
        with self.lock:
            self.speaking = value

    def is_speaking(self) -> bool:
        with self.lock:
            return self.speaking

    def clear_speaking(self, generation: int) -> None:
        with self.lock:
            if self.generation == generation:
                self.speaking = False


def barge_in(playback: Playback, gate: TurnGate) -> None:
    with playback.lock:
        playback.pcm.clear()
        gate.interrupt()


def struct_error() -> type[BaseException]:
    import struct

    return struct.error
