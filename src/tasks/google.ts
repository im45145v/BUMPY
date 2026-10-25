import { untilAbort } from '../providers/abort';
import { revealsSensitiveText } from '../providers/redact';
import {
	ProviderError,
	RequestCancelledError,
	type HttpClient,
} from '../providers/types';
import type { TrackedEvent } from './sync';

export async function refreshGoogleAccessToken(
	http: HttpClient,
	clientId: string,
	clientSecret: string,
	refreshToken: string,
	signal?: AbortSignal,
): Promise<string> {
	const body = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		refresh_token: refreshToken,
		grant_type: 'refresh_token',
	});
	let response;
	try {
		response = await untilAbort(
			http({
				url: 'https://oauth2.googleapis.com/token',
				method: 'POST',
				headers: {},
				contentType: 'application/x-www-form-urlencoded',
				body: body.toString(),
				signal,
			}),
			signal,
		);
	} catch (error) {
		if (signal?.aborted || error instanceof RequestCancelledError) throw new RequestCancelledError();
		throw new ProviderError('Could not reach Google to renew the access token.');
	}
	if (signal?.aborted) throw new RequestCancelledError();
	if (response.status < 200 || response.status >= 300) {
		throw new ProviderError(
			'Google did not renew the access token. Check the client ID, client secret, and refresh token in settings.',
		);
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(response.body) as unknown;
	} catch {
		throw new ProviderError('Google returned an unreadable token.');
	}
	const access =
		parsed && typeof parsed === 'object'
			? (parsed as { access_token?: unknown }).access_token
			: undefined;
	if (typeof access !== 'string' || access.trim() === '') {
		throw new ProviderError('Google did not return a new access token.');
	}
	return access.trim();
}

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
	event: { title: string; date: string; time?: string | null; timeZone?: string },
	signal?: AbortSignal,
): Promise<TrackedEvent> {
	const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
	const body = await googleRequest(
		http,
		url,
		token,
		'POST',
		JSON.stringify(googleEventBody(event)),
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
		'PATCH',
		JSON.stringify(googleEventBody(event)),
		signal,
	);
	const updated = readEvent(parseJson(body));
	if (!updated) throw new ProviderError('Google Calendar returned an unreadable event.');
	return updated;
}

export function googleEventBody(event: {
	title: string;
	date: string;
	time?: string | null;
	timeZone?: string;
}): unknown {
	const timed = timedRange(event);
	if (timed) {
		return {
			summary: event.title,
			start: { dateTime: timed.start, timeZone: timed.timeZone },
			end: { dateTime: timed.end, timeZone: timed.timeZone },
		};
	}
	return {
		summary: event.title,
		start: { date: event.date },
		end: { date: nextDate(event.date) },
	};
}

function timedRange(event: {
	date: string;
	time?: string | null;
	timeZone?: string;
}): { start: string; end: string; timeZone: string } | null {
	const match = /^(\d{2}):(\d{2})$/.exec(event.time ?? '');
	if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return null;
	const hour = Number(match[1]);
	const minute = Number(match[2]);
	if (hour > 23 || minute > 59) return null;
	const startMinute = hour * 60 + minute;
	const endMinute = startMinute + 30;
	const endClock = endMinute % (24 * 60);
	const endDate = shiftDate(event.date, Math.floor(endMinute / (24 * 60)));
	const endTime = `${String(Math.floor(endClock / 60)).padStart(2, '0')}:${String(endClock % 60).padStart(2, '0')}`;
	const time = `${match[1]}:${match[2]}`;
	return {
		start: `${event.date}T${time}:00`,
		end: `${endDate}T${endTime}:00`,
		timeZone: event.timeZone?.trim() || localTimeZone(),
	};
}

function shiftDate(iso: string, days: number): string {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
	if (!match || days === 0) return iso;
	const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function localTimeZone(): string {
	try {
		return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
	} catch {
		return 'UTC';
	}
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
	method: 'GET' | 'POST' | 'PUT' | 'PATCH',
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
	if (status === 401) {
		return 'The Google access token expired. Paste a new one in settings, or add a refresh token so sync can renew it.';
	}
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
	const allDay = typeof record.start?.date === 'string' ? record.start.date : '';
	const timed = typeof record.start?.dateTime === 'string' ? record.start.dateTime : '';
	const clock = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(timed);
	const date = allDay || clock?.[1] || '';
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
	return { id: record.id, title: record.summary, date, time: clock?.[2] ?? null };
}
