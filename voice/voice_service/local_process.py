from __future__ import annotations

import subprocess
from typing import Any, Callable


class LocalProcess:
    """Starts llama.cpp only when a cloud call has already failed."""

    def __init__(self, argv: list[str], spawn: Callable[..., Any] | None = None) -> None:
        self.argv = argv
        self.spawn = subprocess.Popen if spawn is None else spawn
        self.proc: Any = None

    def ensure(self) -> bool:
        """Start the local server when it is not running. True means this call started it."""
        if self.argv == []:
            return False
        if self.proc is not None and self.proc.poll() is None:
            return False
        self.proc = self.spawn(
            self.argv,
            shell=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return True

    def stop(self) -> None:
        if self.proc is not None and self.proc.poll() is None:
            self.proc.terminate()
            self.proc = None
