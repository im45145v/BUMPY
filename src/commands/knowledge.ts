import type { Plugin } from 'obsidian';
import type { CleanupHost } from './cleanup';
import { registerAskCommands } from './ask';
import { registerInsightCommands } from './insights';
import { registerResearchCommands } from './research';

export interface DataHost extends CleanupHost {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

export function registerKnowledge(
	plugin: DataHost & Pick<Plugin, 'addCommand'>,
): void {
	registerAskCommands(plugin);
	registerResearchCommands(plugin);
	registerInsightCommands(plugin);
}
