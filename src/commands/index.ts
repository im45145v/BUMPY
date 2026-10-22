import type { Plugin } from 'obsidian';
import { canCleanNote, canCleanSelection } from '../notes/editor-apply';
import { runCleanup, type CleanupHost } from './cleanup';
import { registerLinkCommands } from './links';
import { registerSpeechCommands } from './speech';
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
						: command.mode === 'auto'
							? canCleanSelection(editor) || canCleanNote(editor)
							: canCleanNote(editor);
				if (!enabled) return false;
				if (!checking) void runCleanup(plugin, editor, command.mode);
				return true;
			},
		});
	}
	registerSpeechCommands(plugin);
	registerLinkCommands(plugin);
}
