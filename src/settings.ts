import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

export interface BumpySettings {
	baseUrl: string;
	model: string;
	apiKey: string;
}

export const DEFAULT_SETTINGS: BumpySettings = {
	baseUrl: 'http://127.0.0.1:11434/v1',
	model: '',
	apiKey: '',
};

export interface SettingsOwner {
	settings: BumpySettings;
	saveSettings(): Promise<void>;
}

export class BumpySettingTab extends PluginSettingTab {
	private readonly owner: SettingsOwner;

	constructor(app: App, plugin: Plugin & SettingsOwner) {
		super(app, plugin);
		this.owner = plugin;
	}

	// Obsidian 1.13+ uses this for settings search and skips display().
	// The API key stays a custom row so the field can be a password input.
	getSettingDefinitions(): SettingDefinition[] {
		return [
			{
				name: 'Provider URL',
				desc: PROVIDER_URL_DESC,
				control: {
					type: 'text',
					key: 'baseUrl',
					placeholder: 'Base URL',
				},
			},
			{
				name: 'Model',
				desc: 'Name expected by the provider.',
				control: {
					type: 'text',
					key: 'model',
					placeholder: 'Model name',
				},
			},
			{
				name: 'API key',
				desc: API_KEY_DESC,
				render: (setting: Setting) => {
					setting.addText((text) => {
						text.inputEl.type = 'password';
						text.inputEl.autocomplete = 'off';
						text
							.setPlaceholder('Optional')
							.setValue(this.owner.settings.apiKey)
							.onChange(async (value) => {
								this.owner.settings.apiKey = value;
								await this.owner.saveSettings();
							});
					});
				},
			},
		];
	}

	// Obsidian before 1.13 renders this instead.
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Provider URL')
			.setDesc(PROVIDER_URL_DESC)
			.addText((text) =>
				text
					.setPlaceholder('Base URL')
					.setValue(this.owner.settings.baseUrl)
					.onChange(async (value) => {
						this.owner.settings.baseUrl = value;
						await this.owner.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('Model')
			.setDesc('Name expected by the provider.')
			.addText((text) =>
				text
					.setPlaceholder('Model name')
					.setValue(this.owner.settings.model)
					.onChange(async (value) => {
						this.owner.settings.model = value;
						await this.owner.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName('API key')
			.setDesc(API_KEY_DESC)
			.addText((text) => {
				text.inputEl.type = 'password';
				text.inputEl.autocomplete = 'off';
				text
					.setPlaceholder('Optional')
					.setValue(this.owner.settings.apiKey)
					.onChange(async (value) => {
						this.owner.settings.apiKey = value;
						await this.owner.saveSettings();
					});
			});
	}
}

const PROVIDER_URL_DESC =
	'OpenAI-compatible base URL. Leave the API key empty for a local server that does not require one.';

const API_KEY_DESC =
	"Stored in this vault's plugin data on this device. It is not written into notes.";

interface TextControlDefinition {
	name: string;
	desc: string;
	control: {
		type: 'text';
		key: keyof BumpySettings;
		placeholder: string;
	};
}

interface RenderedSettingDefinition {
	name: string;
	desc: string;
	render: (setting: Setting) => void;
}

type SettingDefinition = TextControlDefinition | RenderedSettingDefinition;
