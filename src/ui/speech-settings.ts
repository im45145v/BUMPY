import { Setting } from 'obsidian';
import type { SettingsOwner, SpeechRoute } from '../settings';

const ROUTES: Array<{ value: SpeechRoute; label: string }> = [
	{ value: 'web-speech', label: 'On this device' },
	{ value: 'openai-audio', label: 'Provider audio API' },
];

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
	return [
		{
			name: 'Speech to text',
			desc: 'On this device uses speech recognition in the app. Provider audio API records audio and sends it to the provider URL.',
			render: (setting) => addRoute(setting, owner, 'speechInput'),
		},
		{
			name: 'Text to speech',
			desc: 'On this device uses speech synthesis in the app. Provider audio API sends the text to the provider and plays the audio it returns.',
			render: (setting) => addRoute(setting, owner, 'speechOutput'),
		},
		{
			name: 'Transcription model',
			desc: 'Used when speech to text is the provider audio API.',
			render: (setting) =>
				addText(setting, owner, 'transcriptionModel', 'whisper-1'),
		},
		{
			name: 'Speech model',
			desc: 'Used when text to speech is the provider audio API.',
			render: (setting) => addText(setting, owner, 'speechModel', 'tts-1'),
		},
		{
			name: 'Voice',
			desc: 'Voice name expected by the provider audio API.',
			render: (setting) => addText(setting, owner, 'speechVoice', 'alloy'),
		},
	];
}

function addRoute(
	setting: Setting,
	owner: SettingsOwner,
	key: 'speechInput' | 'speechOutput',
): void {
	setting.addDropdown((dropdown) => {
		for (const route of ROUTES) dropdown.addOption(route.value, route.label);
		dropdown.setValue(owner.settings[key]).onChange(async (value) => {
			if (value !== 'web-speech' && value !== 'openai-audio') return;
			owner.settings[key] = value;
			await owner.saveSettings();
		});
	});
}

function addText(
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
