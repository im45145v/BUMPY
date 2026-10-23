import { Setting } from 'obsidian';
import type { SettingsOwner } from '../settings';

export function renderCallSettings(containerEl: HTMLElement, owner: SettingsOwner): void {
	new Setting(containerEl).setName('Call').setHeading();
	for (const row of callRows(owner)) {
		row.render(new Setting(containerEl).setName(row.name).setDesc(row.desc));
	}
}

export function callRows(owner: SettingsOwner): Array<{
	name: string;
	desc: string;
	render: (setting: Setting) => void;
}> {
	return [
		{
			name: 'Call bridge',
			desc: 'When this is on, Obsidian checks the board for vault jobs. The board does not connect to this computer. Leave this off and the vault stays untouched.',
			render: (setting) => {
				setting.addToggle((toggle) => {
					toggle.setValue(owner.settings.callBridge).onChange(async (value) => {
						owner.settings.callBridge = value;
						await owner.saveSettings();
					});
				});
			},
		},
		{
			name: 'Board URL',
			desc: 'A local address for the board, for example http://192.168.1.20:8444. Use https only after this computer trusts the board certificate.',
			render: (setting) => {
				setting.addText((text) => {
					text
						.setPlaceholder('Local address')
						.setValue(owner.settings.callBridgeUrl)
						.onChange(async (value) => {
							owner.settings.callBridgeUrl = value;
							await owner.saveSettings();
						});
				});
			},
		},
		{
			name: 'Call token',
			desc: 'Shared with the board. Stored in plugin data on this device. It is not written into notes.',
			render: (setting) => {
				setting.addText((text) => {
					text.inputEl.type = 'password';
					text.inputEl.autocomplete = 'off';
					text
						.setPlaceholder('Token')
						.setValue(owner.settings.callBridgeToken)
						.onChange(async (value) => {
							owner.settings.callBridgeToken = value;
							await owner.saveSettings();
						});
				});
			},
		},
	];
}
