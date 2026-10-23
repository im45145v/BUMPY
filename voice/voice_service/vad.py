from __future__ import annotations

import math


class EnergyVad:
    """20 ms frames. Two loud frames start speech. Eight quiet frames end it."""

    def __init__(self, threshold: float = 700.0) -> None:
        self.threshold = threshold
        self.active = False
        self.loud = 0
        self.quiet = 0
        self.heard: list[int] = []

    def feed(self, frame: list[int]) -> str | None:
        if rms(frame) >= self.threshold:
            self.quiet = 0
            self.loud += 1
            self.heard.extend(frame)
        else:
            self.loud = 0
            if self.active:
                self.quiet += 1
                self.heard.extend(frame)
        if not self.active and self.loud >= 2:
            self.active = True
            self.quiet = 0
            return "start"
        if self.active and (self.quiet >= 8 or len(self.heard) >= 16000 * 20):
            self.active = False
            self.loud = 0
            self.quiet = 0
            return "end"
        if not self.active and self.loud == 0:
            self.heard = []
        return None

    def take(self) -> list[int]:
        heard = self.heard
        self.heard = []
        return heard


def rms(frame: list[int]) -> float:
    if frame == []:
        return 0.0
    total = sum(sample * sample for sample in frame)
    return math.sqrt(total / len(frame))
