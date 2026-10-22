import { TFile, type App } from 'obsidian';

export async function readInstructionFile(
	app: App,
	path: string,
): Promise<string | null> {
	const file = app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return null;
	return app.vault.cachedRead(file);
}
