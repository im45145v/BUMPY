from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any, Callable


class ToolError(Exception):
    pass


class FileSandbox:
    def __init__(
        self,
        root: Path | None,
        scripts: dict[str, list[str]],
        timeout: float = 10.0,
        runner: Callable[..., Any] | None = None,
    ) -> None:
        self.root = root
        self.scripts = scripts
        self.timeout = timeout
        self.runner = subprocess.run if runner is None else runner

    def list_dir(self, relative: str) -> str:
        folder = self.resolve(relative or ".")
        if not folder.is_dir():
            raise ToolError("That folder is not available.")
        names: list[str] = []
        for entry in sorted(folder.iterdir(), key=lambda item: item.name):
            if entry.name.startswith("."):
                continue
            try:
                resolved = entry.resolve()
            except OSError:
                continue
            if not self.inside(resolved):
                continue
            names.append(entry.name + ("/" if entry.is_dir() else ""))
            if len(names) >= 50:
                break
        if names == []:
            return "That folder is empty."
        return "\n".join(names)

    def read_file(self, relative: str) -> str:
        path = self.resolve(relative)
        if not path.is_file():
            raise ToolError("That file is not available.")
        data = path.read_bytes()[:8001]
        if b"\x00" in data:
            raise ToolError("That file is not text.")
        text = data.decode("utf-8", errors="replace")
        if len(text) > 8000:
            return text[:8000] + "\n\n[The rest of the file was left out.]"
        return text

    def run_script(self, name: str, argument: str) -> str:
        argv = self.scripts.get(name)
        if argv is None:
            raise ToolError("That script is not allowed.")
        if not isinstance(argument, str) or "\x00" in argument or len(argument) > 200:
            raise ToolError("invalid arguments")
        command = list(argv)
        if argument != "":
            command.append(argument)
        try:
            result = self.runner(
                command,
                cwd=str(self.rooted()),
                shell=False,
                capture_output=True,
                timeout=self.timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as error:
            raise ToolError("That script took too long.") from error
        if result.returncode != 0:
            detail = result.stderr.decode("utf-8", errors="replace").strip()[:180]
            raise ToolError(detail or "That script failed.")
        text = result.stdout.decode("utf-8", errors="replace").strip()[:4000]
        return text or "The script finished."

    def resolve(self, relative: str) -> Path:
        if not isinstance(relative, str) or len(relative) > 240 or "\x00" in relative:
            raise ToolError("invalid arguments")
        if relative.startswith("/") or relative.startswith("\\"):
            raise ToolError("invalid arguments")
        root = self.rooted()
        candidate = (root / relative).resolve()
        if not self.inside(candidate):
            raise ToolError("That path is outside the file folder.")
        return candidate

    def rooted(self) -> Path:
        if self.root is None or str(self.root) == "" or not self.root.exists():
            raise ToolError("The file folder is not available.")
        return self.root.resolve()

    def inside(self, candidate: Path) -> bool:
        root = self.rooted()
        return candidate == root or root in candidate.parents
