import { Setting } from 'obsidian';
import type { BumpySettings, SettingsOwner } from '../settings';
import { obsidianDesktopReminder } from '../tasks/desktop-reminder';

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
			name: 'Computer notifications',
			desc: 'Also sends the reminder to Notification Center while Obsidian is open. It appears as an Obsidian notification. Allow notifications for Obsidian if the system asks. Nothing is sent while Obsidian is closed.',
			render: (setting) => addSystemReminders(setting, owner),
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
			desc: 'Optional. Expires quickly. Stored on this device only. Paste a token for one sync, or add a refresh token below and sync renews it.',
			render: (setting) => addSecret(setting, owner, 'googleAccessToken', 'Optional'),
		},
		{
			name: 'Google client ID',
			desc: 'Optional. Used with the client secret and refresh token to renew the access token when you sync.',
			render: (setting) => addText(setting, owner, 'googleClientId', 'Optional'),
		},
		{
			name: 'Google client secret',
			desc: 'Optional. Stored on this device only. It is not written into notes or the synced vault.',
			render: (setting) => addSecret(setting, owner, 'googleClientSecret', 'Optional'),
		},
		{
			name: 'Google refresh token',
			desc: 'Optional. When this, the client ID, and the client secret are set, sync asks Google for a new access token.',
			render: (setting) => addSecret(setting, owner, 'googleRefreshToken', 'Optional'),
		},
	];
}

function addHour(setting: Setting, owner: SettingsOwner): void {
	setting.addText((text) => {
		text
			.setPlaceholder('9')
			.setValue(String(owner.settings.reminderHour))
			.onChange((value) => {
				const hour = Number(value);
				if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
				owner.settings.reminderHour = hour;
				owner.scheduleSave();
			});
	});
}

function addSystemReminders(setting: Setting, owner: SettingsOwner): void {
	setting.addToggle((toggle) => {
		toggle.setValue(owner.settings.systemReminders).onChange(async (value) => {
			owner.settings.systemReminders = value;
			await owner.saveSettings();
			if (!value) return;
			const channel = obsidianDesktopReminder();
			if (channel.supported && channel.permission() === 'default') {
				await channel.requestPermission();
			}
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
	key: 'googleCalendarId' | 'googleClientId',
	placeholder: string,
): void {
	setting.addText((text) => {
		text
			.setPlaceholder(placeholder)
			.setValue(owner.settings[key])
			.onChange((value) => {
				owner.settings[key] = value;
				owner.scheduleSave();
			});
	});
}

function addSecret(
	setting: Setting,
	owner: SettingsOwner,
	key: 'googleAccessToken' | 'googleClientSecret' | 'googleRefreshToken',
	placeholder: string,
): void {
	setting.addText((text) => {
		text.inputEl.type = 'password';
		text.inputEl.autocomplete = 'off';
		text
			.setPlaceholder(placeholder)
			.setValue(owner.settings[key])
			.onChange((value) => {
				owner.settings[key] = value;
				owner.scheduleSave();
			});
	});
}
