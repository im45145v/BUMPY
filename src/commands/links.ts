import { Notice, type Plugin } from 'obsidian';
import {
	findBacklinks,
	parseFolders,
	relatedNotes,
	suggestLinkEdits,
} from '../linking/suggest';
import type { CleanupEditor } from '../notes/editor-apply';
import { LinksModal } from '../ui/links-modal';
import { readMarkdownNotes } from '../vault/notes';
import type { CleanupHost } from './cleanup';
import { LINK_COMMANDS } from './link-specs';

export function registerLinkCommands(
	plugin: CleanupHost & Pick<Plugin, 'addCommand'>,
): void {
	plugin.addCommand({
		id: LINK_COMMANDS[0].id,
		name: LINK_COMMANDS[0].name,
		editorCallback: (editor: CleanupEditor) => {
			void openLinks(plugin, editor, 'suggest');
		},
	});
	plugin.addCommand({
		id: LINK_COMMANDS[1].id,
		name: LINK_COMMANDS[1].name,
		editorCallback: (editor: CleanupEditor) => {
			void openLinks(plugin, editor, 'related');
		},
	});
}

async function openLinks(
	host: CleanupHost,
	editor: CleanupEditor,
	mode: 'suggest' | 'related',
): Promise<void> {
	const file = host.app.workspace.getActiveFile();
	if (!file) {
		new Notice('Open a note first.');
		return;
	}
	const excluded = parseFolders(host.settings.excludedFolders);
	const notes = await readMarkdownNotes(host.app, excluded);
	const current = notes.find((note) => note.path === file.path) ?? {
		path: file.path,
		title: file.basename,
		text: editor.getValue(),
	};
	const edits = mode === 'suggest' ? suggestLinkEdits(current, notes, excluded) : [];
	const related = relatedNotes(current, notes, excluded);
	const backlinks = findBacklinks(current, notes);
	if (edits.length === 0 && related.length === 0 && backlinks.length === 0) {
		new Notice('No related notes or links to suggest.');
		return;
	}
	new LinksModal(
		host.app,
		editor,
		editor.getValue(),
		file.path,
		edits,
		related,
		backlinks,
	).open();
}
