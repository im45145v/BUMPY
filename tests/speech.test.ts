import { describe, expect, it } from 'vitest';
import { captureTranscript } from '../src/audio/capture';
import {
	createRecorderInput,
	createWebSpeechInput,
	type AudioRecorder,
	type RecognitionLike,
} from '../src/audio/engines';
import { MAX_SPEECH_CHARS } from '../src/audio/limits';
import { transcribeAudio, synthesizeSpeech } from '../src/audio/openai-audio';
import { dictateReducer } from '../src/audio/phase';
import { readAloud } from '../src/audio/speak';
import { encodeMultipart } from '../src/audio/multipart';
import { decideInsertion } from '../src/notes/insert';
import type { HttpRequest } from '../src/providers/types';
import { SPEECH_COMMANDS, SPEECH_INPUT_DESC } from '../src/commands/speech-specs';
import { normalizeSettings } from '../src/settings';

describe('speech commands', () => {
	it('registers dictation and reading', () => {
		expect(SPEECH_COMMANDS.map((command) => command.id)).toEqual([
			'dictate',
			'read-selection',
			'read-note',
		]);
	});

	it('does not describe app speech recognition as staying on this device', () => {
		expect(SPEECH_INPUT_DESC).toMatch(/can send microphone audio/);
		expect(SPEECH_INPUT_DESC).not.toMatch(/On this device/);
	});
});

describe('dictate phases', () => {
	it('moves from recording to review and keeps edits', () => {
		let state = dictateReducer({ name: 'idle' }, { type: 'start' });
		state = dictateReducer(state, { type: 'partial', text: 'hel' });
		state = dictateReducer(state, { type: 'stop' });
		state = dictateReducer(state, { type: 'transcript', text: 'hello' });
		state = dictateReducer(state, { type: 'edit', text: 'hello there' });
		expect(state).toEqual({ name: 'review', transcript: 'hello there' });
	});
});

describe('captureTranscript', () => {
	it('reviews a web speech transcript and can be cancelled', async () => {
		const phases: string[] = [];
		const result = await captureTranscript({
			engine: createWebSpeechInput(() => fakeRecognition('hello vault')),
			signal: new AbortController().signal,
			stopped: Promise.resolve(),
			onPhase: (phase) => phases.push(phase.name),
		});
		expect(result).toEqual({ ok: true, text: 'hello vault' });
		expect(phases).toContain('review');

		const controller = new AbortController();
		controller.abort();
		const cancelled = await captureTranscript({
			engine: createWebSpeechInput(() => fakeRecognition('secret')),
			signal: controller.signal,
			stopped: new Promise(() => {}),
			onPhase: () => {},
		});
		expect(cancelled).toEqual({
			ok: false,
			message: 'The request was cancelled.',
		});
	});

	it('hides unexpected engine failures', async () => {
		const result = await captureTranscript({
			engine: {
				isSupported: () => true,
				listen: async () => {
					throw new Error('private transcript exploded');
				},
			},
			signal: new AbortController().signal,
			stopped: Promise.resolve(),
			onPhase: () => {},
		});
		expect(result).toEqual({ ok: false, message: 'Transcription failed.' });
	});

	it('transcribes a recording through the provider without sending the API key in the body', async () => {
		let captured: HttpRequest | undefined;
		const recorder: AudioRecorder = {
			isSupported: () => true,
			start: async () => {},
			stop: async () => ({ bytes: Uint8Array.from([1, 2, 3, 4]), mime: 'audio/webm' }),
			cancel: () => {},
		};
		const engine = createRecorderInput(recorder, (audio, mime, signal) =>
			transcribeAudio(
				async (request) => {
					captured = request;
					return {
						status: 200,
						body: JSON.stringify({ text: 'remember the milk' }),
					};
				},
				audio,
				mime,
				{
					baseUrl: 'https://api.openai.com/v1',
					apiKey: 'sk-audio-secret',
					model: 'whisper-1',
					signal,
				},
			),
		);
		const result = await captureTranscript({
			engine,
			signal: new AbortController().signal,
			stopped: Promise.resolve(),
			onPhase: () => {},
		});
		expect(result).toEqual({ ok: true, text: 'remember the milk' });
		expect(captured?.headers.Authorization).toBe('Bearer sk-audio-secret');
		const body = new TextDecoder().decode(captured?.body as ArrayBuffer);
		expect(body).toContain('whisper-1');
		expect(body).not.toContain('sk-audio-secret');
	});
});

describe('readAloud', () => {
	it('refuses empty and oversized text before speaking', async () => {
		let calls = 0;
		const speak = async () => {
			calls += 1;
		};
		expect(
			(await readAloud({ text: '  ', signal: new AbortController().signal, speak })).ok,
		).toBe(false);
		const long = await readAloud({
			text: 'a'.repeat(MAX_SPEECH_CHARS + 1),
			signal: new AbortController().signal,
			speak,
		});
		expect(long.ok).toBe(false);
		if (!long.ok) expect(long.message).toMatch(/too long/);
		expect(calls).toBe(0);
	});

	it('stops when cancelled and plays provider audio without echoing the note', async () => {
		const controller = new AbortController();
		const cancelled = await readAloud({
			text: 'Hello',
			signal: controller.signal,
			speak: async (_text, signal) => {
				controller.abort();
				if (signal.aborted) throw new DOMException('aborted', 'AbortError');
			},
		});
		expect(cancelled).toEqual({ ok: false, message: 'The request was cancelled.' });

		let played = 0;
		const spoken = await readAloud({
			text: 'Private sentence.',
			signal: new AbortController().signal,
			speak: async (text, signal) => {
				const bytes = await synthesizeSpeech(
					async (request) => {
						expect(request.body).toContain('Private sentence.');
						expect(request.body).not.toContain('sk-audio-secret');
						return {
							status: 400,
							body: JSON.stringify({
								error: { message: 'nope Private sentence.' },
							}),
						};
					},
					text,
					'alloy',
					{
						baseUrl: 'https://api.openai.com/v1',
						apiKey: 'sk-audio-secret',
						model: 'tts-1',
						signal,
					},
				);
				played += bytes.byteLength;
			},
		});
		expect(spoken.ok).toBe(false);
		if (!spoken.ok) expect(spoken.message).not.toContain('Private sentence');
		expect(played).toBe(0);
	});
});

describe('transcript insertion', () => {
	it('refuses to insert after the note changes', () => {
		expect(decideInsertion('note', 'note', 'hello').ok).toBe(true);
		const stale = decideInsertion('edited', 'note', 'hello');
		expect(stale.ok).toBe(false);
		expect(decideInsertion('note', 'note', '  ').ok).toBe(false);
	});
});

describe('speech settings', () => {
	it('defaults speech to the device and keeps older settings', () => {
		const settings = normalizeSettings({
			baseUrl: 'http://127.0.0.1:11434/v1',
			model: 'llama3.2',
			apiKey: '',
		});
		expect(settings.speechInput).toBe('web-speech');
		expect(settings.speechOutput).toBe('web-speech');
		expect(settings.speechKeys.openai).toBe('');
		expect(settings.transcriptionModel).toBe('whisper-1');
	});
});

describe('multipart', () => {
	it('includes the file bytes and the model field', () => {
		const encoded = encodeMultipart([
			{ name: 'model', value: 'whisper-1' },
			{
				name: 'file',
				filename: 'speech.webm',
				type: 'audio/webm',
				data: Uint8Array.from([9, 8, 7]),
			},
		]);
		const text = new TextDecoder().decode(encoded.body);
		expect(encoded.contentType).toContain('multipart/form-data');
		expect(text).toContain('whisper-1');
		expect(text).toContain('speech.webm');
		expect(Array.from(new Uint8Array(encoded.body))).toEqual(
			expect.arrayContaining([9, 8, 7]),
		);
	});
});

function fakeRecognition(transcript: string): RecognitionLike {
	return {
		lang: '',
		continuous: false,
		interimResults: false,
		start() {
			this.onresult?.({
				resultIndex: 0,
				results: [{ 0: { transcript }, isFinal: true, length: 1 }],
			});
			this.onend?.();
		},
		stop() {},
		abort() {
			this.onend?.();
		},
		onresult: null,
		onerror: null,
		onend: null,
	};
}
