import { untilAbort } from './abort';
import { parseHttpBase } from './endpoint';
import type { ProviderCheck } from './models';
import { revealsSensitiveText, secretsFrom } from './redact';
import {
	ProviderError,
	RequestCancelledError,
	type CompletionRequest,
	type HttpClient,
} from './types';

const MESSAGE_TAIL = '/threads/messages';

export class BackboardProvider {
	constructor(
		private readonly http: HttpClient,
		private readonly baseUrl: string,
		private readonly apiKey: string,
	) {}

	async complete(request: CompletionRequest): Promise<string> {
		const key = this.apiKey.trim();
		if (key === '') throw new ProviderError('Add an API key in settings.');
		if (request.model.trim() === '') throw new ProviderError('Set a model in settings.');
		const response = await postBackboard(
			this.http,
			backboardMessagesUrl(this.baseUrl),
			key,
			JSON.stringify(messageBody(request)),
			request.signal,
		);
		if (response.status < 200 || response.status >= 300) {
			throw new ProviderError(failureMessage(response.status, response.body, key, request));
		}
		const content = readContent(response.body);
		if (content.trim() === '') {
			throw new ProviderError('The model returned an empty response.');
		}
		return content;
	}
}

export async function checkBackboard(
	http: HttpClient,
	baseUrl: string,
	apiKey: string,
	signal?: AbortSignal,
): Promise<ProviderCheck> {
	const key = apiKey.trim();
	if (key === '') return { ok: false, message: 'Add an API key in settings.' };
	let url: string;
	try {
		url = backboardModelsUrl(baseUrl);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'The provider URL is not valid.';
		return { ok: false, message };
	}
	try {
		const response = await untilAbort(
			http({
				url,
				method: 'GET',
				headers: { 'X-API-Key': key },
				signal,
			}),
			signal,
		);
		if (signal?.aborted) return { ok: false, message: 'The request was cancelled.' };
		if (response.status < 200 || response.status >= 300) {
			return { ok: false, message: failureMessage(response.status, response.body, key) };
		}
		return { ok: true, models: readModelNames(response.body) };
	} catch (error) {
		if (signal?.aborted || error instanceof RequestCancelledError) {
			return { ok: false, message: 'The request was cancelled.' };
		}
		return { ok: false, message: 'Could not reach the model provider.' };
	}
}

export function backboardMessagesUrl(baseUrl: string): string {
	const url = parseHttpBase(baseUrl);
	let path = url.pathname.replace(/\/+$/, '');
	if (path.endsWith('/models')) path = path.slice(0, -'/models'.length);
	if (!path.endsWith(MESSAGE_TAIL)) path = `${path}${MESSAGE_TAIL}`;
	url.pathname = path;
	return url.toString();
}

export function backboardModelsUrl(baseUrl: string): string {
	const url = parseHttpBase(baseUrl);
	let path = url.pathname.replace(/\/+$/, '');
	if (path.endsWith(MESSAGE_TAIL)) path = path.slice(0, -MESSAGE_TAIL.length);
	if (path.endsWith('/models')) path = path.slice(0, -'/models'.length);
	url.pathname = `${path}/models`;
	url.searchParams.set('model_type', 'llm');
	url.searchParams.set('limit', '50');
	return url.toString();
}

export function backboardProviderFor(model: string): string {
	const name = model.trim().toLowerCase();
	if (name.startsWith('gemini') || name.startsWith('google/')) return 'google';
	if (name.startsWith('claude')) return 'anthropic';
	if (name.startsWith('grok')) return 'xai';
	if (name.includes('/')) return 'openrouter';
	return 'openai';
}

function messageBody(request: CompletionRequest): unknown {
	const system = request.messages
		.filter((message) => message.role === 'system')
		.map((message) => message.content)
		.join('\n\n');
	const content = request.messages
		.filter((message) => message.role === 'user')
		.map((message) => message.content)
		.join('\n\n');
	return {
		content,
		system_prompt: system,
		model_name: request.model.trim(),
		llm_provider: backboardProviderFor(request.model),
		stream: false,
		memory: 'off',
		web_search: 'off',
		image_generation: 'off',
	};
}

async function postBackboard(
	http: HttpClient,
	url: string,
	apiKey: string,
	body: string,
	signal?: AbortSignal,
) {
	try {
		return await untilAbort(
			http({
				url,
				method: 'POST',
				headers: { 'X-API-Key': apiKey },
				contentType: 'application/json',
				body,
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
}

function failureMessage(
	status: number,
	body: string,
	apiKey: string,
	request?: CompletionRequest,
): string {
	let detail = '';
	try {
		detail = errorMessageFrom(JSON.parse(body) as unknown);
	} catch {
		detail = '';
	}
	detail = detail.replace(/\s+/g, ' ').trim().slice(0, 180);
	const secrets = request
		? secretsFrom(apiKey, request.messages, request.redact ?? [])
		: [apiKey];
	if (revealsSensitiveText(detail, secrets)) detail = '';
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}

function errorMessageFrom(parsed: unknown): string {
	if (!parsed || typeof parsed !== 'object') return '';
	const record = parsed as { error?: unknown; message?: unknown; detail?: unknown };
	if (typeof record.error === 'string') return record.error;
	if (record.error && typeof record.error === 'object') {
		const message = (record.error as { message?: unknown }).message;
		if (typeof message === 'string') return message;
	}
	if (typeof record.message === 'string') return record.message;
	if (typeof record.detail === 'string') return record.detail;
	return '';
}

function readContent(body: string): string {
	try {
		const parsed: unknown = JSON.parse(body);
		if (!parsed || typeof parsed !== 'object') return '';
		const content = (parsed as { content?: unknown }).content;
		return typeof content === 'string' ? content : '';
	} catch {
		throw new ProviderError('The model provider returned a response Bumpy could not read.');
	}
}

function readModelNames(body: string): string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return [];
	}
	const models =
		parsed && typeof parsed === 'object' ? (parsed as { models?: unknown }).models : undefined;
	if (!Array.isArray(models)) return [];
	const names: string[] = [];
	for (const item of models) {
		if (!item || typeof item !== 'object') continue;
		const name = (item as { name?: unknown }).name;
		if (typeof name === 'string' && name.trim()) names.push(name.trim());
	}
	return names;
}
