import { Plugin } from 'obsidian';
import { registerCommands } from './commands';
import {
	BumpySettingTab,
	DEFAULT_SETTINGS,
	type BumpySettings,
} from './settings';

export default class BumpyPlugin extends Plugin {
	settings!: BumpySettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new BumpySettingTab(this.app, this));
		registerCommands(this);
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<BumpySettings>,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
