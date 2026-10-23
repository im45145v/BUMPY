import { untilAbort } from '../providers/abort';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
	type HttpResponse,
} from '../providers/types';

const SPEECH_URL = 'https://api.mistral.ai/v1/audio/speech';

export async function synthesizeWithMistral(
	http: HttpClient,
	text: string,
	voice: string,
	model: string,
	apiKey: string,
	signal?: AbortSignal,
): Promise<ArrayBuffer> {
	const key = apiKey.trim();
	if (key === '') throw new ProviderError('Add a Mistral API key in speech settings.');
	const voiceId = voice.trim();
	if (voiceId === '') {
		throw new ProviderError('List voices and choose a Mistral voice.');
	}
	const spokenModel = model.trim() || 'voxtral-mini-tts-2603';
	let response: HttpResponse;
	try {
		response = await untilAbort(
			http({
				url: SPEECH_URL,
				method: 'POST',
				headers: { Authorization: `Bearer ${key}` },
				contentType: 'application/json',
				body: JSON.stringify({
					model: spokenModel,
					input: text,
					voice_id: voiceId,
					response_format: 'mp3',
				}),
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
		throw new ProviderError(failureMessage(response.status, response.body, [key, text]));
	}
	return audioFrom(response, [key, text]);
}

function audioFrom(response: HttpResponse, secrets: readonly string[]): ArrayBuffer {
	const trimmed = response.body.trim();
	if (trimmed.startsWith('{')) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(trimmed);
		} catch {
			parsed = undefined;
		}
		const data =
			parsed && typeof parsed === 'object'
				? (parsed as { audio_data?: unknown }).audio_data
				: undefined;
		if (typeof data === 'string' && data.trim() !== '') {
			if (revealsSensitiveText(data, secrets)) {
				throw new ProviderError('The model provider returned a response Bumpy could not read.');
			}
			return decodeBase64(data);
		}
	}
	if (response.bytes && response.bytes.byteLength > 0) return response.bytes;
	throw new ProviderError('The model provider returned a response Bumpy could not read.');
}

function decodeBase64(value: string): ArrayBuffer {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes.buffer;
}

function failureMessage(status: number, body: string, secrets: readonly string[]): string {
	let detail = '';
	try {
		const parsed: unknown = JSON.parse(body);
		if (parsed && typeof parsed === 'object') {
			const error = (parsed as { error?: unknown; detail?: unknown }).error;
			if (typeof error === 'string') detail = error;
			else if (error && typeof error === 'object') {
				const message = (error as { message?: unknown }).message;
				if (typeof message === 'string') detail = message;
			}
			if (!detail) {
				const message = (parsed as { detail?: unknown }).detail;
				if (typeof message === 'string') detail = message;
			}
		}
	} catch {
		detail = '';
	}
	detail = detail.replace(/\s+/g, ' ').trim().slice(0, 180);
	if (revealsSensitiveText(detail, secrets.filter((secret) => secret.trim() !== ''))) {
		detail = '';
	}
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}
