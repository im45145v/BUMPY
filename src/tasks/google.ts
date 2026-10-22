import { untilAbort } from '../providers/abort';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';
import type { TrackedEvent } from './sync';

export async function listGoogleEvents(
	http: HttpClient,
	calendarId: string,
	token: string,
	timeMin: string,
	timeMax: string,
	signal?: AbortSignal,
): Promise<TrackedEvent[]> {
	const events: TrackedEvent[] = [];
	const seenTokens = new Set<string>();
	let pageToken = '';
	for (let page = 0; page < 20; page++) {
		const url = new URL(
			`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
		);
		url.searchParams.set('singleEvents', 'true');
		url.searchParams.set('maxResults', '250');
		url.searchParams.set('timeMin', timeMin);
		url.searchParams.set('timeMax', timeMax);
		if (pageToken) url.searchParams.set('pageToken', pageToken);
		const body = await googleRequest(http, url.toString(), token, 'GET', undefined, signal);
		events.push(...readEvents(body));
		const next = nextPageToken(body);
		if (!next || seenTokens.has(next)) return events;
		seenTokens.add(next);
		pageToken = next;
	}
	return events;
}

export async function createGoogleEvent(
	http: HttpClient,
	calendarId: string,
	token: string,
	event: { title: string; date: string },
	signal?: AbortSignal,
): Promise<TrackedEvent> {
	const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
	const body = await googleRequest(
		http,
		url,
		token,
		'POST',
		JSON.stringify(eventBody(event)),
		signal,
	);
	const created = readEvent(parseJson(body));
	if (!created) throw new ProviderError('Google Calendar returned an unreadable event.');
	return created;
}

export async function updateGoogleEvent(
	http: HttpClient,
	calendarId: string,
	token: string,
	event: TrackedEvent,
	signal?: AbortSignal,
): Promise<TrackedEvent> {
	const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`;
	const body = await googleRequest(
		http,
		url,
		token,
		'PUT',
		JSON.stringify(eventBody(event)),
		signal,
	);
	const updated = readEvent(parseJson(body));
	if (!updated) throw new ProviderError('Google Calendar returned an unreadable event.');
	return updated;
}

function eventBody(event: { title: string; date: string }): unknown {
	return {
		summary: event.title,
		start: { date: event.date },
		end: { date: nextDate(event.date) },
	};
}

function nextDate(iso: string): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!match) return iso;
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 1);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function googleRequest(
	http: HttpClient,
	url: string,
	token: string,
	method: 'GET' | 'POST' | 'PUT',
	body: string | undefined,
	signal?: AbortSignal,
): Promise<string> {
	const key = token.trim();
	if (key === '') throw new ProviderError('Add a Google Calendar access token in settings.');
	let response;
	try {
		response = await untilAbort(
			http({
				url,
				method,
				headers: { Authorization: `Bearer ${key}` },
				contentType: body ? 'application/json' : undefined,
				body,
				signal,
			}),
			signal,
		);
	} catch (error) {
		if (signal?.aborted || error instanceof RequestCancelledError) {
			throw new RequestCancelledError();
		}
		throw new ProviderError('Could not reach Google Calendar.');
	}
	if (signal?.aborted) throw new RequestCancelledError();
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(failure(response.status, response.body, key));
	}
	return response.body;
}

function parseJson(body: string): unknown {
	try {
		return JSON.parse(body) as unknown;
	} catch {
		throw new ProviderError('Google Calendar returned an unreadable event.');
	}
}

function failure(status: number, body: string, token: string): string {
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
	if (revealsSensitiveText(detail, [token])) detail = '';
	if (status === 401) return 'Google Calendar declined the access token.';
	if (detail) return `Google Calendar request failed (${status}). ${detail}`;
	return `Google Calendar request failed (${status}).`;
}

function nextPageToken(body: string): string {
	try {
		const parsed: unknown = JSON.parse(body);
		const token =
			parsed && typeof parsed === 'object'
				? (parsed as { nextPageToken?: unknown }).nextPageToken
				: undefined;
		return typeof token === 'string' ? token : '';
	} catch {
		return '';
	}
}

function readEvents(body: string): TrackedEvent[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		throw new ProviderError('Google Calendar returned an unreadable event.');
	}
	const items =
		parsed && typeof parsed === 'object'
			? (parsed as { items?: unknown }).items
			: undefined;
	if (!Array.isArray(items)) return [];
	return items.flatMap((item) => {
		const event = readEvent(item);
		return event ? [event] : [];
	});
}

function readEvent(value: unknown): TrackedEvent | null {
	if (!value || typeof value !== 'object') return null;
	const record = value as {
		id?: unknown;
		summary?: unknown;
		start?: { date?: unknown; dateTime?: unknown };
	};
	if (typeof record.id !== 'string' || typeof record.summary !== 'string') return null;
	const date =
		typeof record.start?.date === 'string'
			? record.start.date
			: typeof record.start?.dateTime === 'string'
				? record.start.dateTime.slice(0, 10)
				: '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	return { id: record.id, title: record.summary, date };
}
