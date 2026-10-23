import { untilAbort } from '../providers/abort';
import { joinApiPath } from '../providers/endpoint';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';
import { MAX_AUDIO_BYTES } from './limits';
import { encodeMultipart } from './multipart';

export interface AudioEndpoint {
	baseUrl: string;
	apiKey: string;
	model: string;
	signal?: AbortSignal;
	keyHeader?: 'authorization' | 'x-api-key';
}

export async function transcribeAudio(
	http: HttpClient,
	audio: Uint8Array,
	mime: string,
	endpoint: AudioEndpoint,
): Promise<string> {
	if (endpoint.model.trim() === '') {
		throw new Error('Set a transcription model in settings.');
	}
	if (audio.byteLength === 0) throw new Error('No speech was heard.');
	if (audio.byteLength > MAX_AUDIO_BYTES) {
		throw new Error('This recording is too large to transcribe.');
	}

	const form = encodeMultipart([
		{ name: 'model', value: endpoint.model.trim() },
		{
			name: 'file',
			filename: 'speech.webm',
			type: mime || 'application/octet-stream',
			data: audio,
		},
		{ name: 'response_format', value: 'json' },
	]);
	const response = await postAudio(
		http,
		audioUrl(endpoint.baseUrl, 'audio/transcriptions'),
		endpoint,
		form.body,
		form.contentType,
		[],
	);
	let parsed: unknown;
	try {
		parsed = JSON.parse(response);
	} catch {
		throw new ProviderError(
			'The model provider returned a response Bumpy could not read.',
		);
	}
	const text =
		parsed && typeof parsed === 'object'
			? (parsed as { text?: unknown }).text
			: undefined;
	if (typeof text !== 'string' || text.trim() === '') {
		throw new ProviderError('The model returned an empty response.');
	}
	return text.trim();
}

export async function synthesizeSpeech(
	http: HttpClient,
	text: string,
	voice: string,
	endpoint: AudioEndpoint,
): Promise<ArrayBuffer> {
	if (endpoint.model.trim() === '') {
		throw new Error('Set a speech model in settings.');
	}
	const key = endpoint.apiKey.trim();
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (key) headers.Authorization = `Bearer ${key}`;
	let response;
	try {
		response = await untilAbort(
			http({
				url: audioUrl(endpoint.baseUrl, 'audio/speech'),
				method: 'POST',
				headers,
				contentType: 'application/json',
				body: JSON.stringify({
					model: endpoint.model.trim(),
					voice: voice.trim() || 'alloy',
					input: text,
				}),
				signal: endpoint.signal,
			}),
			endpoint.signal,
		);
	} catch (error) {
		if (endpoint.signal?.aborted || error instanceof RequestCancelledError) {
			throw new RequestCancelledError();
		}
		throw new ProviderError('Could not reach the model provider.');
	}
	if (endpoint.signal?.aborted) throw new RequestCancelledError();
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(failureMessage(response.status, response.body, [key, text]));
	}
	if (!response.bytes || response.bytes.byteLength === 0) {
		throw new ProviderError(
			'The model provider returned a response Bumpy could not read.',
		);
	}
	return response.bytes;
}

export function audioUrl(
	baseUrl: string,
	path: 'audio/transcriptions' | 'audio/speech',
): string {
	return joinApiPath(baseUrl, path);
}

async function postAudio(
	http: HttpClient,
	url: string,
	endpoint: AudioEndpoint,
	body: ArrayBuffer,
	contentType: string,
	secrets: readonly string[],
): Promise<string> {
	const key = endpoint.apiKey.trim();
	const headers: Record<string, string> = {};
	if (key && endpoint.keyHeader === 'x-api-key') headers['x-api-key'] = key;
	else if (key) headers.Authorization = `Bearer ${key}`;
	let response;
	try {
		response = await untilAbort(
			http({
				url,
				method: 'POST',
				headers,
				contentType,
				body,
				signal: endpoint.signal,
			}),
			endpoint.signal,
		);
	} catch (error) {
		if (endpoint.signal?.aborted || error instanceof RequestCancelledError) {
			throw new RequestCancelledError();
		}
		throw new ProviderError('Could not reach the model provider.');
	}
	if (endpoint.signal?.aborted) throw new RequestCancelledError();
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(
			failureMessage(response.status, response.body, [key, ...secrets]),
		);
	}
	return response.body;
}

function failureMessage(
	status: number,
	body: string,
	secrets: readonly string[],
): string {
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
	if (revealsSensitiveText(detail, secrets.filter((secret) => secret.trim()))) {
		detail = '';
	}
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}
