import { Notice, type App } from 'obsidian';
import { TextPreviewModal } from '../ui/text-preview';
import { createNoteIfAbsent } from '../vault/create-note';

export function previewNewNote(
	app: App,
	options: {
		title: string;
		path: string;
		text: string;
		warnings?: readonly string[];
	},
): void {
	new TextPreviewModal(app, {
		title: options.title,
		note: 'Nothing is written until you create this note.',
		text: options.text,
		confirm: 'Create note',
		warnings: options.warnings,
		onConfirm: async () => {
			try {
				const result = await createNoteIfAbsent(app, options.path, options.text);
				if (result === 'exists') {
					new Notice('That note already exists, so it was left unchanged.');
					return false;
				}
				await app.workspace.openLinkText(options.path, options.path, 'tab');
				return true;
			} catch {
				new Notice('Could not create the note.');
				return false;
			}
		},
	}).open();
}
