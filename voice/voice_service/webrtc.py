from __future__ import annotations

import asyncio
import threading
from collections.abc import Callable
from typing import Any

from .playback import Playback, TurnGate, barge_in
from .vad import EnergyVad
from .wav import resample


class CallUnavailable(Exception):
    pass


class WebRtcPeer:
    """One browser peer. Audio out is the playback queue. Audio in is the caller's voice."""

    def __init__(self, playback: Playback, gate: TurnGate) -> None:
        self.playback = playback
        self.gate = gate
        self.on_speech_start: Callable[[], None] = lambda: None
        self.on_utterance: Callable[[list[int]], None] = lambda _samples: None
        self.loop = asyncio.new_event_loop()
        self.thread = threading.Thread(target=self.loop.run_forever, name="bumpy-webrtc", daemon=True)
        self.thread.start()
        self.pc: Any = None
        self.active = False

    def offer(self, sdp: str, sdp_type: str) -> tuple[str, str]:
        future = asyncio.run_coroutine_threadsafe(self._offer(sdp, sdp_type), self.loop)
        try:
            return future.result(timeout=20)
        except CallUnavailable:
            raise
        except Exception as error:
            raise CallUnavailable("The call could not be answered.") from error

    def hangup(self) -> None:
        future = asyncio.run_coroutine_threadsafe(self._hangup(), self.loop)
        try:
            future.result(timeout=5)
        except Exception:
            return

    async def _offer(self, sdp: str, sdp_type: str) -> tuple[str, str]:
        try:
            from aiortc import RTCPeerConnection, RTCSessionDescription
        except ImportError as error:
            raise CallUnavailable("Install aiortc on the board to take calls.") from error
        await self._hangup()
        pc = RTCPeerConnection()
        self.pc = pc
        self.active = True
        pc.addTrack(build_outbound(self.playback))

        @pc.on("track")
        def on_track(track: Any) -> None:
            if track.kind == "audio":
                asyncio.create_task(self._consume(track))

        await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp, type=sdp_type))
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        local = pc.localDescription
        if local is None:
            raise CallUnavailable("The call could not be answered.")
        return local.sdp, local.type

    async def _hangup(self) -> None:
        self.active = False
        pc = self.pc
        self.pc = None
        if pc is not None:
            await pc.close()

    async def _consume(self, track: Any) -> None:
        vad = EnergyVad()
        pending: list[int] = []
        while self.active:
            try:
                frame = await track.recv()
            except Exception:
                return
            samples, rate = mono_int16(frame)
            pending.extend(resample(samples, rate, 16000))
            while len(pending) >= 320:
                piece = pending[:320]
                del pending[:320]
                event = vad.feed(piece)
                if event == "start":
                    self.on_speech_start()
                elif event == "end":
                    heard = vad.take()
                    if len(heard) > 16000 * 20:
                        heard = heard[-16000 * 20 :]
                    if heard:
                        self.on_utterance(heard)


def mono_int16(frame: Any) -> tuple[list[int], int]:
    try:
        data = frame.to_ndarray()
    except Exception:
        return [], 48000
    if getattr(data, "ndim", 1) == 2:
        if data.shape[0] <= 8 and data.shape[0] < data.shape[-1]:
            data = data.mean(axis=0)
        else:
            data = data.mean(axis=-1)
    samples = [int(sample) for sample in data.reshape(-1).tolist()]
    rate = int(getattr(frame, "sample_rate", 48000) or 48000)
    return samples, rate


def speech_started(
    playback: Playback,
    gate: TurnGate,
    busy: Callable[[], bool] | None = None,
) -> None:
    if playback.pending() > 0 or gate.is_speaking() or (busy is not None and busy()):
        barge_in(playback, gate)


def build_outbound(playback: Playback) -> Any:
    import time
    from fractions import Fraction

    import av
    from aiortc import MediaStreamTrack

    class Track(MediaStreamTrack):
        kind = "audio"

        def __init__(self) -> None:
            super().__init__()
            self.playback = playback
            self.pts = 0
            self.rate = 48000
            self.samples = 960
            self.started: float | None = None

        async def recv(self) -> Any:
            if self.started is None:
                self.started = time.time()
            wait = self.started + (self.pts / self.rate) - time.time()
            if wait > 0:
                await asyncio.sleep(wait)
            pcm = self.playback.read(self.samples)
            frame = av.AudioFrame(format="s16", layout="mono", samples=self.samples)
            frame.sample_rate = self.rate
            frame.planes[0].update(pcm)
            frame.pts = self.pts
            frame.time_base = Fraction(1, self.rate)
            self.pts += self.samples
            return frame

    return Track()
