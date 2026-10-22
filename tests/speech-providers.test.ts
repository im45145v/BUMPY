import { describe, expect, it } from 'vitest';
import { synthesizeCloud, transcribeCloud } from '../src/audio/cloud-speech';
import {
	createDeepgramInput,
	deepgramListenUrl,
	type LiveSocket,
} from '../src/audio/deepgram-audio';
import { synthesizeWithElevenLabs } from '../src/audio/elevenlabs-audio';
import {
	gradiumContentType,
	readGradiumTranscript,
	synthesizeWithGradium,
	transcribeWithGradium,
} from '../src/audio/gradium-audio';
import { synthesizeWithGrok, transcribeWithGrok } from '../src/audio/grok-audio';
import {
	deepgramLanguage,
	elevenLanguage,
	gradiumLanguage,
	grokLanguage,
} from '../src/audio/languages';
import { SPEECH_INPUTS, SPEECH_OUTPUTS } from '../src/audio/speech-catalog';
import { readVoiceList } from '../src/audio/voices';
import type { HttpRequest } from '../src/providers/types';
import { normalizeSettings } from '../src/settings';

describe('speech provider list', () => {
	it('lists speech providers and keeps Groq off text to speech', () => {
		expect(SPEECH_INPUTS.map((item) => item.label)).toEqual([
			'App speech service',
			'OpenAI',
			'Groq',
			'Grok',
			'Gradium',
			'Deepgram',
		]);
		expect(SPEECH_OUTPUTS.map((item) => item.id)).toEqual([
			'web-speech',
			'openai',
			'grok',
			'gradium',
			'elevenlabs',
		]);
	});

	it('keeps an older OpenAI audio key on the OpenAI speech provider', () => {
		const settings = normalizeSettings({
			preset: 'openai',
			apiKey: 'sk-chat',
			speechInput: 'openai-audio',
			speechOutput: 'openai-audio',
		} as unknown as Parameters<typeof normalizeSettings>[0]);
		expect(settings.speechInput).toBe('openai');
		expect(settings.speechOutput).toBe('openai');
		expect(settings.speechKeys.openai).toBe('sk-chat');
	});

	it('moves a saved Grok speech feature onto the Grok voice provider', () => {
		const settings = normalizeSettings({
			speechInput: 'openai-audio',
			speechOutput: 'openai-audio',
			features: {
				speech: { source: 'xai', apiKey: 'xai-voice' },
			},
		} as unknown as Parameters<typeof normalizeSettings>[0]);
		expect(settings.speechInput).toBe('grok');
		expect(settings.speechOutput).toBe('grok');
		expect(settings.speechKeys.grok).toBe('xai-voice');
		expect(settings.speechKeys.openai).toBe('');
	});
});

describe('Grok voice', () => {
	it('transcribes with the Grok speech model and a bearer key', async () => {
		let captured: HttpRequest | undefined;
		const text = await transcribeWithGrok(
			async (request) => {
				captured = request;
				return { status: 200, body: JSON.stringify({ text: 'hello vault' }) };
			},
			Uint8Array.from([1, 2, 3]),
			'audio/webm',
			'xai-secret',
			'grok-voice-transcribe-2.0',
		);
		expect(text).toBe('hello vault');
		expect(captured?.url).toBe('https://api.x.ai/v1/stt');
		expect(captured?.headers.Authorization).toBe('Bearer xai-secret');
		const body = new TextDecoder().decode(captured?.body as ArrayBuffer);
		expect(body).toContain('grok-voice-transcribe-2.0');
		expect(body).not.toContain('xai-secret');
	});

	it('speaks with the eve voice and does not echo the note', async () => {
		let captured: HttpRequest | undefined;
		await expect(
			synthesizeWithGrok(
				async (request) => {
					captured = request;
					return {
						status: 401,
						body: JSON.stringify({ error: { message: 'bad key and Private note' } }),
					};
				},
				'Private note',
				'eve',
				'xai-secret',
			),
		).rejects.toThrow(/401/);
		expect(captured?.url).toBe('https://api.x.ai/v1/tts');
		expect(captured?.body).toContain('"voice_id":"eve"');
		expect(captured?.body).toContain('"language":"auto"');
		await expect(
			synthesizeWithGrok(
				async (request) => {
					captured = request;
					return {
						status: 401,
						body: JSON.stringify({ error: { message: 'bad key and Private note' } }),
					};
				},
				'Private note',
				'eve',
				'xai-secret',
			),
		).rejects.toThrow(/^(?!.*Private note)/);
	});
});

describe('Gradium', () => {
	it('accepts ogg and wav and refuses webm', () => {
		expect(gradiumContentType('audio/ogg;codecs=opus')).toBe('audio/ogg');
		expect(gradiumContentType('audio/wav')).toBe('audio/wav');
		expect(gradiumContentType('audio/webm;codecs=opus')).toBeNull();
	});

	it('reads transcript lines and sends the key as x-api-key', async () => {
		expect(
			readGradiumTranscript(
				'{"type":"text","text":"hello"}\n{"type":"end_text"}\n',
				'gradium-key',
			),
		).toBe('hello');
		let captured: HttpRequest | undefined;
		const text = await transcribeWithGradium(
			async (request) => {
				captured = request;
				return {
					status: 200,
					body: '{"type":"text","text":"remember the milk"}\n',
				};
			},
			Uint8Array.from([9, 8, 7]),
			'audio/ogg',
			'gradium-key',
		);
		expect(text).toBe('remember the milk');
		expect(captured?.url).toContain('https://api.gradium.ai/api/post/speech/asr');
		expect(captured?.url).toContain('language');
		expect(captured?.headers['x-api-key']).toBe('gradium-key');
		expect(captured?.headers.Authorization).toBeUndefined();
		expect(captured?.contentType).toBe('audio/ogg');
	});

	it('returns wav audio and hides the note from a failed response', async () => {
		const bytes = new Uint8Array([1, 2, 3, 4]).buffer;
		const audio = await synthesizeWithGradium(
			async (request) => {
				expect(request.url).toBe('https://api.gradium.ai/api/post/speech/tts');
				expect(request.headers['x-api-key']).toBe('gradium-key');
				expect(request.body).toContain('"output_format":"wav"');
				expect(request.body).not.toContain('gradium-key');
				return { status: 200, body: '', bytes };
			},
			'Read this',
			'YTpq7expH9539ERJ',
			'gradium-key',
		);
		expect(audio).toBe(bytes);
		await expect(
			synthesizeWithGradium(
				async () => ({ status: 400, body: 'nope Read this' }),
				'Read this',
				'voice',
				'gradium-key',
			),
		).rejects.toThrow(/^(?!.*Read this)/);
	});
});

describe('cloud speech routing', () => {
	it('sends Groq transcription to the Groq audio URL', async () => {
		const settings = normalizeSettings({
			speechInput: 'groq',
			speechKeys: {
				openai: '',
				groq: 'gsk-test',
				grok: '',
				gradium: '',
				deepgram: '',
				elevenlabs: '',
			},
			transcriptionModel: 'whisper-large-v3-turbo',
		});
		let captured: HttpRequest | undefined;
		const text = await transcribeCloud(
			settings,
			Uint8Array.from([1]),
			'audio/webm',
			new AbortController().signal,
			async (request) => {
				captured = request;
				return { status: 200, body: JSON.stringify({ text: 'groq heard it' }) };
			},
		);
		expect(text).toBe('groq heard it');
		expect(captured?.url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
		expect(captured?.headers.Authorization).toBe('Bearer gsk-test');
	});

	it('sends OpenAI speech to the OpenAI audio URL', async () => {
		const settings = normalizeSettings({
			speechOutput: 'openai',
			speechKeys: {
				openai: 'sk-tts',
				groq: '',
				grok: '',
				gradium: '',
				deepgram: '',
				elevenlabs: '',
			},
			speechModel: 'tts-1',
			speechVoice: 'alloy',
		});
		let captured: HttpRequest | undefined;
		const spoken = await synthesizeCloud(
			settings,
			'Hello',
			new AbortController().signal,
			async (request) => {
				captured = request;
				return { status: 200, body: '', bytes: new Uint8Array([1, 2]).buffer };
			},
		);
		expect(spoken.mime).toBe('audio/mpeg');
		expect(captured?.url).toBe('https://api.openai.com/v1/audio/speech');
		expect(captured?.body).toContain('"voice":"alloy"');
	});

	it('sends a chosen language to Grok and Gradium, and French to ElevenLabs v3', async () => {
		expect(grokLanguage('fr')).toBe('fr');
		expect(gradiumLanguage('es-MX')).toBe('es');
		expect(deepgramLanguage('auto')).toBe('multi');
		expect(elevenLanguage('eleven_v3', 'pt-BR')).toBe('pt');
		expect(elevenLanguage('eleven_multilingual_v2', 'fr')).toBeUndefined();
		const settings = normalizeSettings({
			speechOutput: 'grok',
			speechLanguage: 'fr',
			speechKeys: {
				openai: '',
				groq: '',
				grok: 'xai-secret',
				gradium: '',
				deepgram: '',
				elevenlabs: '',
			},
			speechVoice: 'ara',
		});
		let captured: HttpRequest | undefined;
		await synthesizeCloud(settings, 'Bonjour', new AbortController().signal, async (request) => {
			captured = request;
			return { status: 200, body: '', bytes: new Uint8Array([1]).buffer };
		});
		expect(captured?.body).toContain('"language":"fr"');
		expect(captured?.body).toContain('"voice_id":"ara"');
		expect(() => gradiumLanguage('ja')).toThrow(/French/);
	});
});

describe('ElevenLabs reading', () => {
	it('posts the note to the voice and hides it from a failed response', async () => {
		let captured: HttpRequest | undefined;
		const bytes = new Uint8Array([9, 8]).buffer;
		const audio = await synthesizeWithElevenLabs(
			async (request) => {
				captured = request;
				return { status: 200, body: '', bytes };
			},
			'Read this note',
			'JBFqnCBsd6RMkjVDRZzb',
			'eleven_v3',
			'xi-secret',
			undefined,
			'en',
		);
		expect(audio).toBe(bytes);
		expect(captured?.url).toBe(
			'https://api.elevenlabs.io/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb',
		);
		expect(captured?.headers['xi-api-key']).toBe('xi-secret');
		expect(captured?.headers.Authorization).toBeUndefined();
		expect(captured?.body).toContain('"model_id":"eleven_v3"');
		expect(captured?.body).toContain('"language_code":"en"');
		expect(captured?.body).not.toContain('xi-secret');
		await expect(
			synthesizeWithElevenLabs(
				async () => ({
					status: 401,
					body: JSON.stringify({ detail: { message: 'bad xi-secret Read this note' } }),
				}),
				'Read this note',
				'voice',
				'eleven_v3',
				'xi-secret',
			),
		).rejects.toThrow(/^(?!.*Read this note)(?!.*xi-secret)/);
	});
});

describe('Deepgram live words', () => {
	it('keeps interim words and does not put the key in the socket URL', async () => {
		expect(deepgramListenUrl('nova-3', 'multi')).toContain('interim_results=true');
		expect(deepgramListenUrl('nova-3', 'multi')).toContain('mip_opt_out=true');
		let socket!: FakeSocket;
		let protocols: string[] = [];
		const partials: string[] = [];
		let stopped!: () => void;
		const stop = new Promise<void>((resolve) => {
			stopped = resolve;
		});
		const pending = createDeepgramInput({
			apiKey: 'dg-secret',
			model: 'nova-3',
			language: 'multi',
			openSocket: (url, chosen) => {
				expect(url).not.toContain('dg-secret');
				protocols = chosen;
				socket = new FakeSocket();
				return socket;
			},
			mic: {
				isSupported: () => true,
				start: async (onChunk) => {
					onChunk(new Uint8Array([1, 2, 3]).buffer);
				},
				stop: async () => {},
				cancel: () => {},
			},
			armCloseTimer: (done) => {
				done();
				return () => {};
			},
		}).listen({
			signal: new AbortController().signal,
			stop,
			onPartial: (text) => partials.push(text),
		});
		await flush();
		socket.emit(
			JSON.stringify({
				type: 'Results',
				is_final: false,
				channel: { alternatives: [{ transcript: 'hel' }] },
			}),
		);
		socket.emit(
			JSON.stringify({
				type: 'Results',
				is_final: true,
				channel: { alternatives: [{ transcript: 'hello vault' }] },
			}),
		);
		expect(partials.at(-1)).toBe('hello vault');
		stopped();
		await expect(pending).resolves.toBe('hello vault');
		expect(protocols).toEqual(['token', 'dg-secret']);
		expect(socket.sent.some((item) => item instanceof ArrayBuffer)).toBe(true);
		expect(socket.sent).toContain(JSON.stringify({ type: 'CloseStream' }));
	});
});

describe('voice list', () => {
	it('reads Grok voice names without keeping the API key', () => {
		expect(
			readVoiceList(
				JSON.stringify({
					voices: [
						{ voice_id: 'eve', name: 'Eve' },
						{ voice_id: 'ara', name: 'Ara' },
					],
				}),
				'xai-secret',
			),
		).toEqual([
			{ id: 'eve', name: 'Eve' },
			{ id: 'ara', name: 'Ara' },
		]);
		expect(() => readVoiceList('{"voices":[{"voice_id":"xai-secret"}]}', 'xai-secret')).toThrow(
			/could not read/i,
		);
	});
});

class FakeSocket implements LiveSocket {
	sent: Array<string | ArrayBuffer> = [];
	onopen: (() => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	onerror: (() => void) | null = null;
	onclose: (() => void) | null = null;

	constructor() {
		queueMicrotask(() => this.onopen?.());
	}

	send(data: string | ArrayBuffer): void {
		this.sent.push(data);
	}

	close(): void {
		this.onclose?.();
	}

	emit(data: string): void {
		this.onmessage?.({ data });
	}
}

function flush(): Promise<void> {
	return new Promise((resolve) => {
		queueMicrotask(() => queueMicrotask(() => resolve()));
	});
}
