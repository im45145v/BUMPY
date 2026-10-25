import { Platform, Plugin } from 'obsidian';
import { obsidianVaultSurface } from './bridge/host';
import { closeCallPreview } from './bridge/preview';
import { createBridgePoller } from './bridge/poll';
import { registerCommands } from './commands';
import { registerKnowledge } from './commands/knowledge';
import { registerSetup } from './commands/setup';
import { registerTaskFeatures } from './commands/tasks';
import { obsidianHttp } from './providers/obsidian-http';
import { pluginIndexFile, settleIndexStorage } from './rag/store';
import { RequestScope } from './requests/scope';
import { normalizeSettings, type BumpySettings } from './settings';
import { readFiredReminders } from './tasks/reminders';
import { BumpySettingTab } from './ui/settings-tab';
import {
	applySettingsToPluginData,
	browserSecretStore,
	extractSecrets,
	mergeDeviceSecrets,
	pluginDataHasSecrets,
	readDeviceSecrets,
	secretsFromSettings,
	vaultIdentity,
	writeDeviceSecrets,
} from './vault/device-secrets';
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
		await settleIndexStorage(pluginIndexFile(this), this);
		const poll = createBridgePoller(
			obsidianHttp,
			() => this.settings,
			() => obsidianVaultSurface(this),
			{ onPreview: (open) => { if (!open) closeCallPreview(); } },
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
		const identity = vaultIdentity(this.app);
		const store = browserSecretStore(this.app);
		let device = readDeviceSecrets(store, identity);
		const fromVault = extractSecrets(stored);
		if (!device && fromVault) {
			device = fromVault;
			try {
				writeDeviceSecrets(store, identity, device);
			} catch {
				// Keep the keys in plugin data until this device can store them.
			}
		}
		this.settings = normalizeSettings(
			mergeDeviceSecrets(stored, device) as Partial<BumpySettings>,
		);
		this.firedReminders.clear();
		for (const key of readFiredReminders(stored)) this.firedReminders.add(key);
		if (pluginDataHasSecrets(stored)) await this.saveSettings();
	}

	async saveSettings(): Promise<void> {
		let storedOnDevice = true;
		try {
			writeDeviceSecrets(
				browserSecretStore(this.app),
				vaultIdentity(this.app),
				secretsFromSettings(this.settings),
			);
		} catch {
			storedOnDevice = false;
		}
		await updatePluginData(this, (data) => {
			applySettingsToPluginData(data, this.settings, storedOnDevice);
		});
	}
}
