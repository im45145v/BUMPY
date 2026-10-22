import { untilAbort } from '../providers/abort';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';

const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
export const ELEVEN_READING_MODEL = 'eleven_v3';
export const ELEVEN_READING_VOICE = 'JBFqnCBsd6RMkjVDRZzb';

export async function synthesizeWithElevenLabs(
	http: HttpClient,
	text: string,
	voice: string,
	model: string,
	apiKey: string,
	signal?: AbortSignal,
	language?: string,
): Promise<ArrayBuffer> {
	const key = requireKey(apiKey);
	const voiceId = voice.trim() || ELEVEN_READING_VOICE;
	const body: Record<string, string> = {
		text,
		model_id: model.trim() || ELEVEN_READING_MODEL,
	};
	if (language) body.language_code = language;
	const response = await sendEleven(
		http,
		`${TTS_URL}/${encodeURIComponent(voiceId)}`,
		key,
		JSON.stringify(body),
		signal,
	);
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(failureMessage(response.status, response.body, key, text));
	}
	if (!response.bytes || response.bytes.byteLength === 0) {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	return response.bytes;
}

function requireKey(apiKey: string): string {
	const key = apiKey.trim();
	if (key === '') throw new ProviderError('Add an ElevenLabs API key in speech settings.');
	return key;
}

async function sendEleven(
	http: HttpClient,
	url: string,
	apiKey: string,
	body: string,
	signal?: AbortSignal,
) {
	try {
		const response = await untilAbort(
			http({
				url,
				method: 'POST',
				headers: { 'xi-api-key': apiKey },
				contentType: 'application/json',
				body,
				signal,
			}),
			signal,
		);
		if (signal?.aborted) throw new RequestCancelledError();
		return response;
	} catch (error) {
		if (signal?.aborted || error instanceof RequestCancelledError) {
			throw new RequestCancelledError();
		}
		throw new ProviderError('Could not reach the model provider.');
	}
}

function failureMessage(status: number, body: string, apiKey: string, text: string): string {
	let detail = '';
	try {
		const parsed: unknown = JSON.parse(body);
		detail = elevenDetail(parsed);
	} catch {
		detail = '';
	}
	detail = detail.replace(/\s+/g, ' ').trim().slice(0, 180);
	if (revealsSensitiveText(detail, [apiKey, text].filter((secret) => secret.trim()))) {
		detail = '';
	}
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}

function elevenDetail(parsed: unknown): string {
	if (!parsed || typeof parsed !== 'object') return '';
	const detail = (parsed as { detail?: unknown }).detail;
	if (typeof detail === 'string') return detail;
	if (detail && typeof detail === 'object') {
		const message = (detail as { message?: unknown }).message;
		if (typeof message === 'string') return message;
	}
	const message = (parsed as { message?: unknown }).message;
	return typeof message === 'string' ? message : '';
}
