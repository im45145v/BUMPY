import { Plugin } from 'obsidian';
import { registerCommands } from './commands';
import { registerKnowledge } from './commands/knowledge';
import { registerTaskFeatures } from './commands/tasks';
import { RequestScope } from './requests/scope';
import { readFiredReminders } from './tasks/reminders';
import { normalizeSettings, type BumpySettings } from './settings';
import { BumpySettingTab } from './ui/settings-tab';

export default class BumpyPlugin extends Plugin {
	settings!: BumpySettings;
	readonly requests = new RequestScope();
	readonly firedReminders = new Set<string>();

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new BumpySettingTab(this.app, this));
		registerCommands(this);
		registerTaskFeatures(this);
		registerKnowledge(this);
	}

	onunload(): void {
		this.requests.cancelAll();
	}

	async loadSettings(): Promise<void> {
		const stored: unknown = await this.loadData();
		this.settings = normalizeSettings(stored as Partial<BumpySettings>);
		this.firedReminders.clear();
		for (const key of readFiredReminders(stored)) this.firedReminders.add(key);
	}

	async saveSettings(): Promise<void> {
		const stored = ((await this.loadData()) ?? {}) as Record<string, unknown>;
		await this.saveData({ ...stored, ...this.settings });
	}
}
