/** The note path stored at the front of a reminder key. */
export function reminderNotePath(key: string): string | null {
	const match = /^(.*):\d{4}-\d{2}-\d{2}:/.exec(key);
	return match?.[1] ?? null;
}

/**
 * Drops reminders whose tasks are gone.
 * A note that could not be read keeps its reminder so a failed scan does not notify again.
 */
export function pruneFiredReminders(
	fired: ReadonlySet<string>,
	live: ReadonlySet<string>,
	unread: ReadonlySet<string>,
): string[] {
	const removed: string[] = [];
	for (const key of fired) {
		if (live.has(key)) continue;
		const path = reminderNotePath(key);
		if (path && unread.has(path)) continue;
		removed.push(key);
	}
	return removed;
}

export function reminderKey(
	path: string,
	task: { due: string; time: string | null; title: string },
): string {
	return `${path}:${task.due}:${task.time ?? ''}:${task.title}`;
}

export function reminderNotice(title: string, time: string | null): string {
	return time ? `Reminder: ${title} at ${time}` : `Reminder: ${title}`;
}

export interface DesktopReminderChannel {
	supported: boolean;
	permission(): 'granted' | 'denied' | 'default';
	requestPermission(): Promise<'granted' | 'denied' | 'default'>;
	show(title: string, body: string): void;
}

/** Sends the same reminder text to the operating system when it is allowed. */
export async function publishDesktopReminder(
	enabled: boolean,
	message: string,
	channel: DesktopReminderChannel,
): Promise<boolean> {
	if (!enabled || !channel.supported || message.trim() === '') return false;
	try {
		let permission = channel.permission();
		if (permission === 'default') permission = await channel.requestPermission();
		if (permission !== 'granted') return false;
		channel.show('Bumpy', message);
		return true;
	} catch {
		return false;
	}
}

export function readFiredReminders(data: unknown): string[] {
	if (!data || typeof data !== 'object') return [];
	const value = (data as { firedReminders?: unknown }).firedReminders;
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length < 500)
		.slice(0, 500);
}
