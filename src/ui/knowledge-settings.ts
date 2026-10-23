import { DropdownComponent, Setting } from 'obsidian';
import {
	EMBEDDING_MODEL_CHOICES,
	defaultEmbeddingModel,
	withCurrentModel,
	type ProviderPreset,
} from '../providers/presets';
import type { BumpySettings, SettingsOwner } from '../settings';

let embeddingMenu: DropdownComponent | undefined;

export function applyEmbeddingDefault(owner: SettingsOwner, preset: ProviderPreset): void {
	const next = defaultEmbeddingModel(preset);
	if (next === '') return;
	owner.settings.embeddingModel = next;
	embeddingMenu?.setValue(next);
}

const EMBEDDINGS: Array<{ value: BumpySettings['embeddings']; label: string }> = [
	{ value: 'local', label: 'Local hashing' },
	{ value: 'provider', label: 'Provider embeddings' },
];

const SEARCH: Array<{ value: BumpySettings['searchProvider']; label: string }> = [
	{ value: 'off', label: 'Off' },
	{ value: 'searxng', label: 'Searxng' },
	{ value: 'brave', label: 'Brave' },
	{ value: 'tavily', label: 'Tavily' },
];

export function renderKnowledgeSettings(
	containerEl: HTMLElement,
	owner: SettingsOwner,
): void {
	new Setting(containerEl).setName('Vault search').setHeading();
	for (const row of knowledgeRows(owner)) {
		row.render(new Setting(containerEl).setName(row.name).setDesc(row.desc));
	}
}

export function knowledgeRows(owner: SettingsOwner): Array<{
	name: string;
	desc: string;
	render: (setting: Setting) => void;
}> {
	return [
		{
			name: 'Embeddings',
			desc: 'Local hashing stays on this device. Provider embeddings send note passages to the embeddings provider, or to the default provider when Embeddings is Same as default.',
			render: (setting) => addEmbeddings(setting, owner),
		},
		{
			name: 'Embedding model',
			desc: 'Used only when embeddings are set to the provider. Choosing Mistral selects mistral-embed. A saved name that is not on the list stays available.',
			render: (setting) => addEmbeddingModel(setting, owner),
		},
		{
			name: 'Web search',
			desc: 'Off until you choose a provider. Research uses only URLs that provider returns.',
			render: (setting) => addSearch(setting, owner),
		},
		{
			name: 'Search URL',
			desc: 'Searxng base URL. Brave and Tavily use their own API addresses.',
			render: (setting) => addText(setting, owner, 'searchUrl', 'http://127.0.0.1:8080'),
		},
		{
			name: 'Search API key',
			desc: "Stored in this vault's plugin data on this device. Brave and Tavily use it. It is not written into notes.",
			render: (setting) => addSecret(setting, owner),
		},
		{
			name: 'Journal folder',
			desc: 'Folder used for journal summaries and thought traces.',
			render: (setting) => addText(setting, owner, 'journalFolder', 'Journal'),
		},
		{
			name: 'Journal days',
			desc: 'How many days a journal summary includes, from 1 to 365.',
			render: (setting) => addDays(setting, owner),
		},
	];
}

function addEmbeddingModel(setting: Setting, owner: SettingsOwner): void {
	setting.addDropdown((dropdown) => {
		embeddingMenu = dropdown;
		const options = withCurrentModel(EMBEDDING_MODEL_CHOICES, owner.settings.embeddingModel);
		for (const model of options) dropdown.addOption(model, model);
		const current = owner.settings.embeddingModel.trim();
		dropdown.setValue(options.includes(current) ? current : (options[0] ?? ''));
		dropdown.onChange(async (value) => {
			owner.settings.embeddingModel = value;
			await owner.saveSettings();
		});
	});
}

function addEmbeddings(setting: Setting, owner: SettingsOwner): void {
	setting.addDropdown((dropdown) => {
		for (const choice of EMBEDDINGS) dropdown.addOption(choice.value, choice.label);
		dropdown.setValue(owner.settings.embeddings).onChange(async (value) => {
			if (value !== 'local' && value !== 'provider') return;
			owner.settings.embeddings = value;
			await owner.saveSettings();
		});
	});
}

function addSearch(setting: Setting, owner: SettingsOwner): void {
	setting.addDropdown((dropdown) => {
		for (const choice of SEARCH) dropdown.addOption(choice.value, choice.label);
		dropdown.setValue(owner.settings.searchProvider).onChange(async (value) => {
			if (value !== 'off' && value !== 'searxng' && value !== 'brave' && value !== 'tavily') {
				return;
			}
			owner.settings.searchProvider = value;
			await owner.saveSettings();
		});
	});
}

function addText(
	setting: Setting,
	owner: SettingsOwner,
	key: 'embeddingModel' | 'searchUrl' | 'journalFolder',
	placeholder: string,
): void {
	setting.addText((text) => {
		text
			.setPlaceholder(placeholder)
			.setValue(owner.settings[key])
			.onChange(async (value) => {
				owner.settings[key] = value;
				await owner.saveSettings();
			});
	});
}

function addSecret(setting: Setting, owner: SettingsOwner): void {
	setting.addText((text) => {
		text.inputEl.type = 'password';
		text.inputEl.autocomplete = 'off';
		text
			.setPlaceholder('Optional')
			.setValue(owner.settings.searchApiKey)
			.onChange(async (value) => {
				owner.settings.searchApiKey = value;
				await owner.saveSettings();
			});
	});
}

function addDays(setting: Setting, owner: SettingsOwner): void {
	setting.addText((text) => {
		text
			.setPlaceholder('7')
			.setValue(String(owner.settings.journalDays))
			.onChange(async (value) => {
				const days = Number(value);
				if (!Number.isInteger(days) || days < 1 || days > 365) return;
				owner.settings.journalDays = days;
				await owner.saveSettings();
			});
	});
}
