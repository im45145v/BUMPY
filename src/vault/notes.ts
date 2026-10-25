import { type App } from 'obsidian';
import { isExcluded, type NoteRecord } from '../linking/suggest';

/** Notes longer than this are left out of the index and of briefings. */
export const INDEX_NOTE_CHARS = 200_000;

/** Task lines are still read from a long note. This only stops a pathological file. */
export const TASK_NOTE_CHARS = 2_000_000;

const MAX_NOTE_CHARS = INDEX_NOTE_CHARS;

export interface TimedNote extends NoteRecord {
	mtime: number;
}

export async function readMarkdownNotes(
	app: App,
	excluded: readonly string[],
): Promise<NoteRecord[]> {
	const notes = await readTimedNotes(app, excluded);
	return notes.map(({ path, title, text }) => ({ path, title, text }));
}

export async function readTimedNotes(
	app: App,
	excluded: readonly string[],
): Promise<TimedNote[]> {
	const notes: TimedNote[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		if (isExcluded(file.path, excluded)) continue;
		let text = '';
		try {
			text = await app.vault.cachedRead(file);
		} catch {
			continue;
		}
		if (text.length > MAX_NOTE_CHARS) continue;
		notes.push({
			path: file.path,
			title: file.basename,
			text,
			mtime: file.stat.mtime,
		});
	}
	return notes;
}

/** Tasks, the calendar, and reminders use this. A failed read is listed so a reminder is not forgotten. */
export async function readTaskNotes(
	app: App,
	excluded: readonly string[],
): Promise<{ notes: NoteRecord[]; unread: string[] }> {
	const notes: NoteRecord[] = [];
	const unread: string[] = [];
	for (const file of app.vault.getMarkdownFiles()) {
		if (isExcluded(file.path, excluded)) continue;
		let text = '';
		try {
			text = await app.vault.cachedRead(file);
		} catch {
			unread.push(file.path);
			continue;
		}
		if (text.length > TASK_NOTE_CHARS) {
			unread.push(file.path);
			continue;
		}
		notes.push({ path: file.path, title: file.basename, text });
	}
	return { notes, unread };
}
