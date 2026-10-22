import { type App } from 'obsidian';
import { isExcluded, type NoteRecord } from '../linking/suggest';

const MAX_NOTE_CHARS = 200_000;

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
