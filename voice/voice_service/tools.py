from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Callable

from .bridge_queue import JobQueue
from .files import FileSandbox, ToolError


@dataclass
class PendingPreview:
    path: str
    original: str
    proposed: str
    warnings: tuple[str, ...]


class Pending:
    def __init__(self) -> None:
        self.item: PendingPreview | None = None

    def store(self, result: dict[str, Any]) -> None:
        path = result.get("path")
        original = result.get("original")
        proposed = result.get("proposed")
        if not isinstance(path, str) or not isinstance(original, str) or not isinstance(proposed, str):
            return
        warnings = result.get("warnings")
        if not isinstance(warnings, list):
            warnings = []
        clean = tuple(item for item in warnings if isinstance(item, str) and item.strip() != "")
        self.item = PendingPreview(path, original, proposed, clean)

    def clear(self) -> None:
        self.item = None


class ToolTable:
    def __init__(self, bridge: JobQueue, files: FileSandbox, timeout: float) -> None:
        self.bridge = bridge
        self.files = files
        self.timeout = timeout
        self.pending = Pending()

    def has_pending(self) -> bool:
        return self.pending.item is not None

    def needs_extra_confirm(self) -> bool:
        item = self.pending.item
        return item is not None and len(item.warnings) > 0

    def files_enabled(self) -> bool:
        return self.files.root is not None

    def drop_pending(self) -> None:
        self.pending.clear()

    def call(self, name: str, arguments: dict[str, Any], cancel: Callable[[], bool]) -> str:
        if not isinstance(arguments, dict):
            raise ToolError("invalid arguments")
        if name == "vault.apply":
            raise ToolError("Wait until the caller agrees. The call writes the preview only then.")
        if name == "vault.ask":
            return self._vault("vault.ask", {"question": need_text(arguments, "question", 500)}, cancel)
        if name == "vault.tasks":
            return self._vault("vault.tasks", {}, cancel)
        if name == "vault.read":
            return self._vault("vault.read", {"path": note_path(arguments.get("path"))}, cancel)
        if name == "vault.preview":
            return self._preview(arguments, cancel)
        if name == "files.list":
            relative = arguments.get("path", ".")
            if relative is None:
                relative = "."
            if not isinstance(relative, str):
                raise ToolError("invalid arguments")
            return self.files.list_dir(relative)
        if name == "files.read":
            return self.files.read_file(need_text(arguments, "path", 240))
        if name == "scripts.run":
            return self.files.run_script(
                need_text(arguments, "name", 40),
                optional_text(arguments.get("argument"), 200),
            )
        raise ToolError("unknown tool")

    def apply_pending(self, cancel: Callable[[], bool]) -> str:
        item = self.pending.item
        if item is None:
            return "There is no preview to write."
        outcome = self.bridge.submit(
            "vault.apply",
            {"path": item.path, "original": item.original, "proposed": item.proposed},
            self.timeout,
            cancel,
        )
        if not outcome.get("ok"):
            error = outcome.get("error")
            message = str(error)[:300] if isinstance(error, str) and error else "The note was not written."
            if message == "Obsidian is not reachable.":
                return "I could not confirm the write. Say apply to try again."
            self.pending.clear()
            return message
        self.pending.clear()
        result = outcome.get("result")
        if isinstance(result, dict) and result.get("unchanged") is True:
            return "That note already has that text."
        return "Wrote that into the note."

    def _preview(self, arguments: dict[str, Any], cancel: Callable[[], bool]) -> str:
        payload = {
            "path": note_path(arguments.get("path")),
            "proposed": exact_text(arguments.get("proposed"), 20_000),
        }
        return self._vault("vault.preview", payload, cancel)

    def _vault(self, name: str, arguments: dict[str, Any], cancel: Callable[[], bool]) -> str:
        outcome = self.bridge.submit(name, arguments, self.timeout, cancel)
        if not outcome.get("ok"):
            error = outcome.get("error")
            if error == "Obsidian is not reachable.":
                return "The vault is unavailable."
            return str(error)[:500] if isinstance(error, str) else "The vault job failed."
        result = outcome.get("result")
        if name == "vault.preview" and isinstance(result, dict):
            self.pending.store(result)
            spoken = result.get("spoken")
            if isinstance(spoken, str) and spoken.strip() != "":
                return spoken.strip()[:500]
            return "The preview is ready. Say apply to write it."
        if isinstance(result, str):
            return result[:4000]
        return json.dumps(result)[:4000]


def need_text(arguments: dict[str, Any], key: str, limit: int) -> str:
    value = arguments.get(key)
    if not isinstance(value, str):
        raise ToolError("invalid arguments")
    text = value.strip()
    if text == "" or len(text) > limit or "\x00" in text:
        raise ToolError("invalid arguments")
    return text


def optional_text(value: Any, limit: int) -> str:
    if value is None:
        return ""
    if not isinstance(value, str) or len(value) > limit or "\x00" in value:
        raise ToolError("invalid arguments")
    return value


def exact_text(value: Any, limit: int) -> str:
    if not isinstance(value, str) or value.strip() == "" or len(value) > limit or "\x00" in value:
        raise ToolError("invalid arguments")
    return value


def note_path(value: Any) -> str:
    if not isinstance(value, str):
        raise ToolError("invalid arguments")
    path = value.strip()
    if (
        path == ""
        or len(path) > 240
        or path.startswith("/")
        or "\\" in path
        or "\x00" in path
        or any(part == ".." for part in path.split("/"))
        or not path.lower().endswith(".md")
    ):
        raise ToolError("invalid arguments")
    return path


AGREE = re.compile(
    r"^(?:please\s+)?(?:apply(?:\s+it)?|write\s+it|write\s+that)[.!]?\s*$",
    re.IGNORECASE,
)
AGREE_ANYWAY = re.compile(
    r"^(?:please\s+)?(?:apply\s+anyway|write\s+it\s+anyway)[.!]?\s*$",
    re.IGNORECASE,
)


def agrees(text: str, warnings: bool = False) -> bool:
    phrase = text.strip()
    if AGREE_ANYWAY.fullmatch(phrase) is not None:
        return True
    if warnings:
        return False
    return AGREE.fullmatch(phrase) is not None


def apply_phrase(text: str) -> bool:
    phrase = text.strip()
    return AGREE.fullmatch(phrase) is not None or AGREE_ANYWAY.fullmatch(phrase) is not None
