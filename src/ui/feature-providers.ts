import { DropdownComponent, Notice, Setting, TextComponent } from 'obsidian';
import { checkBackboard } from '../providers/backboard';
import {
	FEATURES,
	applyFeaturePreset,
	isFeatureSource,
	resolveFeature,
	type FeatureId,
} from '../providers/features';
import { checkProvider, formatProviderCheck } from '../providers/models';
import { obsidianHttp } from '../providers/obsidian-http';
import {
	PRESET_IDS,
	PROVIDER_PRESETS,
	presetModelList,
	usesBackboard,
	withCurrentModel,
	type ProviderPreset,
} from '../providers/presets';
import { applyEmbeddingDefault } from './knowledge-settings';
import type { SettingsOwner } from '../settings';

const URL_DESC = 'Used only when this feature has its own provider.';
const MODEL_DESC = 'Model name for this feature. Used only when it has its own provider.';
const KEY_DESC =
	"API key for this feature. Stored in this vault's plugin data on this device. It is not written into notes.";

interface Widgets {
	details: HTMLElement[];
	url?: TextComponent;
	model?: TextComponent;
	modelMenu?: DropdownComponent;
	key?: TextComponent;
}

export function featureProviderRows(owner: SettingsOwner): Array<{
	name: string;
	desc: string;
	render: (setting: Setting) => void;
}> {
	const widgets = new Map<FeatureId, Widgets>();
	const rows: Array<{
		name: string;
		desc: string;
		render: (setting: Setting) => void;
	}> = [
		{
			name: 'Feature providers',
			desc: 'Give a feature its own provider when a different model is better for that job. Same as default uses the provider above.',
			render: (setting) => {
				setting.setHeading();
			},
		},
	];
	for (const feature of FEATURES) {
		rows.push({
			name: feature.label,
			desc: feature.desc,
			render: (setting) => addSource(setting, owner, feature.id, widgets),
		});
		rows.push({
			name: `${feature.label} URL`,
			desc: URL_DESC,
			render: (setting) =>
				addText(setting, owner, feature.id, 'baseUrl', 'Base URL', widgets),
		});
		if (feature.chat) {
			rows.push({
				name: `${feature.label} model`,
				desc: MODEL_DESC,
				render: (setting) => addFeatureModel(setting, owner, feature.id, widgets),
			});
		}
		rows.push({
			name: `${feature.label} API key`,
			desc: KEY_DESC,
			render: (setting) => addSecret(setting, owner, feature.id, widgets),
		});
	}
	return rows;
}

function addSource(
	setting: Setting,
	owner: SettingsOwner,
	id: FeatureId,
	widgets: Map<FeatureId, Widgets>,
): void {
	setting.addDropdown((dropdown) => {
		dropdown.addOption('shared', 'Same as default');
		for (const preset of PRESET_IDS) {
			dropdown.addOption(preset, PROVIDER_PRESETS[preset].label);
		}
		dropdown.setValue(owner.settings.features[id].source).onChange(async (value) => {
			if (!isFeatureSource(value)) return;
			applyFeaturePreset(owner.settings.features[id], value);
			if (id === 'embeddings' && value !== 'shared') {
				applyEmbeddingDefault(owner, value);
			}
			await owner.saveSettings();
			const widget = widgetsFor(widgets, id);
			widget.url?.setValue(owner.settings.features[id].baseUrl);
			widget.model?.setValue(owner.settings.features[id].model);
			widget.key?.setValue(owner.settings.features[id].apiKey);
			syncFeatureModel(owner, id, widget);
			showDetails(owner, id, widget);
		});
	});
	setting.addButton((button) => {
		button.setButtonText('Check').onClick(() => {
			void checkFeature(owner, id);
		});
	});
}

function addText(
	setting: Setting,
	owner: SettingsOwner,
	id: FeatureId,
	key: 'baseUrl' | 'model',
	placeholder: string,
	widgets: Map<FeatureId, Widgets>,
): void {
	const widget = widgetsFor(widgets, id);
	widget.details.push(settingRow(setting));
	setting.addText((text) => {
		if (key === 'baseUrl') widget.url = text;
		else widget.model = text;
		text
			.setPlaceholder(placeholder)
			.setValue(owner.settings.features[id][key])
			.onChange(async (value) => {
				owner.settings.features[id][key] = value;
				await owner.saveSettings();
			});
	});
	showDetails(owner, id, widget);
}

function addFeatureModel(
	setting: Setting,
	owner: SettingsOwner,
	id: FeatureId,
	widgets: Map<FeatureId, Widgets>,
): void {
	const widget = widgetsFor(widgets, id);
	widget.details.push(settingRow(setting));
	setting.addDropdown((dropdown) => {
		widget.modelMenu = dropdown;
		dropdown.onChange(async (value) => {
			owner.settings.features[id].model = value;
			await owner.saveSettings();
		});
	});
	setting.addText((text) => {
		widget.model = text;
		text
			.setPlaceholder('Model name')
			.setValue(owner.settings.features[id].model)
			.onChange(async (value) => {
				owner.settings.features[id].model = value;
				await owner.saveSettings();
			});
	});
	syncFeatureModel(owner, id, widget);
	showDetails(owner, id, widget);
}

function syncFeatureModel(owner: SettingsOwner, id: FeatureId, widget: Widgets): void {
	const source = owner.settings.features[id].source;
	const preset: ProviderPreset = source === 'shared' ? owner.settings.preset : source;
	const models = withCurrentModel(presetModelList(preset), owner.settings.features[id].model);
	const menu = widget.modelMenu;
	const text = widget.model;
	if (!menu || !text) return;
	const listed = models.length > 0;
	showControl(menu.selectEl, listed);
	showControl(text.inputEl, !listed);
	if (!listed) {
		text.setValue(owner.settings.features[id].model);
		return;
	}
	menu.selectEl.replaceChildren();
	for (const model of models) menu.addOption(model, model);
	const current = owner.settings.features[id].model.trim();
	menu.setValue(models.includes(current) ? current : (models[0] ?? ''));
}

function addSecret(
	setting: Setting,
	owner: SettingsOwner,
	id: FeatureId,
	widgets: Map<FeatureId, Widgets>,
): void {
	const widget = widgetsFor(widgets, id);
	widget.details.push(settingRow(setting));
	setting.addText((text) => {
		widget.key = text;
		text.inputEl.type = 'password';
		text.inputEl.autocomplete = 'off';
		text
			.setPlaceholder('Optional')
			.setValue(owner.settings.features[id].apiKey)
			.onChange(async (value) => {
				owner.settings.features[id].apiKey = value;
				await owner.saveSettings();
			});
	});
	showDetails(owner, id, widget);
}

async function checkFeature(owner: SettingsOwner, id: FeatureId): Promise<void> {
	if (owner.settings.features[id].source === 'shared') {
		new Notice('This feature uses the default provider. Use check connection above.');
		return;
	}
	const endpoint = resolveFeature(owner.settings, id);
	const controller = owner.requests.start();
	const notice = new Notice('Checking the provider…', 0);
	try {
		const check = usesBackboard(endpoint.preset, endpoint.baseUrl)
			? checkBackboard
			: checkProvider;
		const result = await check(
			obsidianHttp,
			endpoint.baseUrl,
			endpoint.apiKey,
			controller.signal,
		);
		if (controller.signal.aborted) return;
		new Notice(formatProviderCheck(result));
	} finally {
		notice.hide();
		owner.requests.finish(controller);
	}
}

function widgetsFor(widgets: Map<FeatureId, Widgets>, id: FeatureId): Widgets {
	const existing = widgets.get(id);
	if (existing) return existing;
	const created: Widgets = { details: [] };
	widgets.set(id, created);
	return created;
}

function showControl(element: HTMLElement, visible: boolean): void {
	element.style.display = visible ? '' : 'none';
}

function showDetails(owner: SettingsOwner, id: FeatureId, widget: Widgets): void {
	const visible = owner.settings.features[id].source !== 'shared';
	for (const row of widget.details) row.style.display = visible ? '' : 'none';
}

function settingRow(setting: Setting): HTMLElement {
	return (setting as Setting & { settingEl: HTMLElement }).settingEl;
}
