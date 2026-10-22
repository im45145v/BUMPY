import { untilAbort } from './abort';
import { revealsSensitiveText, secretsFrom } from './redact';
import {
	ProviderError,
	RequestCancelledError,
	type AIProvider,
	type CompletionRequest,
	type HttpClient,
	type HttpResponse,
} from './types';

const OUTER_ERROR_LIMIT = 180;

export class OpenAICompatibleProvider implements AIProvider {
	constructor(
		private readonly http: HttpClient,
		private readonly baseUrl: string,
		private readonly apiKey: string,
	) {}

	async complete(request: CompletionRequest): Promise<string> {
		const url = chatCompletionsUrl(this.baseUrl);
		const apiKey = this.apiKey.trim();
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};
		if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

		let response: HttpResponse;
		try {
			response = await untilAbort(
				this.http({
					url,
					headers,
					body: JSON.stringify({
						model: request.model,
						temperature: request.temperature,
						messages: request.messages,
					}),
					signal: request.signal,
				}),
				request.signal,
			);
		} catch (error) {
			if (request.signal?.aborted || error instanceof RequestCancelledError) {
				throw new RequestCancelledError();
			}
			throw new ProviderError('Could not reach the model provider.');
		}
		if (request.signal?.aborted) throw new RequestCancelledError();

		if (response.status < 200 || response.status >= 300) {
			throw new ProviderError(
				failureMessage(response.status, response.body, apiKey, request),
			);
		}

		return readContent(response.body);
	}
}

export function chatCompletionsUrl(baseUrl: string): string {
	let trimmed = baseUrl.trim().replace(/\/+$/, '');
	if (trimmed.endsWith('/chat/completions')) {
		trimmed = trimmed.slice(0, -'/chat/completions'.length).replace(/\/+$/, '');
	}

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new ProviderError('The provider URL is not valid.');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new ProviderError(
			'The provider URL must start with http:// or https://.',
		);
	}
	return `${trimmed}/chat/completions`;
}

function failureMessage(
	status: number,
	body: string,
	apiKey: string,
	request: CompletionRequest,
): string {
	const detail = safeDetail(body, apiKey, request);
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}

function safeDetail(
	body: string,
	apiKey: string,
	request: CompletionRequest,
): string {
	let detail = '';
	try {
		detail = errorMessageFrom(JSON.parse(body) as unknown);
	} catch {
		detail = '';
	}
	detail = detail.replace(/\s+/g, ' ').trim().slice(0, OUTER_ERROR_LIMIT);
	if (
		revealsSensitiveText(
			detail,
			secretsFrom(apiKey, request.messages, request.redact ?? []),
		)
	) {
		return '';
	}
	return detail;
}

function errorMessageFrom(parsed: unknown): string {
	if (!parsed || typeof parsed !== 'object') return '';
	const record = parsed as { error?: unknown; message?: unknown };
	if (typeof record.error === 'string') return record.error;
	if (record.error && typeof record.error === 'object') {
		const message = (record.error as { message?: unknown }).message;
		if (typeof message === 'string') return message;
	}
	return typeof record.message === 'string' ? record.message : '';
}

function readContent(body: string): string {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		throw new ProviderError(
			'The model provider returned a response Bumpy could not read.',
		);
	}
	const content = extractContent(parsed);
	if (content.trim() === '') {
		throw new ProviderError('The model returned an empty response.');
	}
	return content;
}

function extractContent(parsed: unknown): string {
	if (!parsed || typeof parsed !== 'object') return '';
	const choices = (parsed as { choices?: unknown }).choices;
	if (!Array.isArray(choices)) return '';
	const first: unknown = choices[0];
	if (!first || typeof first !== 'object') return '';
	const message = (first as { message?: unknown }).message;
	if (!message || typeof message !== 'object') return '';
	const content = (message as { content?: unknown }).content;
	if (typeof content === 'string') return content;
	if (!Array.isArray(content)) return '';

	const parts: string[] = [];
	for (const part of content) {
		if (typeof part === 'string') {
			parts.push(part);
			continue;
		}
		if (
			part &&
			typeof part === 'object' &&
			typeof (part as { text?: unknown }).text === 'string'
		) {
			parts.push((part as { text: string }).text);
		}
	}
	return parts.join('');
}
