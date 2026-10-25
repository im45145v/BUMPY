import { untilAbort } from '../providers/abort';
import { parseHttpBase } from '../providers/endpoint';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';
import { isCitationUrl, type SearchHit } from './note';

export async function searchWeb(
	http: HttpClient,
	provider: 'searxng' | 'brave' | 'tavily' | 'serpapi',
	url: string,
	apiKey: string,
	query: string,
	signal?: AbortSignal,
): Promise<SearchHit[]> {
	if (provider === 'brave') return searchBrave(http, apiKey, query, signal);
	if (provider === 'tavily') return searchTavily(http, apiKey, query, signal);
	if (provider === 'serpapi') return searchSerpapi(http, apiKey, query, signal);
	if (url.trim() === '') throw new ProviderError('Set a search URL in settings.');
	return searchSearxng(http, url, query, signal);
}

function searchUrl(baseUrl: string, query: string): string {
	const url = parseHttpBase(baseUrl, 'search URL');
	let path = url.pathname.replace(/\/+$/, '');
	if (!path.endsWith('/search')) path = `${path}/search`;
	url.pathname = path;
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
	const body = await requestJson(http, searchUrl(baseUrl, query), {}, signal, [query]);
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
	const body = await requestJson(
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

async function searchTavily(
	http: HttpClient,
	apiKey: string,
	query: string,
	signal?: AbortSignal,
): Promise<SearchHit[]> {
	const key = apiKey.trim();
	if (key === '') throw new ProviderError('Set a search API key in settings.');
	const topic = query.trim();
	if (topic === '') throw new ProviderError('Enter a topic to research.');
	if (topic.length > 400) {
		throw new ProviderError('This topic is too long to search (400 characters).');
	}
	const body = await requestJson(
		http,
		'https://api.tavily.com/search',
		{ Authorization: `Bearer ${key}` },
		signal,
		[key, topic],
		JSON.stringify({
			query: topic,
			search_depth: 'basic',
			max_results: 5,
		}),
	);
	const parsed = parseJson(body);
	const results =
		parsed && typeof parsed === 'object'
			? (parsed as { results?: unknown }).results
			: undefined;
	if (!Array.isArray(results)) return [];
	return results.flatMap((item) => hitFrom(item, 'content'));
}

async function searchSerpapi(
	http: HttpClient,
	apiKey: string,
	query: string,
	signal?: AbortSignal,
): Promise<SearchHit[]> {
	const key = apiKey.trim();
	if (key === '') throw new ProviderError('Set a search API key in settings.');
	const topic = query.trim();
	if (topic === '') throw new ProviderError('Enter a topic to research.');
	if (topic.length > 400) {
		throw new ProviderError('This topic is too long to search (400 characters).');
	}
	const url = new URL('https://serpapi.com/search.json');
	url.searchParams.set('engine', 'google');
	url.searchParams.set('q', topic);
	url.searchParams.set('num', '5');
	url.searchParams.set('json_restrictor', 'organic_results');
	url.searchParams.set('api_key', key);
	const body = await requestJson(http, url.toString(), {}, signal, [key, topic]);
	const parsed = parseJson(body);
	if (!parsed || typeof parsed !== 'object') return [];
	const record = parsed as { organic_results?: unknown; error?: unknown };
	if (typeof record.error === 'string' && !Array.isArray(record.organic_results)) {
		throw new ProviderError(searchFailure(record.error, [key, topic]));
	}
	if (!Array.isArray(record.organic_results)) return [];
	return record.organic_results.flatMap((item) => hitFrom(item, 'snippet', 'link'));
}

function searchFailure(detail: string, secrets: readonly string[]): string {
	const clean = visibleSearchDetail(detail, secrets);
	if (!clean) return 'The search request failed.';
	return `The search request failed. ${clean}`;
}

function visibleSearchDetail(detail: string, secrets: readonly string[]): string {
	const clean = detail
		.replace(/https?:\/\/\S+/gi, '')
		.replace(/api_key=[^\s&]+/gi, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, 180);
	if (!clean || revealsSensitiveText(clean, secrets)) return '';
	return clean;
}

function hitFrom(
	value: unknown,
	snippetKey: 'content' | 'description' | 'snippet',
	urlKey: 'url' | 'link' = 'url',
): SearchHit[] {
	if (!value || typeof value !== 'object') return [];
	const record = value as {
		title?: unknown;
		url?: unknown;
		link?: unknown;
		content?: unknown;
		description?: unknown;
		snippet?: unknown;
	};
	const title = typeof record.title === 'string' ? record.title.trim() : '';
	const urlValue = record[urlKey];
	const url = typeof urlValue === 'string' ? urlValue.trim() : '';
	const snippetValue = record[snippetKey];
	const snippet = typeof snippetValue === 'string' ? snippetValue.trim() : '';
	if (!title || !isCitationUrl(url)) return [];
	return [{ title, url, snippet }];
}

async function requestJson(
	http: HttpClient,
	url: string,
	headers: Record<string, string>,
	signal: AbortSignal | undefined,
	secrets: readonly string[],
	body?: string,
): Promise<string> {
	let response;
	try {
		response = await untilAbort(
			http({
				url,
				method: body === undefined ? 'GET' : 'POST',
				headers,
				body,
				contentType: body === undefined ? undefined : 'application/json',
				signal,
			}),
			signal,
		);
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
			const record = parsed as { message?: unknown; error?: unknown; detail?: unknown };
			if (typeof record.message === 'string') detail = record.message;
			else if (typeof record.error === 'string') detail = record.error;
			else if (typeof record.detail === 'string') detail = record.detail;
		}
	} catch {
		detail = '';
	}
	detail = visibleSearchDetail(detail, secrets);
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
