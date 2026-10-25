import { DropdownComponent, Notice, Setting, TextComponent } from 'obsidian';
import {
	SPEECH_INPUT_DESC,
	SPEECH_OUTPUT_DESC,
} from '../commands/speech-specs';
import { SPEECH_LANGUAGES, isSpeechLanguage } from '../audio/languages';
import {
	SPEECH_INPUTS,
	SPEECH_MODELS,
	SPEECH_OUTPUTS,
	TRANSCRIPTION_MODELS,
	applySpeechDefaults,
	isSpeechInput,
	isSpeechOutput,
	keyLabel,
	speechCloud,
	type SpeechCloud,
} from '../audio/speech-catalog';
import { withCurrentModel } from '../providers/presets';
import { listSpeechVoices, type SpeechVoice } from '../audio/voices';
import { obsidianHttp } from '../providers/obsidian-http';
import { ProviderError } from '../providers/types';
import type { SettingsOwner } from '../settings';

const KEY_DESC =
	'Stored on this device only. It is not written into notes or the synced vault.';

export function renderSpeechSettings(
	containerEl: HTMLElement,
	owner: SettingsOwner,
): void {
	new Setting(containerEl).setName('Speech').setHeading();
	for (const definition of speechRows(owner)) {
		definition.render(
			new Setting(containerEl).setName(definition.name).setDesc(definition.desc),
		);
	}
}

export function speechRows(owner: SettingsOwner): Array<{
	name: string;
	desc: string;
	render: (setting: Setting) => void;
}> {
	let inputKey: TextComponent | undefined;
	let outputKey: TextComponent | undefined;
	let inputKeyRow: HTMLElement | undefined;
	let outputKeyRow: HTMLElement | undefined;
	let modelRow: HTMLElement | undefined;
	let transcriptionMenu: DropdownComponent | undefined;
	let speechModelMenu: DropdownComponent | undefined;
	let speechModelRow: HTMLElement | undefined;
	let voiceRow: HTMLElement | undefined;
	let voiceMenu: HTMLElement | undefined;
	let voiceButton: HTMLElement | undefined;
	const refresh = () => {
		const input = speechCloud(owner.settings.speechInput);
		const output = speechCloud(owner.settings.speechOutput);
		const listed = output === 'grok' || output === 'elevenlabs' || output === 'mistral';
		show(inputKeyRow, input !== null);
		show(modelRow, input !== null && modelChoices(TRANSCRIPTION_MODELS, input).length > 0);
		show(outputKeyRow, output !== null && output !== input);
		show(speechModelRow, output !== null && modelChoices(SPEECH_MODELS, output).length > 0);
		show(
			voiceRow,
			output === 'openai' ||
				output === 'grok' ||
				output === 'gradium' ||
				output === 'elevenlabs' ||
				output === 'mistral',
		);
		show(voiceMenu, listed);
		show(voiceButton, listed);
		if (transcriptionMenu && input) {
			fillModelMenu(transcriptionMenu, modelChoices(TRANSCRIPTION_MODELS, input), owner.settings.transcriptionModel);
		}
		if (speechModelMenu && output) {
			fillModelMenu(speechModelMenu, modelChoices(SPEECH_MODELS, output), owner.settings.speechModel);
		}
		if (input) {
			inputKey?.setPlaceholder(keyLabel(input));
			inputKey?.setValue(owner.settings.speechKeys[input]);
		}
		if (output && output !== input) {
			outputKey?.setPlaceholder(keyLabel(output));
			outputKey?.setValue(owner.settings.speechKeys[output]);
		}
	};
	return [
		{
			name: 'Speech to text',
			desc: SPEECH_INPUT_DESC,
			render: (setting) => {
				setting.addDropdown((dropdown) => {
					for (const route of SPEECH_INPUTS) dropdown.addOption(route.id, route.label);
					dropdown
						.setValue(owner.settings.speechInput)
						.onChange(async (value) => {
							if (!isSpeechInput(value)) return;
							owner.settings.speechInput = value;
							applySpeechDefaults(value, owner.settings, 'input');
							await owner.saveSettings();
							refresh();
						});
				});
			},
		},
		{
			name: 'Speech to text API key',
			desc: KEY_DESC,
			render: (setting) => {
				inputKeyRow = settingRow(setting);
				inputKey = addKey(setting, owner, () => speechCloud(owner.settings.speechInput));
				refresh();
			},
		},
		{
			name: 'Transcription model',
			desc: 'Model for speech to text. A saved name that is not on the list stays available.',
			render: (setting) => {
				modelRow = settingRow(setting);
				transcriptionMenu = addModelMenu(setting, owner, 'transcriptionModel');
				refresh();
			},
		},
		{
			name: 'Text to speech',
			desc: SPEECH_OUTPUT_DESC,
			render: (setting) => {
				setting.addDropdown((dropdown) => {
					for (const route of SPEECH_OUTPUTS) dropdown.addOption(route.id, route.label);
					dropdown
						.setValue(owner.settings.speechOutput)
						.onChange(async (value) => {
							if (!isSpeechOutput(value)) return;
							owner.settings.speechOutput = value;
							applySpeechDefaults(value, owner.settings, 'output');
							await owner.saveSettings();
							refresh();
						});
				});
			},
		},
		{
			name: 'Text to speech API key',
			desc: KEY_DESC,
			render: (setting) => {
				outputKeyRow = settingRow(setting);
				outputKey = addKey(setting, owner, () => {
					const output = speechCloud(owner.settings.speechOutput);
					const input = speechCloud(owner.settings.speechInput);
					return output !== null && output !== input ? output : null;
				});
				refresh();
			},
		},
		{
			name: 'Speech model',
			desc: 'Model for reading aloud. A saved name that is not on the list stays available. eleven_multilingual_v2 does not use the language setting.',
			render: (setting) => {
				speechModelRow = settingRow(setting);
				speechModelMenu = addModelMenu(setting, owner, 'speechModel');
				refresh();
			},
		},
		{
			name: 'Voice',
			desc: 'Select List voices for Grok, Mistral, or ElevenLabs. OpenAI uses a name such as alloy. Gradium uses a voice id.',
			render: (setting) => {
				voiceRow = settingRow(setting);
				const field = addPlain(setting, owner, 'speechVoice', 'alloy');
				const menu = addVoiceMenu(setting, owner, field);
				voiceMenu = menu.selectEl;
				setting.addButton((button) => {
					voiceButton = button.buttonEl;
					button.setButtonText('List voices').onClick(() => {
						void loadVoices(owner, button, menu, field);
					});
				});
				refresh();
			},
		},
		{
			name: 'Language',
			desc: 'Used by Grok, Gradium, Deepgram, ElevenLabs, and the app recognizer. Automatic lets Grok and Gradium detect the language.',
			render: (setting) => {
				setting.addDropdown((dropdown) => {
					for (const language of SPEECH_LANGUAGES) {
						dropdown.addOption(language.id, language.label);
					}
					dropdown
						.setValue(
							isSpeechLanguage(owner.settings.speechLanguage)
								? owner.settings.speechLanguage
								: 'auto',
						)
						.onChange(async (value) => {
							if (!isSpeechLanguage(value)) return;
							owner.settings.speechLanguage = value;
							await owner.saveSettings();
						});
				});
			},
		},
	];
}

function addKey(
	setting: Setting,
	owner: SettingsOwner,
	provider: () => SpeechCloud | null,
): TextComponent {
	let field!: TextComponent;
	setting.addText((text) => {
		field = text;
		text.inputEl.type = 'password';
		text.inputEl.autocomplete = 'off';
		const current = provider();
		text.setPlaceholder(current ? keyLabel(current) : 'Optional').onChange((value) => {
			const chosen = provider();
			if (!chosen) return;
			owner.settings.speechKeys[chosen] = value;
			owner.scheduleSave();
		});
	});
	return field;
}

function addPlain(
	setting: Setting,
	owner: SettingsOwner,
	key: 'transcriptionModel' | 'speechModel' | 'speechVoice',
	placeholder: string,
): TextComponent {
	let field!: TextComponent;
	setting.addText((text) => {
		field = text;
		text
			.setPlaceholder(placeholder)
			.setValue(owner.settings[key])
			.onChange((value) => {
				owner.settings[key] = value;
				owner.scheduleSave();
			});
	});
	return field;
}

function addVoiceMenu(
	setting: Setting,
	owner: SettingsOwner,
	field: TextComponent,
): DropdownComponent {
	let menu!: DropdownComponent;
	setting.addDropdown((dropdown) => {
		menu = dropdown;
		const current = owner.settings.speechVoice.trim();
		dropdown.addOption(current, current || 'Current voice');
		dropdown.setValue(current).onChange(async (value) => {
			if (value === '') return;
			owner.settings.speechVoice = value;
			field.setValue(value);
			await owner.saveSettings();
		});
	});
	return menu;
}

async function loadVoices(
	owner: SettingsOwner,
	button: { setDisabled: (disabled: boolean) => void; setButtonText: (text: string) => void },
	menu: DropdownComponent,
	field: TextComponent,
): Promise<void> {
	const output = speechCloud(owner.settings.speechOutput);
	if (output !== 'grok' && output !== 'elevenlabs' && output !== 'mistral') return;
	button.setDisabled(true);
	button.setButtonText('Listing…');
	try {
		const voices = await listSpeechVoices(
			obsidianHttp,
			output,
			owner.settings.speechKeys[output],
		);
		if (voices.length === 0) {
			new Notice('No voices were returned.');
			return;
		}
		fillVoiceMenu(menu, voices, owner.settings.speechVoice);
		const selected = menu.selectEl.value;
		if (selected !== '' && selected !== owner.settings.speechVoice) {
			owner.settings.speechVoice = selected;
			await owner.saveSettings();
		}
		field.setValue(owner.settings.speechVoice);
	} catch (error) {
		const message = error instanceof ProviderError ? error.message : 'Could not list voices.';
		new Notice(message);
	} finally {
		button.setDisabled(false);
		button.setButtonText('List voices');
	}
}

function fillVoiceMenu(
	menu: DropdownComponent,
	voices: SpeechVoice[],
	current: string,
): void {
	const chosen = current.trim();
	const options =
		chosen !== '' && !voices.some((voice) => voice.id === chosen)
			? [{ id: chosen, name: chosen }, ...voices]
			: voices;
	menu.selectEl.replaceChildren();
	for (const voice of options) menu.addOption(voice.id, voice.name);
	const next = options.some((voice) => voice.id === chosen) ? chosen : options[0]?.id ?? '';
	menu.setValue(next);
}

function addModelMenu(
	setting: Setting,
	owner: SettingsOwner,
	key: 'transcriptionModel' | 'speechModel',
): DropdownComponent {
	let menu!: DropdownComponent;
	setting.addDropdown((dropdown) => {
		menu = dropdown;
		dropdown.onChange(async (value) => {
			owner.settings[key] = value;
			await owner.saveSettings();
		});
	});
	return menu;
}

function fillModelMenu(menu: DropdownComponent, models: readonly string[], current: string): void {
	const options = withCurrentModel(models, current);
	menu.selectEl.replaceChildren();
	for (const model of options) menu.addOption(model, model);
	const next = options.includes(current.trim()) ? current.trim() : (options[0] ?? '');
	if (next !== '') menu.setValue(next);
}

function modelChoices(
	lists: Partial<Record<SpeechCloud, readonly string[]>>,
	route: SpeechCloud | null,
): readonly string[] {
	if (!route) return [];
	return lists[route] ?? [];
}

function show(row: HTMLElement | undefined, visible: boolean): void {
	if (row) row.style.display = visible ? '' : 'none';
}

function settingRow(setting: Setting): HTMLElement {
	return (setting as Setting & { settingEl: HTMLElement }).settingEl;
}
