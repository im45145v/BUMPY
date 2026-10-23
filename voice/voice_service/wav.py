from __future__ import annotations

import io
import math
import struct
import wave
from pathlib import Path


def read_wav(data: bytes) -> tuple[int, list[int]]:
    with wave.open(io.BytesIO(data)) as source:
        rate = source.getframerate()
        channels = source.getnchannels()
        width = source.getsampwidth()
        frames = source.readframes(source.getnframes())
    if width != 2 or rate <= 0 or channels <= 0:
        raise ValueError("The audio must be 16-bit PCM.")
    count = len(frames) // 2
    samples = list(struct.unpack("<" + "h" * count, frames[: count * 2]))
    if channels == 1:
        return rate, samples
    mono: list[int] = []
    for index in range(0, len(samples) - channels + 1, channels):
        mono.append(int(sum(samples[index : index + channels]) / channels))
    return rate, mono


def write_wav(samples: list[int], rate: int) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(rate)
        target.writeframes(struct.pack("<" + "h" * len(samples), *clamp(samples)))
    return buffer.getvalue()


def resample(samples: list[int], source_rate: int, target_rate: int) -> list[int]:
    if source_rate <= 0 or target_rate <= 0 or samples == []:
        return []
    if source_rate == target_rate:
        return list(samples)
    out_length = max(1, int(len(samples) * target_rate / source_rate))
    output: list[int] = []
    last = len(samples) - 1
    for index in range(out_length):
        position = min(last, int(index * source_rate / target_rate))
        output.append(samples[position])
    return output


def to_pcm48(data: bytes) -> bytes:
    rate, samples = read_wav(data)
    converted = resample(samples, rate, 48000)
    return struct.pack("<" + "h" * len(converted), *clamp(converted))


def tone_wav(seconds: float = 0.35, frequency: float = 440.0) -> bytes:
    rate = 16000
    count = int(rate * seconds)
    samples = [
        int(6000 * math.sin(2 * math.pi * frequency * index / rate)) for index in range(count)
    ]
    return write_wav(samples, rate)


def greeting_wav() -> bytes:
    path = Path(__file__).with_name("greeting.wav")
    if path.is_file() and path.stat().st_size > 44:
        return path.read_bytes()
    return tone_wav()


def clamp(samples: list[int]) -> list[int]:
    return [max(-32768, min(32767, int(sample))) for sample in samples]
