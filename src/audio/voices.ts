import { untilAbort } from '../providers/abort';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';

export interface SpeechVoice {
	id: string;
	name: string;
}

const VOICE_URLS = {
	grok: 'https://api.x.ai/v1/tts/voices',
	elevenlabs: 'https://api.elevenlabs.io/v1/voices',
	mistral: 'https://api.mistral.ai/v1/audio/voices',
} as const;

export async function listSpeechVoices(
	http: HttpClient,
	provider: keyof typeof VOICE_URLS,
	apiKey: string,
	signal?: AbortSignal,
): Promise<SpeechVoice[]> {
	const key = apiKey.trim();
	if (key === '') throw new ProviderError(missingVoiceKey(provider));
	const headers: Record<string, string> =
		provider === 'elevenlabs' ? { 'xi-api-key': key } : { Authorization: `Bearer ${key}` };
	let response;
	try {
		response = await untilAbort(
			http({
				url: VOICE_URLS[provider],
				method: 'GET',
				headers,
				signal,
			}),
			signal,
		);
	} catch (error) {
		if (signal?.aborted || error instanceof RequestCancelledError) {
			throw new RequestCancelledError();
		}
		throw new ProviderError('Could not reach the model provider.');
	}
	if (signal?.aborted) throw new RequestCancelledError();
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(`The model request failed (${response.status}).`);
	}
	return readVoiceList(response.body, key);
}

export function readVoiceList(body: string, apiKey: string): SpeechVoice[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	const voices = voiceItems(parsed);
	if (!voices) {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	const listed = voices.flatMap((voice) => {
		if (!voice || typeof voice !== 'object') return [];
		const record = voice as { voice_id?: unknown; id?: unknown; name?: unknown };
		const idValue = typeof record.voice_id === 'string' ? record.voice_id : record.id;
		if (typeof idValue !== 'string' || idValue.trim() === '') return [];
		const name =
			typeof record.name === 'string' && record.name.trim() !== ''
				? record.name.trim()
				: idValue.trim();
		return [{ id: idValue.trim(), name }];
	});
	if (revealsSensitiveText(listed.map((voice) => `${voice.id} ${voice.name}`).join('\n'), [apiKey])) {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	return listed;
}

function missingVoiceKey(provider: keyof typeof VOICE_URLS): string {
	if (provider === 'grok') return 'Add a Grok API key in speech settings.';
	if (provider === 'mistral') return 'Add a Mistral API key in speech settings.';
	return 'Add an ElevenLabs API key in speech settings.';
}

function voiceItems(parsed: unknown): unknown[] | null {
	if (Array.isArray(parsed)) return copyList(parsed);
	if (!parsed || typeof parsed !== 'object') return null;
	const record = parsed as { voices?: unknown; items?: unknown; data?: unknown };
	return copyList(record.voices) ?? copyList(record.items) ?? copyList(record.data);
}

function copyList(value: unknown): unknown[] | null {
	if (!Array.isArray(value)) return null;
	const list: unknown[] = [];
	for (const item of value) list.push(item);
	return list;
}
