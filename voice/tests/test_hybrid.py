from __future__ import annotations

import json
from types import SimpleNamespace

from voice_service.chat import CloudError, Endpoint, HybridChat, multipart
from voice_service.local_process import LocalProcess
from voice_service.speech import CommandVoice, HybridSpeech
from voice_service.wav import tone_wav, write_wav


def transport_for(routes: dict[str, tuple[int, bytes]]):
    def transport(method: str, url: str, headers: dict, body: bytes | None, timeout: float):
        for suffix, response in routes.items():
            if url.endswith(suffix):
                return response
        raise AssertionError(url)

    return transport


def test_cloud_is_used_when_it_answers() -> None:
    spawned: list[dict] = []
    process = LocalProcess(["llama-server"], spawn=lambda argv, **kwargs: spawned.append(kwargs))
    cloud = Endpoint(
        "https://cloud.example/v1",
        "super-secret",
        "cloud-model",
        transport_for(
            {
                "/models": (200, b'{"data":[]}'),
                "/chat/completions": (
                    200,
                    json.dumps({"choices": [{"message": {"content": "cloud answer"}}]}).encode(),
                ),
            }
        ),
    )
    local = Endpoint("http://127.0.0.1:8080/v1", "", "local", transport_for({}))
    chat = HybridChat(cloud, local, process)
    assert chat.complete([{"role": "user", "content": "Hi"}]) == "cloud answer"
    assert chat.last_route == "cloud"
    assert spawned == []


def test_local_model_starts_only_after_the_cloud_fails() -> None:
    spawned: list[dict] = []

    def spawn(argv, **kwargs):
        spawned.append({"argv": argv, **kwargs})
        return SimpleNamespace(poll=lambda: None, terminate=lambda: None)

    def transport(method, url, headers, body, timeout):
        if url.endswith("/models"):
            return 200, b"{}"
        if "cloud.example" in url:
            return 500, b"super-secret"
        return 200, json.dumps({"choices": [{"message": {"content": "local answer"}}]}).encode()

    process = LocalProcess(["llama-server", "-m", "small"], spawn=spawn)
    chat = HybridChat(
        Endpoint("https://cloud.example/v1", "super-secret", "cloud", transport),
        Endpoint("http://127.0.0.1:8080/v1", "", "local", transport),
        process,
    )
    assert chat.complete([{"role": "user", "content": "Hi"}]) == "local answer"
    assert chat.last_route == "local"
    assert spawned[0]["shell"] is False
    assert spawned[0]["argv"][0] == "llama-server"
    process.ensure()
    assert len(spawned) == 1


def test_a_refused_key_does_not_echo_the_secret() -> None:
    endpoint = Endpoint(
        "https://cloud.example/v1",
        "super-secret",
        "cloud",
        transport_for({"/chat/completions": (401, b"bad super-secret")}),
    )
    try:
        endpoint.complete([{"role": "user", "content": "Hi"}])
    except CloudError as error:
        assert "super-secret" not in str(error)
    else:
        raise AssertionError("expected a cloud error")


def test_local_whisper_and_piper_run_without_a_shell(tmp_path) -> None:
    wav_in = write_wav([0, 1000, -1000], 16000)

    def whisper(argv, **kwargs):
        assert kwargs["shell"] is False
        target = next(part for part in argv if part.endswith(".wav"))
        open(target + ".txt", "w", encoding="utf-8").write("heard you")
        return SimpleNamespace(returncode=0, stdout=b"", stderr=b"")

    def piper(argv, **kwargs):
        assert kwargs["shell"] is False
        assert kwargs["input"] == b"Hello"
        target = next(part for part in argv if part.endswith(".wav"))
        open(target, "wb").write(tone_wav())
        return SimpleNamespace(returncode=0, stdout=b"", stderr=b"")

    cloud = Endpoint("", "", "", transport_for({}))
    speech = HybridSpeech(
        cloud,
        CommandVoice(["whisper", "{wav}"], whisper),
        CommandVoice(["piper", "{wav}"], piper),
    )
    assert speech.transcribe(wav_in) == "heard you"
    assert speech.last_route == "local"
    assert speech.synthesize("Hello").startswith(b"RIFF")
    assert speech.last_route == "local"


def test_cloud_speech_is_preferred() -> None:
    wav = tone_wav()
    body, content_type = multipart({"model": "whisper-1"}, {"file": ("speech.wav", wav, "audio/wav")})
    assert b"speech.wav" in body
    assert content_type.startswith("multipart/form-data")

    def transport(method, url, headers, body, timeout):
        if url.endswith("/models"):
            return 200, b"{}"
        if url.endswith("/audio/transcriptions"):
            return 200, b'{"text":"from the cloud"}'
        if url.endswith("/audio/speech"):
            return 200, wav
        raise AssertionError(url)

    speech = HybridSpeech(
        Endpoint("https://cloud.example/v1", "k", "m", transport),
        CommandVoice(["whisper", "{wav}"]),
        CommandVoice(["piper", "{wav}"]),
    )
    assert speech.transcribe(wav) == "from the cloud"
    assert speech.synthesize("Hello") == wav
    assert speech.last_route == "cloud"


def test_unhealthy_cloud_without_piper_still_makes_a_tone() -> None:
    speech = HybridSpeech(
        Endpoint("", "", "", transport_for({})),
        CommandVoice([]),
        CommandVoice([]),
    )
    assert speech.synthesize("Hello").startswith(b"RIFF")
    assert speech.last_route == "tone"
