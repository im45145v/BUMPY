import { Platform } from 'obsidian';
import type { DesktopReminderChannel } from './reminders';

export function obsidianDesktopReminder(): DesktopReminderChannel {
	const notifications = window.Notification;
	if (!Platform.isDesktopApp || typeof notifications !== 'function') {
		return {
			supported: false,
			permission: () => 'denied',
			requestPermission: () => Promise.resolve('denied'),
			show: () => {},
		};
	}
	return {
		supported: true,
		permission: () => normalizePermission(notifications.permission),
		requestPermission: async () => normalizePermission(await notifications.requestPermission()),
		show: (title, body) => {
			new notifications(title, { body });
		},
	};
}

function normalizePermission(value: NotificationPermission): 'granted' | 'denied' | 'default' {
	if (value === 'granted' || value === 'denied') return value;
	return 'default';
}
