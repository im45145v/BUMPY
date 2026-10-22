import { TFile, type App } from 'obsidian';

export async function createNoteIfAbsent(
	app: App,
	path: string,
	text: string,
): Promise<'created' | 'exists'> {
	if (app.vault.getAbstractFileByPath(path)) return 'exists';
	const slash = path.lastIndexOf('/');
	if (slash > 0) {
		const folder = path.slice(0, slash);
		if (!app.vault.getAbstractFileByPath(folder)) {
			await app.vault.createFolder(folder);
		}
	}
	if (app.vault.getAbstractFileByPath(path) instanceof TFile) return 'exists';
	await app.vault.create(path, text);
	return 'created';
}
