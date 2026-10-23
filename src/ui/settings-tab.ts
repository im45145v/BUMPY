import {
	App,
	DropdownComponent,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TextComponent,
} from 'obsidian';
import { checkBackboard } from '../providers/backboard';
import { checkProvider, formatProviderCheck } from '../providers/models';
import { obsidianHttp } from '../providers/obsidian-http';
import {
	PRESET_IDS,
	PROVIDER_PRESETS,
	applyPresetSelection,
	isProviderPreset,
	presetModelList,
	usesBackboard,
	withCurrentModel,
} from '../providers/presets';
import {
	type BumpySettings,
	type SettingsOwner,
} from '../settings';
import { featureProviderRows } from './feature-providers';
import { knowledgeRows, renderKnowledgeSettings } from './knowledge-settings';
import { closeSettings, openSetup } from './setup-view';
import { renderSpeechSettings, speechRows } from './speech-settings';
import { renderCallSettings, callRows } from './call-settings';
import { renderTaskSettings, taskRows } from './task-settings';

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
				name: 'Setup',
				desc: SETUP_DESC,
				render: (setting) => this.addSetup(setting),
			},
			{
				name: 'Provider',
				desc: PROVIDER_DESC,
				render: (setting) => this.addPreset(setting),
			},
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
				desc: MODEL_DESC,
				render: (setting) => this.addModel(setting),
			},
			{
				name: 'API key',
				desc: API_KEY_DESC,
				render: (setting) => this.addApiKey(setting),
			},
			{
				name: 'Excluded folders',
				desc: 'Comma-separated folders to skip for links, tasks, and the index.',
				control: {
					type: 'text',
					key: 'excludedFolders',
					placeholder: '.trash',
				},
			},
			{
				name: 'Connection',
				desc: 'Asks the provider for its model list. The API key is not shown.',
				render: (setting) => this.addConnectionCheck(setting),
			},
			...featureProviderRows(this.owner),
			...speechRows(this.owner),
			...taskRows(this.owner),
			...knowledgeRows(this.owner),
			...callRows(this.owner),
		];
	}

	// Obsidian before 1.13 renders this instead.
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.addSetup(new Setting(containerEl).setName('Setup').setDesc(SETUP_DESC));

		this.addPreset(
			new Setting(containerEl).setName('Provider').setDesc(PROVIDER_DESC),
		);

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

		this.addModel(new Setting(containerEl).setName('Model').setDesc(MODEL_DESC));

		this.addApiKey(
			new Setting(containerEl).setName('API key').setDesc(API_KEY_DESC),
		);

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc(
				'Comma-separated folders to skip for links, tasks, and the index.',
			)
			.addText((text) =>
				text
					.setPlaceholder('.trash')
					.setValue(this.owner.settings.excludedFolders)
					.onChange(async (value) => {
						this.owner.settings.excludedFolders = value;
						await this.owner.saveSettings();
					}),
			);

		this.addConnectionCheck(
			new Setting(containerEl)
				.setName('Connection')
				.setDesc('Asks the provider for its model list. The API key is not shown.'),
		);
		for (const row of featureProviderRows(this.owner)) {
			row.render(new Setting(containerEl).setName(row.name).setDesc(row.desc));
		}
		renderSpeechSettings(containerEl, this.owner);
		renderTaskSettings(containerEl, this.owner);
		renderKnowledgeSettings(containerEl, this.owner);
		renderCallSettings(containerEl, this.owner);
	}

	private addSetup(setting: Setting): void {
		setting.addButton((button) => {
			button.setButtonText('Open setup').setCta().onClick(() => {
				void openSetup(this.app).then(() => closeSettings(this.app));
			});
		});
	}

	private addPreset(setting: Setting): void {
		setting.addDropdown((dropdown) => {
			for (const id of PRESET_IDS) {
				dropdown.addOption(id, PROVIDER_PRESETS[id].label);
			}
			dropdown.setValue(this.owner.settings.preset).onChange(async (value) => {
				if (!isProviderPreset(value)) return;
				applyPresetSelection(this.owner.settings, value);
				await this.owner.saveSettings();
				this.syncModel();
				this.display();
			});
		});
	}

	private syncModel: () => void = () => {};

	private addModel(setting: Setting): void {
		let text: TextComponent | undefined;
		let menu: DropdownComponent | undefined;
		setting.addDropdown((dropdown) => {
			menu = dropdown;
			dropdown.onChange(async (value) => {
				this.owner.settings.model = value;
				await this.owner.saveSettings();
			});
		});
		setting.addText((field) => {
			text = field;
			field
				.setPlaceholder('Model name')
				.setValue(this.owner.settings.model)
				.onChange(async (value) => {
					this.owner.settings.model = value;
					await this.owner.saveSettings();
				});
		});
		this.syncModel = () => {
			const models = withCurrentModel(
				presetModelList(this.owner.settings.preset),
				this.owner.settings.model,
			);
			if (!menu || !text) return;
			const listed = models.length > 0;
			showControl(menu.selectEl, listed);
			showControl(text.inputEl, !listed);
			if (!listed) {
				text.setValue(this.owner.settings.model);
				return;
			}
			menu.selectEl.replaceChildren();
			for (const model of models) menu.addOption(model, model);
			const current = this.owner.settings.model.trim();
			menu.setValue(models.includes(current) ? current : (models[0] ?? ''));
		};
		this.syncModel();
	}

	private addApiKey(setting: Setting): void {
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
	}

	private addConnectionCheck(setting: Setting): void {
		setting.addButton((button) => {
			button.setButtonText('Check connection').onClick(() => {
				void this.checkConnection();
			});
		});
	}

	private async checkConnection(): Promise<void> {
		const controller = this.owner.requests.start();
		const notice = new Notice('Checking the provider…', 0);
		try {
			const check = usesBackboard(
				this.owner.settings.preset,
				this.owner.settings.baseUrl,
			)
				? checkBackboard
				: checkProvider;
			const result = await check(
				obsidianHttp,
				this.owner.settings.baseUrl,
				this.owner.settings.apiKey,
				controller.signal,
			);
			if (controller.signal.aborted) return;
			new Notice(formatProviderCheck(result));
		} finally {
			notice.hide();
			this.owner.requests.finish(controller);
		}
	}
}

function showControl(element: HTMLElement, visible: boolean): void {
	element.style.display = visible ? '' : 'none';
}

const SETUP_DESC =
	'Steps for each provider, including local servers. Ollama can download a model from this page.';

const MODEL_DESC =
	'Choose a model from the provider list. A saved name that is not on the list stays available. Ollama, LM Studio, OpenRouter, and Custom keep the name you type.';

const PROVIDER_DESC =
	'Choosing a provider fills its usual URL and, when one is known, a starting model. Choose Custom to keep the URL as you typed it. Each feature below can use a different provider.';

const PROVIDER_URL_DESC =
	'OpenAI-compatible providers, including Anthropic, Gemini, Groq, OpenRouter, Mistral, DeepSeek, and xAI, use this base URL. Backboard uses its own API. Leave the API key empty for a local server that does not require one.';

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
