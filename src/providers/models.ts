import { untilAbort } from './abort';
import { chatCompletionsUrl } from './openai-compatible';
import { revealsSensitiveText } from './redact';
import { RequestCancelledError, type HttpClient } from './types';

export type ProviderCheck =
	| { ok: true; models: string[] }
	| { ok: false; message: string };

export function formatProviderCheck(result: ProviderCheck): string {
	if (!result.ok) return result.message;
	if (result.models.length === 0) {
		return 'Connected, but the provider did not list any models.';
	}
	const shown = result.models.slice(0, 8).join(', ');
	const extra =
		result.models.length > 8 ? `, and ${result.models.length - 8} more` : '';
	return `Connected. Models: ${shown}${extra}.`;
}

export async function checkProvider(
	http: HttpClient,
	baseUrl: string,
	apiKey: string,
	signal?: AbortSignal,
): Promise<ProviderCheck> {
	let url: string;
	try {
		url = modelsUrl(baseUrl);
	} catch (error) {
		const message =
			error instanceof Error ? error.message : 'The provider URL is not valid.';
		return { ok: false, message };
	}

	const key = apiKey.trim();
	const headers: Record<string, string> = {};
	if (key) headers.Authorization = `Bearer ${key}`;

	try {
		const response = await untilAbort(
			http({ url, method: 'GET', headers, signal }),
			signal,
		);
		if (signal?.aborted) return { ok: false, message: 'The request was cancelled.' };
		if (response.status < 200 || response.status >= 300) {
			return {
				ok: false,
				message: failureMessage(response.status, response.body, key),
			};
		}
		const models = readModelIds(response.body);
		return { ok: true, models };
	} catch (error) {
		if (signal?.aborted || error instanceof RequestCancelledError) {
			return { ok: false, message: 'The request was cancelled.' };
		}
		return { ok: false, message: 'Could not reach the model provider.' };
	}
}

export function modelsUrl(baseUrl: string): string {
	const chat = chatCompletionsUrl(baseUrl);
	return chat.slice(0, -'/chat/completions'.length) + '/models';
}

function failureMessage(status: number, body: string, apiKey: string): string {
	let detail = '';
	try {
		const parsed: unknown = JSON.parse(body);
		detail = messageFrom(parsed);
	} catch {
		detail = '';
	}
	detail = detail.replace(/\s+/g, ' ').trim().slice(0, 180);
	if (apiKey && revealsSensitiveText(detail, [apiKey])) detail = '';
	if (detail) return `The model request failed (${status}). ${detail}`;
	return `The model request failed (${status}).`;
}

function messageFrom(parsed: unknown): string {
	if (!parsed || typeof parsed !== 'object') return '';
	const record = parsed as { error?: unknown; message?: unknown };
	if (typeof record.error === 'string') return record.error;
	if (record.error && typeof record.error === 'object') {
		const message = (record.error as { message?: unknown }).message;
		if (typeof message === 'string') return message;
	}
	return typeof record.message === 'string' ? record.message : '';
}

function readModelIds(body: string): string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return [];
	}
	if (!parsed || typeof parsed !== 'object') return [];
	const data = (parsed as { data?: unknown }).data;
	if (!Array.isArray(data)) return [];
	const ids: string[] = [];
	for (const item of data) {
		if (!item || typeof item !== 'object') continue;
		const id = (item as { id?: unknown }).id;
		if (typeof id === 'string' && id.trim()) ids.push(id.trim());
	}
	return ids;
}
