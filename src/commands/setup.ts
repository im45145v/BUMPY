import type { Plugin } from 'obsidian';
import type { SettingsOwner } from '../settings';
import { SetupView, SETUP_VIEW, openSetup } from '../ui/setup-view';

export function registerSetup(
	plugin: SettingsOwner & Pick<Plugin, 'addCommand' | 'registerView' | 'app'>,
): void {
	plugin.registerView(SETUP_VIEW, (leaf) => new SetupView(leaf, plugin));
	plugin.addCommand({
		id: 'open-setup',
		name: 'Open setup',
		callback: () => {
			void openSetup(plugin.app);
		},
	});
}
