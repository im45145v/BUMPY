import { Setting, TextComponent } from 'obsidian';
import {
	SPEECH_INPUT_DESC,
	SPEECH_OUTPUT_DESC,
} from '../commands/speech-specs';
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
	const refresh = () => {
		const input = speechCloud(owner.settings.speechInput);
		const output = speechCloud(owner.settings.speechOutput);
		show(inputKeyRow, input !== null);
		show(modelRow, input !== null);
		show(outputKeyRow, output !== null && output !== input);
		show(speechModelRow, output === 'openai');
		show(voiceRow, output === 'openai' || output === 'grok' || output === 'gradium');
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
			desc: 'Used by OpenAI text to speech.',
			render: (setting) => {
				speechModelRow = settingRow(setting);
				addPlain(setting, owner, 'speechModel', 'tts-1');
				refresh();
			},
		},
		{
			name: 'Voice',
			desc: 'OpenAI uses a voice name such as alloy. Grok uses eve. Gradium uses a voice id.',
			render: (setting) => {
				voiceRow = settingRow(setting);
				addPlain(setting, owner, 'speechVoice', 'alloy');
				refresh();
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

function show(row: HTMLElement | undefined, visible: boolean): void {
	if (row) row.style.display = visible ? '' : 'none';
}

function settingRow(setting: Setting): HTMLElement {
	return (setting as Setting & { settingEl: HTMLElement }).settingEl;
}
