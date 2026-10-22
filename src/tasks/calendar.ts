import type { MarkdownTask } from './parse';

export interface CalendarCell {
	iso: string;
	inMonth: boolean;
	tasks: MarkdownTask[];
}

/** Monday-first month grid, always six weeks. */
export function buildMonth(
	year: number,
	month: number,
	tasks: readonly MarkdownTask[],
): CalendarCell[] {
	const first = new Date(year, month - 1, 1);
	const lead = (first.getDay() + 6) % 7;
	const start = new Date(year, month - 1, 1 - lead);
	const byDate = new Map<string, MarkdownTask[]>();
	for (const task of tasks) {
		if (!task.due) continue;
		const list = byDate.get(task.due) ?? [];
		list.push(task);
		byDate.set(task.due, list);
	}
	const cells: CalendarCell[] = [];
	for (let offset = 0; offset < 42; offset++) {
		const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
		const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
		cells.push({
			iso,
			inMonth: date.getMonth() === month - 1,
			tasks: byDate.get(iso) ?? [],
		});
	}
	return cells;
}

export function reminderInstant(
	due: string,
	time: string | null,
	fallbackHour: number,
): number | null {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(due);
	if (!match) return null;
	const clock = /^(\d{2}):(\d{2})$/.exec(time ?? '');
	const hour = clock ? Number(clock[1]) : fallbackHour;
	const minute = clock ? Number(clock[2]) : 0;
	if (hour > 23 || minute > 59) return null;
	return new Date(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
		hour,
		minute,
	).getTime();
}

export function dueReminderKeys(
	items: readonly { key: string; at: number }[],
	now: number,
	fired: ReadonlySet<string>,
): string[] {
	const windowMs = 36 * 60 * 60 * 1000;
	return items
		.filter((item) => item.at <= now && now - item.at <= windowMs && !fired.has(item.key))
		.map((item) => item.key);
}
