import { DropdownComponent, Notice, Setting, TextComponent } from 'obsidian';
import {
	SPEECH_INPUT_DESC,
	SPEECH_OUTPUT_DESC,
} from '../commands/speech-specs';
import { SPEECH_LANGUAGES, isSpeechLanguage } from '../audio/languages';
import {
	SPEECH_INPUTS,
	SPEECH_OUTPUTS,
	applySpeechDefaults,
	isSpeechInput,
	isSpeechOutput,
	keyLabel,
	speechCloud,
	type SpeechCloud,
} from '../audio/speech-catalog';
import { listSpeechVoices, type SpeechVoice } from '../audio/voices';
import { obsidianHttp } from '../providers/obsidian-http';
import { ProviderError } from '../providers/types';
import type { SettingsOwner } from '../settings';

const KEY_DESC =
	"Stored in this vault's plugin data on this device. It is not written into notes.";

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
	let speechModelRow: HTMLElement | undefined;
	let voiceRow: HTMLElement | undefined;
	let voiceMenu: HTMLElement | undefined;
	let voiceButton: HTMLElement | undefined;
	const refresh = () => {
		const input = speechCloud(owner.settings.speechInput);
		const output = speechCloud(owner.settings.speechOutput);
		const listed = output === 'grok' || output === 'elevenlabs';
		show(inputKeyRow, input !== null);
		show(modelRow, input !== null);
		show(outputKeyRow, output !== null && output !== input);
		show(speechModelRow, output === 'openai' || output === 'elevenlabs');
		show(voiceRow, output === 'openai' || output === 'grok' || output === 'gradium' || output === 'elevenlabs');
		show(voiceMenu, listed);
		show(voiceButton, listed);
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
			desc: 'Model name for speech to text.',
			render: (setting) => {
				modelRow = settingRow(setting);
				addPlain(setting, owner, 'transcriptionModel', 'whisper-1');
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
			desc: 'OpenAI uses tts-1. ElevenLabs uses eleven_v3 for natural reading. eleven_multilingual_v2 does not use the language setting.',
			render: (setting) => {
				speechModelRow = settingRow(setting);
				addPlain(setting, owner, 'speechModel', 'tts-1');
				refresh();
			},
		},
		{
			name: 'Voice',
			desc: 'Select List voices for Grok or ElevenLabs. OpenAI uses a name such as alloy. Gradium uses a voice id.',
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
		text.setPlaceholder(current ? keyLabel(current) : 'Optional').onChange(async (value) => {
			const chosen = provider();
			if (!chosen) return;
			owner.settings.speechKeys[chosen] = value;
			await owner.saveSettings();
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
			.onChange(async (value) => {
				owner.settings[key] = value;
				await owner.saveSettings();
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
	if (output !== 'grok' && output !== 'elevenlabs') return;
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

function show(row: HTMLElement | undefined, visible: boolean): void {
	if (row) row.style.display = visible ? '' : 'none';
}

function settingRow(setting: Setting): HTMLElement {
	return (setting as Setting & { settingEl: HTMLElement }).settingEl;
}
