from __future__ import annotations

import subprocess
import threading
import time
from pathlib import Path
from types import SimpleNamespace

import pytest

from voice_service.bridge_queue import JobQueue
from voice_service.files import FileSandbox, ToolError
from voice_service.playback import Playback, TurnGate, barge_in
from voice_service.tools import ToolTable, agrees, discards
from voice_service.vad import EnergyVad
from voice_service.wav import resample, tone_wav


def test_vad_marks_a_phrase() -> None:
    vad = EnergyVad(threshold=100)
    quiet = [0] * 320
    loud = [8000] * 320
    assert vad.feed(loud) is None
    assert vad.feed(loud) == "start"
    for _ in range(7):
        assert vad.feed(quiet) is None
    assert vad.feed(quiet) == "end"
    assert len(vad.take()) > 320


def test_barge_in_clears_audio_and_drops_a_late_sentence() -> None:
    playback = Playback()
    gate = TurnGate()
    generation = gate.begin()
    playback.enqueue_wav(tone_wav(), generation, gate)
    assert playback.pending() > 0
    barge_in(playback, gate)
    playback.enqueue_wav(tone_wav(), generation, gate)
    assert playback.pending() == 0
    assert not gate.current(generation)


def test_resample_stretches_16k_to_48k() -> None:
    assert len(resample([1, 2, 3, 4], 16000, 48000)) == 12


def test_files_stay_in_the_folder_and_scripts_have_no_shell(tmp_path: Path) -> None:
    root = tmp_path / "files"
    root.mkdir()
    (root / "note.txt").write_text("hello", encoding="utf-8")
    outside = tmp_path / "secret.txt"
    outside.write_text("nope", encoding="utf-8")
    (root / "link.txt").symlink_to(outside)
    seen: list[tuple] = []

    def runner(argv, **kwargs):
        seen.append((argv, kwargs))
        return SimpleNamespace(returncode=0, stdout=b"pong\n", stderr=b"")

    sandbox = FileSandbox(root, {"ping": ["python3", "ping.py"]}, runner=runner)
    assert "note.txt" in sandbox.list_dir(".")
    assert sandbox.read_file("note.txt") == "hello"
    with pytest.raises(ToolError, match="outside"):
        sandbox.read_file("../secret.txt")
    with pytest.raises(ToolError, match="invalid"):
        sandbox.read_file("/etc/passwd")
    with pytest.raises(ToolError, match="outside"):
        sandbox.read_file("link.txt")
    assert sandbox.run_script("ping", "once") == "pong"
    assert seen[0][0] == ["python3", "ping.py"]
    assert seen[0][1]["env"]["BUMPY_ARGUMENT"] == "once"
    assert seen[0][1]["shell"] is False
    assert seen[0][1]["cwd"] == str(root.resolve())
    with pytest.raises(ToolError, match="not allowed"):
        sandbox.run_script("rm", "")

    def expire(argv, **kwargs):
        raise subprocess.TimeoutExpired(argv, 10)

    limited = FileSandbox(root, {"ping": ["python3", "ping.py"]}, timeout=0.1, runner=expire)
    with pytest.raises(ToolError, match="too long"):
        limited.run_script("ping", "")
    with pytest.raises(ToolError, match="not available"):
        FileSandbox(tmp_path / "missing", {}).list_dir(".")
    closed = FileSandbox(None, {"ping": ["python3", "ping.py"]})
    with pytest.raises(ToolError, match="not available"):
        closed.list_dir(".")
    with pytest.raises(ToolError, match="not available"):
        closed.run_script("ping", "")


def test_apply_waits_for_agreement_and_uses_the_preview() -> None:
    queue = JobQueue()
    tools = ToolTable(queue, FileSandbox(Path(), {}), timeout=2)
    assert agrees("apply")
    assert agrees("apply please")
    assert agrees("Please write it.")
    assert agrees("apply anyway", warnings=True)
    assert not agrees("yes")
    assert not agrees("ok")
    assert not agrees("apply", warnings=True)
    assert not agrees("yes but change the date")
    assert discards("discard")
    assert discards("never mind")
    assert not discards("apply")
    result: dict[str, object] = {}

    def worker() -> None:
        job = None
        for _ in range(50):
            job = queue.next_job()
            if job is not None:
                break
            time.sleep(0.02)
        assert job is not None
        result["job"] = job
        queue.complete(job["id"], {"ok": True, "result": {"written": True, "path": job["arguments"]["path"]}})

    thread = threading.Thread(target=worker)
    thread.start()
    tools.pending.store({"path": "Home.md", "original": "old note", "proposed": "new note"})
    assert tools.apply_pending(lambda: False) == "Wrote that into the note."
    thread.join(timeout=3)
    job = result["job"]
    assert job["name"] == "vault.apply"
    assert job["arguments"] == {"path": "Home.md", "original": "old note", "proposed": "new note"}


def test_model_cannot_apply_and_a_closed_vault_is_unavailable() -> None:
    queue = JobQueue()
    tools = ToolTable(queue, FileSandbox(Path(), {}), timeout=0.2)
    with pytest.raises(ToolError, match="agrees"):
        tools.call("vault.apply", {}, lambda: False)
    assert queue.next_job() is None
    assert tools.call("vault.tasks", {}, lambda: False) == "The vault is unavailable."


def test_unconfirmed_apply_keeps_the_preview() -> None:
    queue = JobQueue()
    tools = ToolTable(queue, FileSandbox(None, {}), timeout=0.15)
    tools.pending.store({"path": "Home.md", "original": "old", "proposed": "new"})
    assert "could not confirm" in tools.apply_pending(lambda: False)
    assert tools.has_pending() is True


def _finish(queue: JobQueue, result: dict[str, object]) -> threading.Thread:
    def worker() -> None:
        job = None
        for _ in range(50):
            job = queue.next_job()
            if job is not None:
                break
            time.sleep(0.02)
        assert job is not None
        queue.complete(job["id"], result)

    thread = threading.Thread(target=worker)
    thread.start()
    return thread


def test_rejected_apply_keeps_the_preview() -> None:
    queue = JobQueue()
    tools = ToolTable(queue, FileSandbox(None, {}), timeout=2)
    tools.pending.store({"path": "Home.md", "original": "old", "proposed": "new"})
    thread = _finish(
        queue,
        {
            "ok": False,
            "error": "This note changed while the preview was open. Discard it and try again.",
        },
    )
    message = tools.apply_pending(lambda: False)
    thread.join(timeout=3)
    assert "changed" in message
    assert tools.has_pending() is True


def test_missing_note_drops_the_preview() -> None:
    queue = JobQueue()
    tools = ToolTable(queue, FileSandbox(None, {}), timeout=2)
    tools.pending.store({"path": "Home.md", "original": "old", "proposed": "new"})
    thread = _finish(queue, {"ok": False, "error": "That note is not available."})
    message = tools.apply_pending(lambda: False)
    thread.join(timeout=3)
    assert message == "That note is not available."
    assert tools.has_pending() is False
