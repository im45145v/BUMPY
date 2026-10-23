from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any, Callable


class JobQueue:
    """Vault jobs wait here until Obsidian polls and posts a result."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._pending: list[Job] = []
        self._waiters: dict[str, threading.Event] = {}
        self._results: dict[str, dict[str, Any]] = {}

    def submit(
        self,
        name: str,
        arguments: dict[str, Any],
        timeout: float,
        cancel: Callable[[], bool],
    ) -> dict[str, Any]:
        job = Job(id=uuid.uuid4().hex, name=name, arguments=arguments)
        event = threading.Event()
        with self._lock:
            self._pending.append(job)
            self._waiters[job.id] = event
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if cancel():
                self._forget(job.id)
                return {"ok": False, "error": "The caller interrupted."}
            if event.wait(0.05):
                with self._lock:
                    result = self._results.pop(job.id, {"ok": False, "error": "The vault job failed."})
                return result
        self._forget(job.id)
        return {"ok": False, "error": "Obsidian is not reachable."}

    def next_job(self) -> dict[str, Any] | None:
        with self._lock:
            if self._pending == []:
                return None
            job = self._pending[0]
        return {"id": job.id, "name": job.name, "arguments": job.arguments}

    def complete(self, job_id: str, result: dict[str, Any]) -> bool:
        with self._lock:
            event = self._waiters.pop(job_id, None)
            self._pending = [job for job in self._pending if job.id != job_id]
            if event is None:
                return False
            self._results[job_id] = result
        event.set()
        return True

    def _forget(self, job_id: str) -> None:
        with self._lock:
            self._waiters.pop(job_id, None)
            self._pending = [job for job in self._pending if job.id != job_id]


@dataclass
class Job:
    id: str
    name: str
    arguments: dict[str, Any]
