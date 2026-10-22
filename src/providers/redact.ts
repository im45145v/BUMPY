import type { ChatMessage } from './types';

const MIN_WORD = 4;
const MIN_SPAN = 8;

/** True when a provider error would reveal note text, a fragment of it, or a credential. */
export function revealsSensitiveText(
	detail: string,
	secrets: readonly string[],
): boolean {
	if (detail.trim() === '') return false;
	const haystack = detail.toLowerCase();
	for (const secret of secrets) {
		if (secretRevealed(haystack, secret)) return true;
	}
	return false;
}

export function secretsFrom(
	apiKey: string,
	messages: readonly ChatMessage[],
	extra: readonly string[] = [],
): string[] {
	const secrets: string[] = [];
	const key = apiKey.trim();
	if (key) secrets.push(key);
	for (const message of messages) {
		if (message.role !== 'user') continue;
		const note = enclosedNote(message.content);
		const text = (note ?? message.content).trim();
		if (text) secrets.push(text);
	}
	for (const item of extra) {
		const text = item.trim();
		if (text) secrets.push(text);
	}
	return secrets;
}

export function enclosedNote(content: string): string | null {
	const open = /<(untrusted_note(?:_[a-z0-9]+)?)>\n/.exec(content);
	const token = open?.[1];
	if (!open || token === undefined || open.index === undefined) return null;
	const start = open.index + open[0].length;
	const end = content.lastIndexOf(`\n</${token}>`);
	if (end < start) return null;
	return content.slice(start, end);
}

function secretRevealed(haystack: string, secret: string): boolean {
	const trimmed = secret.trim().toLowerCase();
	if (trimmed.length === 0) return false;
	if (hasToken(haystack, trimmed)) return true;
	if (trimmed.length < MIN_WORD) return false;

	for (const word of words(trimmed)) {
		if (word.length >= MIN_WORD && hasToken(haystack, word)) return true;
	}
	if (trimmed.length < MIN_SPAN) return false;
	return spansOverlap(haystack, trimmed, MIN_SPAN);
}

function words(text: string): string[] {
	return text.split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 0);
}

function hasToken(haystack: string, token: string): boolean {
	if (token.length === 0) return false;
	let from = 0;
	while (from <= haystack.length - token.length) {
		const at = haystack.indexOf(token, from);
		if (at < 0) return false;
		const before = at === 0 ? '' : (haystack[at - 1] ?? '');
		const afterAt = at + token.length;
		const after = afterAt >= haystack.length ? '' : (haystack[afterAt] ?? '');
		if (!isWordChar(before) && !isWordChar(after)) return true;
		from = at + 1;
	}
	return false;
}

function isWordChar(char: string): boolean {
	return char !== '' && /[\p{L}\p{N}]/u.test(char);
}

function spansOverlap(haystack: string, secret: string, span: number): boolean {
	if (haystack.length < span) return false;
	const grams = new Set<string>();
	for (let i = 0; i <= secret.length - span; i++) {
		grams.add(secret.slice(i, i + span));
	}
	for (let i = 0; i <= haystack.length - span; i++) {
		if (grams.has(haystack.slice(i, i + span))) return true;
	}
	return false;
}
