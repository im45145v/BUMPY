from __future__ import annotations

import threading


class Busy(Exception):
    pass


class CallSession:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.open = False

    def begin(self) -> None:
        with self._lock:
            if self.open:
                raise Busy()
            self.open = True

    def hangup(self) -> None:
        with self._lock:
            self.open = False

    def is_open(self) -> bool:
        with self._lock:
            return self.open
