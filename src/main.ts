import { Platform, Plugin } from 'obsidian';
import { obsidianVaultSurface } from './bridge/host';
import { createBridgePoller } from './bridge/poll';
import { registerCommands } from './commands';
import { registerKnowledge } from './commands/knowledge';
import { registerSetup } from './commands/setup';
import { registerTaskFeatures } from './commands/tasks';
import { obsidianHttp } from './providers/obsidian-http';
import { RequestScope } from './requests/scope';
import { normalizeSettings, type BumpySettings } from './settings';
import { readFiredReminders } from './tasks/reminders';
import { BumpySettingTab } from './ui/settings-tab';
import { updatePluginData } from './vault/plugin-data';

export default class BumpyPlugin extends Plugin {
	settings!: BumpySettings;
	readonly requests = new RequestScope();
	readonly firedReminders = new Set<string>();
	private saveTimer: number | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new BumpySettingTab(this.app, this));
		registerSetup(this);
		registerCommands(this);
		registerTaskFeatures(this);
		registerKnowledge(this);
		const poll = createBridgePoller(
			obsidianHttp,
			() => this.settings,
			() => obsidianVaultSurface(this),
		);
		this.registerInterval(
			window.setInterval(() => {
				if (Platform.isMobile) return;
				void poll();
			}, 2000),
		);
	}

	onunload(): void {
		this.flushSave();
		this.requests.cancelAll();
	}

	scheduleSave(): void {
		if (this.saveTimer !== null) window.clearTimeout(this.saveTimer);
		this.saveTimer = window.setTimeout(() => {
			this.saveTimer = null;
			void this.saveSettings();
		}, 400);
	}

	private flushSave(): void {
		if (this.saveTimer === null) return;
		window.clearTimeout(this.saveTimer);
		this.saveTimer = null;
		void this.saveSettings();
	}

	async loadSettings(): Promise<void> {
		const stored: unknown = await this.loadData();
		this.settings = normalizeSettings(stored as Partial<BumpySettings>);
		this.firedReminders.clear();
		for (const key of readFiredReminders(stored)) this.firedReminders.add(key);
	}

	async saveSettings(): Promise<void> {
		await updatePluginData(this, (data) => {
			const snapshot = JSON.parse(JSON.stringify(this.settings)) as BumpySettings;
			Object.assign(data, snapshot);
		});
	}
}
