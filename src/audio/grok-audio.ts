import { untilAbort } from '../providers/abort';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';
import { MAX_AUDIO_BYTES } from './limits';
import { encodeMultipart } from './multipart';

const STT_URL = 'https://api.x.ai/v1/stt';
const TTS_URL = 'https://api.x.ai/v1/tts';

export async function transcribeWithGrok(
	http: HttpClient,
	audio: Uint8Array,
	mime: string,
	apiKey: string,
	model: string,
	signal?: AbortSignal,
): Promise<string> {
	const key = requireKey(apiKey, 'Grok');
	if (audio.byteLength === 0) throw new Error('No speech was heard.');
	if (audio.byteLength > MAX_AUDIO_BYTES) {
		throw new Error('This recording is too large to transcribe.');
	}
	const form = encodeMultipart([
		{ name: 'model', value: model.trim() || 'grok-voice-transcribe-2.0' },
		{
			name: 'file',
			filename: 'speech.webm',
			type: mime || 'application/octet-stream',
			data: audio,
		},
	]);
	const body = await postGrok(http, STT_URL, key, form.body, form.contentType, signal, [
		key,
	]);
	return readText(body, key);
}

export async function synthesizeWithGrok(
	http: HttpClient,
	text: string,
	voice: string,
	apiKey: string,
	signal?: AbortSignal,
	language = 'auto',
): Promise<ArrayBuffer> {
	const key = requireKey(apiKey, 'Grok');
	const response = await sendGrok(
		http,
		TTS_URL,
		key,
		JSON.stringify({
			text,
			voice_id: voice.trim() || 'eve',
			language: language.trim() || 'auto',
		}),
		'application/json',
		signal,
	);
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(failureMessage(response.status, response.body, [key, text]));
	}
	if (!response.bytes || response.bytes.byteLength === 0) {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	return response.bytes;
}

function requireKey(apiKey: string, name: string): string {
	const key = apiKey.trim();
	if (key === '') throw new ProviderError(`Add a ${name} API key in speech settings.`);
	return key;
}

async function postGrok(
	http: HttpClient,
	url: string,
	apiKey: string,
	body: ArrayBuffer,
	contentType: string,
	signal: AbortSignal | undefined,
	secrets: readonly string[],
): Promise<string> {
	const response = await sendGrok(http, url, apiKey, body, contentType, signal);
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(failureMessage(response.status, response.body, secrets));
	}
	return response.body;
}

async function sendGrok(
	http: HttpClient,
	url: string,
	apiKey: string,
	body: string | ArrayBuffer,
	contentType: string,
	signal?: AbortSignal,
) {
	try {
		const response = await untilAbort(
			http({
				url,
				method: 'POST',
				headers: { Authorization: `Bearer ${apiKey}` },
				contentType,
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

function readText(body: string, apiKey: string): string {
	let text = '';
	try {
		const parsed: unknown = JSON.parse(body);
		const value =
			parsed && typeof parsed === 'object' ? (parsed as { text?: unknown }).text : undefined;
		text = typeof value === 'string' ? value.trim() : '';
	} catch {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	if (text === '') throw new ProviderError('The model returned an empty response.');
	if (revealsSensitiveText(text, [apiKey])) {
		throw new ProviderError('The model returned an empty response.');
	}
	return text;
}

function failureMessage(status: number, body: string, secrets: readonly string[]): string {
	let detail = '';
	try {
		const parsed: unknown = JSON.parse(body);
		if (parsed && typeof parsed === 'object') {
			const error = (parsed as { error?: unknown }).error;
			if (typeof error === 'string') detail = error;
			else if (error && typeof error === 'object') {
				const message = (error as { message?: unknown }).message;
				if (typeof message === 'string') detail = message;
			}
		}
	} catch {
		detail = '';
	}
	detail = detail.replace(/\s+/g, ' ').trim().slice(0, 180);
	if (revealsSensitiveText(detail, secrets.filter((secret) => secret.trim()))) detail = '';
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}
