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
} as const;

export async function listSpeechVoices(
	http: HttpClient,
	provider: keyof typeof VOICE_URLS,
	apiKey: string,
	signal?: AbortSignal,
): Promise<SpeechVoice[]> {
	const key = apiKey.trim();
	if (key === '') {
		throw new ProviderError(
			provider === 'grok'
				? 'Add a Grok API key in speech settings.'
				: 'Add an ElevenLabs API key in speech settings.',
		);
	}
	const headers: Record<string, string> =
		provider === 'grok' ? { Authorization: `Bearer ${key}` } : { 'xi-api-key': key };
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
	const voices =
		parsed && typeof parsed === 'object'
			? (parsed as { voices?: unknown }).voices
			: undefined;
	if (!Array.isArray(voices)) {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	const listed = voices.flatMap((voice) => {
		if (!voice || typeof voice !== 'object') return [];
		const record = voice as { voice_id?: unknown; name?: unknown };
		if (typeof record.voice_id !== 'string' || record.voice_id.trim() === '') return [];
		const name =
			typeof record.name === 'string' && record.name.trim() !== ''
				? record.name.trim()
				: record.voice_id.trim();
		return [{ id: record.voice_id.trim(), name }];
	});
	if (revealsSensitiveText(listed.map((voice) => `${voice.id} ${voice.name}`).join('\n'), [apiKey])) {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	return listed;
}
