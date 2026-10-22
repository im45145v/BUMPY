import { Setting } from 'obsidian';
import type { BumpySettings, SettingsOwner } from '../settings';

const CONFLICTS: Array<{ value: BumpySettings['calendarConflict']; label: string }> = [
	{ value: 'ask', label: 'Ask me' },
	{ value: 'vault-wins', label: 'Note wins' },
	{ value: 'calendar-wins', label: 'Calendar wins' },
];

export function renderTaskSettings(
	containerEl: HTMLElement,
	owner: SettingsOwner,
): void {
	new Setting(containerEl).setName('Tasks').setHeading();
	for (const row of taskRows(owner)) {
		row.render(new Setting(containerEl).setName(row.name).setDesc(row.desc));
	}
}

export function taskRows(owner: SettingsOwner): Array<{
	name: string;
	desc: string;
	render: (setting: Setting) => void;
}> {
	return [
		{
			name: 'Reminder hour',
			desc: 'Hour, from 0 to 23, used when a task has a date and no time.',
			render: (setting) => addHour(setting, owner),
		},
		{
			name: 'Calendar conflict',
			desc: 'What to do when a task and its calendar event both changed.',
			render: (setting) => addConflict(setting, owner),
		},
		{
			name: 'Google calendar ID',
			desc: 'Optional. Used only when you run Sync calendar. Often primary.',
			render: (setting) => addText(setting, owner, 'googleCalendarId', 'primary'),
		},
		{
			name: 'Google access token',
			desc: 'Optional access token stored in plugin data on this device. It is not written into notes.',
			render: (setting) => addSecret(setting, owner),
		},
	];
}

function addHour(setting: Setting, owner: SettingsOwner): void {
	setting.addText((text) => {
		text
			.setPlaceholder('9')
			.setValue(String(owner.settings.reminderHour))
			.onChange(async (value) => {
				const hour = Number(value);
				if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
				owner.settings.reminderHour = hour;
				await owner.saveSettings();
			});
	});
}

function addConflict(setting: Setting, owner: SettingsOwner): void {
	setting.addDropdown((dropdown) => {
		for (const choice of CONFLICTS) dropdown.addOption(choice.value, choice.label);
		dropdown.setValue(owner.settings.calendarConflict).onChange(async (value) => {
			if (value !== 'ask' && value !== 'vault-wins' && value !== 'calendar-wins') return;
			owner.settings.calendarConflict = value;
			await owner.saveSettings();
		});
	});
}

function addText(
	setting: Setting,
	owner: SettingsOwner,
	key: 'googleCalendarId',
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
			.setValue(owner.settings.googleAccessToken)
			.onChange(async (value) => {
				owner.settings.googleAccessToken = value;
				await owner.saveSettings();
			});
	});
}
