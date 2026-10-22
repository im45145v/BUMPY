import type { ApplyDecision } from '../notes/apply';

export interface NoteRecord {
	path: string;
	title: string;
	text: string;
}

export interface LinkEdit {
	start: number;
	end: number;
	original: string;
	replacement: string;
	targetPath: string;
	reason: string;
}

export interface RelatedNote {
	path: string;
	title: string;
	score: number;
	terms: string[];
}

const GENERIC_TITLES = new Set([
	'readme',
	'index',
	'todo',
	'notes',
	'note',
	'home',
	'untitled',
]);

const STOP = new Set([
	'that',
	'this',
	'with',
	'from',
	'have',
	'your',
	'about',
	'there',
	'their',
	'would',
	'could',
	'should',
	'which',
	'what',
	'when',
	'where',
	'were',
	'been',
	'they',
	'them',
	'then',
	'than',
	'into',
	'also',
	'just',
	'more',
	'some',
	'such',
	'only',
	'other',
	'over',
	'after',
	'before',
	'because',
]);

export function parseFolders(value: string): string[] {
	return value
		.split(',')
		.map((part) => part.trim().replace(/^\/+|\/+$/g, ''))
		.filter((part) => part.length > 0);
}

export function isExcluded(path: string, folders: readonly string[]): boolean {
	return folders.some(
		(folder) => path === folder || path.startsWith(`${folder}/`),
	);
}

export function suggestLinkEdits(
	current: NoteRecord,
	notes: readonly NoteRecord[],
	excluded: readonly string[],
): LinkEdit[] {
	const blocked = protectedRanges(current.text);
	const candidates = notes
		.filter(
			(note) =>
				note.path !== current.path &&
				!isExcluded(note.path, excluded) &&
				linkableTitle(note.title),
		)
		.sort((a, b) => b.title.length - a.title.length);

	const edits: LinkEdit[] = [];
	for (const note of candidates) {
		let from = 0;
		while (edits.length < 20) {
			const found = indexOfPhrase(current.text, note.title, from);
			if (found < 0) break;
			const end = found + note.title.length;
			from = end;
			if (overlaps(found, end, blocked)) continue;
			const original = current.text.slice(found, end);
			const replacement =
				original === note.title ? `[[${note.title}]]` : `[[${note.title}|${original}]]`;
			edits.push({
				start: found,
				end,
				original,
				replacement,
				targetPath: note.path,
				reason: `Link this mention to ${note.title}.`,
			});
			blocked.push([found, end]);
		}
	}
	return edits.sort((a, b) => a.start - b.start);
}

export function applyLinkEdits(text: string, edits: readonly LinkEdit[]): string | null {
	const ordered = [...edits].sort((a, b) => b.start - a.start);
	let next = text;
	for (const edit of ordered) {
		if (next.slice(edit.start, edit.end) !== edit.original) return null;
		next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end);
	}
	return next;
}

export function applyReviewedLinks(
	current: string,
	snapshot: string,
	edits: readonly LinkEdit[],
): ApplyDecision {
	if (edits.length === 0) {
		return { ok: false, reason: 'There are no links to apply.' };
	}
	if (current !== snapshot) {
		return {
			ok: false,
			reason:
				'This note changed while the preview was open. Discard it and try again.',
		};
	}
	const next = applyLinkEdits(current, edits);
	if (next === null || next === current) {
		return { ok: false, reason: 'The links could not be applied.' };
	}
	return { ok: true, next };
}

export function relatedNotes(
	current: NoteRecord,
	notes: readonly NoteRecord[],
	excluded: readonly string[],
	limit = 8,
): RelatedNote[] {
	const currentTerms = new Set(terms(current.text));
	const ranked: RelatedNote[] = [];
	for (const note of notes) {
		if (note.path === current.path || isExcluded(note.path, excluded)) continue;
		const noteTerms = terms(note.text);
		const shared = noteTerms.filter((term) => currentTerms.has(term));
		const titleHit = current.text.toLowerCase().includes(note.title.toLowerCase());
		const score = shared.length + (titleHit ? 2 : 0);
		if (score < 2) continue;
		ranked.push({
			path: note.path,
			title: note.title,
			score,
			terms: shared.slice(0, 5),
		});
	}
	return ranked.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}

export function findBacklinks(
	current: NoteRecord,
	notes: readonly NoteRecord[],
): Array<{ path: string; title: string }> {
	const names = [current.title, current.path.replace(/\.md$/i, '')]
		.map((name) => name.trim().toLowerCase())
		.filter((name) => name.length > 1);
	const found: Array<{ path: string; title: string }> = [];
	for (const note of notes) {
		if (note.path === current.path) continue;
		const lower = note.text.toLowerCase();
		if (names.some((name) => lower.includes(`[[${name}`))) {
			found.push({ path: note.path, title: note.title });
		}
	}
	return found;
}

function linkableTitle(title: string): boolean {
	const trimmed = title.trim();
	return trimmed.length >= 4 && !GENERIC_TITLES.has(trimmed.toLowerCase());
}

function terms(text: string): string[] {
	const seen = new Set<string>();
	for (const token of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
		if (token.length < 4 || STOP.has(token)) continue;
		seen.add(token);
	}
	return [...seen];
}

function protectedRanges(text: string): Array<[number, number]> {
	const ranges: Array<[number, number]> = [];
	const patterns = [
		/```[\s\S]*?```/g,
		/`[^`\n]+`/g,
		/!?\[\[[^\]]+\]\]/g,
		/\[[^\]]+\]\([^)]+\)/g,
		/<https?:\/\/[^>\s]+>/g,
	];
	for (const pattern of patterns) {
		for (const match of text.matchAll(pattern)) {
			if (match.index === undefined) continue;
			ranges.push([match.index, match.index + match[0].length]);
		}
	}
	return ranges;
}

function overlaps(
	start: number,
	end: number,
	ranges: ReadonlyArray<readonly [number, number]>,
): boolean {
	return ranges.some((range) => start < range[1] && end > range[0]);
}

function indexOfPhrase(text: string, phrase: string, from: number): number {
	const lower = text.toLowerCase();
	const needle = phrase.toLowerCase();
	let at = from;
	while (at <= lower.length - needle.length) {
		const found = lower.indexOf(needle, at);
		if (found < 0) return -1;
		const before = found === 0 ? '' : (text[found - 1] ?? '');
		const afterIndex = found + phrase.length;
		const after = afterIndex >= text.length ? '' : (text[afterIndex] ?? '');
		if (!isWordChar(before) && !isWordChar(after)) return found;
		at = found + 1;
	}
	return -1;
}

function isWordChar(char: string): boolean {
	return char !== '' && /[\p{L}\p{N}]/u.test(char);
}
