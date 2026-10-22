import { untilAbort } from '../providers/abort';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
	type HttpResponse,
} from '../providers/types';
import { MAX_AUDIO_BYTES } from './limits';

const TTS_URL = 'https://api.gradium.ai/api/post/speech/tts';
const STT_URL = 'https://api.gradium.ai/api/post/speech/asr';
export const GRADIUM_RECORDING_TYPES = ['audio/ogg;codecs=opus', 'audio/ogg'];

export function gradiumContentType(mime: string): string | null {
	const value = mime.toLowerCase();
	if (value.includes('wav')) return 'audio/wav';
	if (value.includes('ogg')) return 'audio/ogg';
	if (value.includes('opus') && !value.includes('webm')) return 'audio/opus';
	return null;
}

export function readGradiumTranscript(body: string, apiKey: string): string {
	const parts: string[] = [];
	for (const line of body.split(/\n+/)) {
		const trimmed = line.trim();
		if (trimmed === '') continue;
		let message: unknown;
		try {
			message = JSON.parse(trimmed);
		} catch {
			continue;
		}
		if (!message || typeof message !== 'object') continue;
		const record = message as { type?: unknown; text?: unknown; message?: unknown };
		if (record.type === 'error') {
			const detail = typeof record.message === 'string' ? record.message : '';
			throw new ProviderError(
				revealsSensitiveText(detail, [apiKey]) || detail.trim() === ''
					? 'Gradium could not transcribe the audio.'
					: `Gradium could not transcribe the audio. ${detail.replace(/\s+/g, ' ').trim().slice(0, 180)}`,
			);
		}
		if (record.type === 'text' && typeof record.text === 'string' && record.text.trim()) {
			parts.push(record.text.trim());
		}
	}
	const text = parts.join(' ').replace(/\s+/g, ' ').trim();
	if (text === '') throw new ProviderError('The model returned an empty response.');
	return text;
}

export async function transcribeWithGradium(
	http: HttpClient,
	audio: Uint8Array,
	mime: string,
	apiKey: string,
	signal?: AbortSignal,
	language = 'any',
): Promise<string> {
	const key = requireKey(apiKey);
	const contentType = gradiumContentType(mime);
	if (!contentType) {
		throw new ProviderError(
			'Gradium cannot transcribe the recording format from this app. Choose OpenAI, Groq, Grok, or Deepgram for speech to text.',
		);
	}
	if (audio.byteLength === 0) throw new Error('No speech was heard.');
	if (audio.byteLength > MAX_AUDIO_BYTES) {
		throw new Error('This recording is too large to transcribe.');
	}
	const url = new URL(STT_URL);
	url.searchParams.set('json_config', JSON.stringify({ language: language.trim() || 'any' }));
	const response = await sendGradium(
		http,
		url.toString(),
		key,
		new Uint8Array(audio).buffer,
		contentType,
		signal,
	);
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(failureMessage(response.status, response.body, key));
	}
	return readGradiumTranscript(response.body, key);
}

export async function synthesizeWithGradium(
	http: HttpClient,
	text: string,
	voice: string,
	apiKey: string,
	signal?: AbortSignal,
	rewriteRules?: string | null,
): Promise<ArrayBuffer> {
	const key = requireKey(apiKey);
	const payload: Record<string, unknown> = {
		text,
		voice_id: voice.trim() || 'YTpq7expH9539ERJ',
		output_format: 'wav',
		only_audio: true,
	};
	if (rewriteRules) payload.json_config = { rewrite_rules: rewriteRules };
	const response = await sendGradium(
		http,
		TTS_URL,
		key,
		JSON.stringify(payload),
		'application/json',
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
	if (key === '') throw new ProviderError('Add a Gradium API key in speech settings.');
	return key;
}

async function sendGradium(
	http: HttpClient,
	url: string,
	apiKey: string,
	body: string | ArrayBuffer,
	contentType: string,
	signal?: AbortSignal,
): Promise<HttpResponse> {
	try {
		const response = await untilAbort(
			http({
				url,
				method: 'POST',
				headers: { 'x-api-key': apiKey },
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

function failureMessage(
	status: number,
	body: string,
	apiKey: string,
	text = '',
): string {
	const detail = body.replace(/\s+/g, ' ').trim().slice(0, 180);
	const secrets = [apiKey, text].filter((secret) => secret.trim() !== '');
	if (revealsSensitiveText(detail, secrets) || detail.startsWith('<')) {
		return `The model request failed (${status}).`;
	}
	if (detail.startsWith('{') || detail.startsWith('[')) {
		return `The model request failed (${status}).`;
	}
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}
