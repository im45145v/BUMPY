export function reminderKey(
	path: string,
	task: { due: string; time: string | null; title: string },
): string {
	return `${path}:${task.due}:${task.time ?? ''}:${task.title}`;
}

export function reminderNotice(title: string, time: string | null): string {
	return time ? `Reminder: ${title} at ${time}` : `Reminder: ${title}`;
}

export function readFiredReminders(data: unknown): string[] {
	if (!data || typeof data !== 'object') return [];
	const value = (data as { firedReminders?: unknown }).firedReminders;
	if (!Array.isArray(value)) return [];
	return value
		.filter((item): item is string => typeof item === 'string' && item.length > 0 && item.length < 500)
		.slice(0, 500);
}
