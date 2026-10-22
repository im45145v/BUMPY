import type { Plugin } from 'obsidian';
import { canCleanNote, canCleanSelection } from '../notes/editor-apply';
import { runCleanup, type CleanupHost } from './cleanup';
import { CLEANUP_COMMANDS } from './specs';

export function registerCommands(
	plugin: CleanupHost & Pick<Plugin, 'addCommand'>,
): void {
	for (const command of CLEANUP_COMMANDS) {
		plugin.addCommand({
			id: command.id,
			name: command.name,
			editorCheckCallback: (checking, editor) => {
				const enabled =
					command.mode === 'selection'
						? canCleanSelection(editor)
						: canCleanNote(editor);
				if (!enabled) return false;
				if (!checking) void runCleanup(plugin, editor, command.mode);
				return true;
			},
		});
	}
}
