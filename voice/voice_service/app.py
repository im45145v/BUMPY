from __future__ import annotations

import hmac
import json
import re
import threading
from dataclasses import dataclass

from .bridge_queue import JobQueue
from .chat import Endpoint, HybridChat, urllib_transport
from .config import VoiceConfig
from .conversation import Caption, Conversation
from .files import FileSandbox
from .local_process import LocalProcess
from .page import PAGE_HTML
from .playback import Playback, TurnGate, barge_in
from .session import Busy, CallSession
from .speech import CommandVoice, HybridSpeech
from .tools import ToolTable
from .webrtc import CallUnavailable, WebRtcPeer, speech_started


@dataclass
class Response:
    status: int
    body: bytes
    content_type: str


class App:
    def __init__(
        self,
        config: VoiceConfig,
        session: CallSession,
        peer: Peer,
        playback: Playback,
        gate: TurnGate,
        conversation: Conversation,
        bridge: JobQueue,
        caption: Caption,
        process: LocalProcess,
    ) -> None:
        self.config = config
        self.session = session
        self.peer = peer
        self.playback = playback
        self.gate = gate
        self.conversation = conversation
        self.bridge = bridge
        self.caption = caption
        self.process = process

    def close(self) -> None:
        self.hangup()
        self.process.stop()

    def hangup(self) -> None:
        self.session.hangup()
        self.peer.hangup()
        barge_in(self.playback, self.gate)
        self.conversation.drop()
        self.caption.set("")

    def dispatch(
        self,
        method: str,
        path: str,
        headers: dict[str, str],
        body: bytes,
        surface: str,
    ) -> Response:
        if method == "GET" and path == "/health":
            return json_response(200, {"ok": True})
        if surface == "bridge" and path != "/health" and not path.startswith("/bridge"):
            return text_response(404, "Not found")
        if surface == "call" and method == "GET" and path == "/":
            return Response(200, PAGE_HTML.encode(), "text/html; charset=utf-8")
        if not authorized(headers, self.config.token):
            return json_response(401, {"error": "The call token was refused."})
        if surface == "call" and method == "POST" and path == "/call":
            return self.offer(body)
        if surface == "call" and method == "POST" and path == "/call/hangup":
            self.hangup()
            return json_response(200, {"ok": True})
        if surface == "call" and method == "GET" and path == "/call/caption":
            return json_response(200, {"text": self.caption.get()})
        if method == "GET" and path == "/bridge/jobs":
            return json_response(200, {"job": self.bridge.next_job()})
        if method == "POST" and path == "/bridge/preview/drop":
            self.conversation.tools.drop_pending()
            return json_response(200, {"ok": True})
        if method == "POST" and path.startswith("/bridge/jobs/"):
            return self.finish_job(path.removeprefix("/bridge/jobs/"), body)
        return text_response(404, "Not found")

    def offer(self, body: bytes) -> Response:
        try:
            payload = json.loads(body.decode() or "{}")
        except json.JSONDecodeError:
            return json_response(400, {"error": "The offer was not JSON."})
        sdp = payload.get("sdp") if isinstance(payload, dict) else None
        kind = payload.get("type") if isinstance(payload, dict) else None
        if not isinstance(sdp, str) or sdp.strip() == "" or len(sdp) > 100_000 or kind != "offer":
            return json_response(400, {"error": "The offer was incomplete."})
        try:
            self.session.begin()
        except Busy:
            return json_response(409, {"error": "A call is already open."})
        try:
            answer_sdp, answer_type = self.peer.offer(sdp, kind)
        except CallUnavailable as error:
            self.session.hangup()
            self.peer.hangup()
            return json_response(503, {"error": str(error)})
        except Exception:
            self.session.hangup()
            self.peer.hangup()
            return json_response(503, {"error": "The call could not be answered."})
        self.conversation.greet()
        return json_response(200, {"sdp": answer_sdp, "type": answer_type})

    def finish_job(self, job_id: str, body: bytes) -> Response:
        if re.fullmatch(r"[A-Za-z0-9-]{8,80}", job_id) is None:
            return json_response(404, {"error": "That job is not waiting."})
        try:
            payload = json.loads(body.decode() or "{}")
        except json.JSONDecodeError:
            return json_response(400, {"error": "The result was not JSON."})
        if not isinstance(payload, dict):
            return json_response(400, {"error": "The result was not JSON."})
        if not self.bridge.complete(job_id, payload):
            return json_response(404, {"error": "That job is not waiting."})
        return json_response(200, {"ok": True})


class Peer:
    def offer(self, sdp: str, sdp_type: str) -> tuple[str, str]:
        raise NotImplementedError

    def hangup(self) -> None:
        return None


def build_app(config: VoiceConfig, peer: Peer | None = None, transport=urllib_transport) -> App:
    playback = Playback()
    gate = TurnGate()
    session = CallSession()
    caption = Caption()
    bridge = JobQueue()
    process = LocalProcess(list(config.local_argv))
    cloud = Endpoint(
        config.cloud_base_url,
        config.cloud_api_key,
        config.cloud_model,
        transport,
        config.cloud_stt_model,
        config.cloud_tts_model,
        config.cloud_voice,
    )
    local = Endpoint(config.local_base_url, "", config.local_model, transport)
    chat = HybridChat(cloud, local, process)
    speech = HybridSpeech(
        cloud,
        CommandVoice(list(config.whisper_argv)),
        CommandVoice(list(config.piper_argv)),
    )
    tools = ToolTable(bridge, FileSandbox(config.files_root, config.scripts, config.script_timeout), config.bridge_timeout)
    conversation = Conversation(chat.complete, speech, tools, playback, gate, caption)
    if peer is None:
        live = WebRtcPeer(playback, gate)
        live.on_speech_start = lambda: speech_started(playback, gate, conversation._talk.locked)
        live.on_utterance = lambda samples: threading.Thread(
            target=conversation.on_samples,
            args=(samples,),
            daemon=True,
        ).start()
        peer = live
    return App(config, session, peer, playback, gate, conversation, bridge, caption, process)


def authorized(headers: dict[str, str], token: str) -> bool:
    if token == "":
        return False
    header = headers.get("authorization", headers.get("Authorization", ""))
    prefix = "Bearer "
    if not header.startswith(prefix):
        return False
    presented = header[len(prefix) :]
    if len(presented) != len(token):
        return False
    return hmac.compare_digest(presented, token)


def json_response(status: int, payload: object) -> Response:
    return Response(status, json.dumps(payload).encode(), "application/json")


def text_response(status: int, text: str) -> Response:
    return Response(status, text.encode(), "text/plain; charset=utf-8")
