import { untilAbort } from '../providers/abort';
import { chatCompletionsUrl } from '../providers/openai-compatible';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';

export async function embedWithProvider(
	http: HttpClient,
	baseUrl: string,
	apiKey: string,
	model: string,
	texts: readonly string[],
	signal?: AbortSignal,
): Promise<number[][]> {
	if (model.trim() === '') throw new ProviderError('Set an embedding model in settings.');
	const key = apiKey.trim();
	const headers: Record<string, string> = { 'Content-Type': 'application/json' };
	if (key) headers.Authorization = `Bearer ${key}`;
	let response;
	try {
		response = await untilAbort(
			http({
				url: embeddingsUrl(baseUrl),
				method: 'POST',
				headers,
				contentType: 'application/json',
				body: JSON.stringify({ model: model.trim(), input: texts }),
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
		throw new ProviderError(failure(response.status, response.body, key, texts));
	}
	return readVectors(response.body, texts.length);
}

export function embeddingsUrl(baseUrl: string): string {
	const chat = chatCompletionsUrl(baseUrl);
	return `${chat.slice(0, -'/chat/completions'.length)}/embeddings`;
}

function failure(
	status: number,
	body: string,
	apiKey: string,
	texts: readonly string[],
): string {
	let detail = '';
	try {
		const parsed: unknown = JSON.parse(body);
		if (parsed && typeof parsed === 'object') {
			const error = (parsed as { error?: { message?: unknown } }).error;
			if (typeof error?.message === 'string') detail = error.message;
		}
	} catch {
		detail = '';
	}
	detail = detail.replace(/\s+/g, ' ').trim().slice(0, 180);
	if (revealsSensitiveText(detail, [apiKey, ...texts])) detail = '';
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}

function readVectors(body: string, expected: number): number[][] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	const data =
		parsed && typeof parsed === 'object'
			? (parsed as { data?: unknown }).data
			: undefined;
	if (!Array.isArray(data)) {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	const vectors: number[][] = [];
	for (const item of data) {
		const embedding =
			item && typeof item === 'object'
				? (item as { embedding?: unknown }).embedding
				: undefined;
		if (!Array.isArray(embedding)) continue;
		vectors.push(embedding.filter((value) => typeof value === 'number'));
	}
	if (vectors.length !== expected) {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
	return vectors;
}
