import { untilAbort } from '../providers/abort';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';
import type { SearchHit } from './note';

export async function searchWeb(
	http: HttpClient,
	provider: 'searxng' | 'brave',
	url: string,
	apiKey: string,
	query: string,
	signal?: AbortSignal,
): Promise<SearchHit[]> {
	if (provider === 'brave') return searchBrave(http, apiKey, query, signal);
	if (url.trim() === '') throw new ProviderError('Set a search URL in settings.');
	return searchSearxng(http, url, query, signal);
}

function searchUrl(baseUrl: string, query: string): string {
	let url: URL;
	try {
		url = new URL(`${baseUrl.trim().replace(/\/+$/, '')}/search`);
	} catch {
		throw new ProviderError('The search URL is not valid.');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new ProviderError('The search URL must start with http:// or https://.');
	}
	url.searchParams.set('q', query);
	url.searchParams.set('format', 'json');
	return url.toString();
}

async function searchSearxng(
	http: HttpClient,
	baseUrl: string,
	query: string,
	signal?: AbortSignal,
): Promise<SearchHit[]> {
	const body = await getJson(http, searchUrl(baseUrl, query), {}, signal, [query]);
	const parsed = parseJson(body);
	const results =
		parsed && typeof parsed === 'object'
			? (parsed as { results?: unknown }).results
			: undefined;
	if (!Array.isArray(results)) return [];
	return results.flatMap((item) => hitFrom(item, 'content'));
}

async function searchBrave(
	http: HttpClient,
	apiKey: string,
	query: string,
	signal?: AbortSignal,
): Promise<SearchHit[]> {
	const key = apiKey.trim();
	if (key === '') throw new ProviderError('Set a search API key in settings.');
	const url = new URL('https://api.search.brave.com/res/v1/web/search');
	url.searchParams.set('q', query);
	const body = await getJson(
		http,
		url.toString(),
		{ 'X-Subscription-Token': key },
		signal,
		[key, query],
	);
	const parsed = parseJson(body);
	const web =
		parsed && typeof parsed === 'object'
			? (parsed as { web?: { results?: unknown } }).web
			: undefined;
	const results = web?.results;
	if (!Array.isArray(results)) return [];
	return results.flatMap((item) => hitFrom(item, 'description'));
}

function hitFrom(value: unknown, snippetKey: 'content' | 'description'): SearchHit[] {
	if (!value || typeof value !== 'object') return [];
	const record = value as { title?: unknown; url?: unknown; content?: unknown; description?: unknown };
	const title = typeof record.title === 'string' ? record.title.trim() : '';
	const url = typeof record.url === 'string' ? record.url.trim() : '';
	const snippetValue = record[snippetKey];
	const snippet = typeof snippetValue === 'string' ? snippetValue.trim() : '';
	if (!title || !/^https?:\/\//.test(url)) return [];
	return [{ title, url, snippet }];
}

async function getJson(
	http: HttpClient,
	url: string,
	headers: Record<string, string>,
	signal: AbortSignal | undefined,
	secrets: readonly string[],
): Promise<string> {
	let response;
	try {
		response = await untilAbort(http({ url, method: 'GET', headers, signal }), signal);
	} catch (error) {
		if (signal?.aborted || error instanceof RequestCancelledError) {
			throw new RequestCancelledError();
		}
		throw new ProviderError('Could not reach the search provider.');
	}
	if (signal?.aborted) throw new RequestCancelledError();
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(failure(response.status, response.body, secrets));
	}
	return response.body;
}

function failure(status: number, body: string, secrets: readonly string[]): string {
	let detail = '';
	try {
		const parsed: unknown = JSON.parse(body);
		if (parsed && typeof parsed === 'object') {
			const message = (parsed as { message?: unknown; error?: unknown }).message;
			if (typeof message === 'string') detail = message;
			else if (typeof (parsed as { error?: unknown }).error === 'string') {
				detail = (parsed as { error: string }).error;
			}
		}
	} catch {
		detail = '';
	}
	detail = detail.replace(/\s+/g, ' ').trim().slice(0, 180);
	if (revealsSensitiveText(detail, secrets)) detail = '';
	if (detail) return `The search request failed (${status}). ${detail}`;
	return `The search request failed (${status}).`;
}

function parseJson(body: string): unknown {
	try {
		return JSON.parse(body) as unknown;
	} catch {
		throw new ProviderError('The search provider returned a response Bumpy could not read.');
	}
}
