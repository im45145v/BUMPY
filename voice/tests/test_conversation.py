from __future__ import annotations

import threading
import time

from voice_service.bridge_queue import JobQueue
from voice_service.conversation import Caption, Conversation
from voice_service.files import FileSandbox
from voice_service.playback import Playback, TurnGate, barge_in
from voice_service.tools import ToolTable
from voice_service.wav import tone_wav
from pathlib import Path


class Speech:
    def __init__(self, order: list) -> None:
        self.order = order

    def synthesize(self, text: str) -> bytes:
        self.order.append(("say", text))
        return tone_wav()

    def transcribe(self, wav: bytes) -> str:
        return "from the mic"


def conversation(replies: list[str], order: list, tools: ToolTable | None = None):
    pending = list(replies)

    def complete(messages):
        order.append(("model", messages))
        return pending.pop(0)

    playback = Playback()
    gate = TurnGate()
    caption = Caption()
    table = tools or ToolTable(JobQueue(), FileSandbox(Path(), {}), timeout=1)
    talk = Conversation(complete, Speech(order), table, playback, gate, caption)
    return talk, playback, gate, caption


def test_status_is_spoken_before_the_tool_and_the_follow_up_keeps_context() -> None:
    order: list = []
    tools_called: list[str] = []

    class Tools:
        def has_pending(self) -> bool:
            return False

        def drop_pending(self) -> None:
            return None

        def apply_pending(self, cancel) -> str:
            raise AssertionError("apply")

        def call(self, name, arguments, cancel) -> str:
            tools_called.append(name)
            order.append(("tool", name))
            return "Pay rent, due 2026-10-23 (Home.md)"

    talk, _playback, _gate, _caption = conversation(
        [
            '{"say":"Checking open tasks.","tool":"vault.tasks","arguments":{}}',
            '{"say":"Rent is due today."}',
            '{"say":"Still rent."}',
        ],
        order,
    )
    talk.tools = Tools()
    talk.handle("What is due?")
    assert order[:3] == [
        ("model", order[0][1]),
        ("say", "Checking open tasks."),
        ("tool", "vault.tasks"),
    ]
    assert ("say", "Rent is due today.") in order
    talk.handle("And tomorrow?")
    models = [item[1] for item in order if item[0] == "model"]
    assert any("What is due?" in message["content"] for message in models[-1])
    assert tools_called == ["vault.tasks"]


def test_barge_in_during_the_model_drops_the_reply() -> None:
    playback = Playback()
    gate = TurnGate()

    def complete(messages):
        barge_in(playback, gate)
        return '{"say":"too late"}'

    caption = Caption()
    talk = Conversation(
        complete,
        Speech([]),
        ToolTable(JobQueue(), FileSandbox(Path(), {}), timeout=1),
        playback,
        gate,
        caption,
    )
    talk.handle("stop")
    assert playback.pending() == 0
    assert caption.get() == ""


def test_apply_is_spoken_only_after_agreement() -> None:
    queue = JobQueue()
    tools = ToolTable(queue, FileSandbox(Path(), {}), timeout=2)
    tools.pending.store({"path": "Home.md", "original": "old", "proposed": "new"})
    order: list = []
    talk, _playback, _gate, _caption = conversation(['{"say":"I will change the date."}'], order, tools)

    def worker() -> None:
        job = None
        for _ in range(50):
            job = queue.next_job()
            if job is not None:
                break
            time.sleep(0.02)
        assert job is not None and job["name"] == "vault.apply"
        queue.complete(job["id"], {"ok": True, "result": {"written": True}})

    talk.handle("yes but change the date")
    assert tools.has_pending() is True
    assert ("say", "A preview is still open. Say apply to write it, or discard to cancel.") in order
    assert not any(item[0] == "model" for item in order)

    talk.handle("discard")
    assert tools.has_pending() is False
    assert ("say", "Discarded. The note was not changed.") in order
    tools.pending.store({"path": "Home.md", "original": "old", "proposed": "new"})
    thread = threading.Thread(target=worker)
    thread.start()
    talk.handle("apply")
    thread.join(timeout=3)
    assert ("say", "Writing that into the note.") in order
    assert ("say", "Wrote that into the note.") in order


def test_hangup_forgets_what_was_said() -> None:
    order: list = []
    talk, _playback, _gate, _caption = conversation(
        ['{"say":"Rent is due today."}', '{"say":"Hello."}'],
        order,
    )
    talk.handle("What is due?")
    talk.drop()
    talk.handle("hello")
    models = [item[1] for item in order if item[0] == "model"]
    assert models[-1][1]["content"] == "hello"
    assert all("What is due?" not in message["content"] for message in models[-1])


def test_warnings_block_a_plain_apply() -> None:
    tools = ToolTable(JobQueue(), FileSandbox(None, {}), timeout=1)
    tools.pending.store(
        {
            "path": "Home.md",
            "original": "old",
            "proposed": "new",
            "warnings": ["Tasks would be removed."],
        }
    )
    order: list = []
    talk, _playback, _gate, _caption = conversation(['{"say":"no"}'], order, tools)
    talk.handle("apply")
    assert tools.has_pending() is True
    assert ("say", "That change has warnings. Say apply anyway to write the whole note.") in order
    assert not any(item[0] == "model" for item in order)


def test_greeting_does_not_call_the_model() -> None:
    order: list = []
    talk, playback, _gate, caption = conversation([], order)
    talk.greet()
    assert order == []
    assert caption.get() == "Bumpy is on the call."
    assert playback.pending() > 0
