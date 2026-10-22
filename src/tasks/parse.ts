export type Priority = 'high' | 'medium' | 'low';

export type DateResolution =
	| { kind: 'date'; iso: string }
	| { kind: 'ambiguous'; prompt: string; options: string[] }
	| { kind: 'none' };

export interface ParsedTask {
	title: string;
	due: DateResolution;
	time: string | null;
	priority: Priority | null;
}

export interface MarkdownTask {
	title: string;
	done: boolean;
	due: string | null;
	time: string | null;
	priority: Priority | null;
	eventId: string | null;
	raw: string;
}

const WEEKDAYS = [
	'sunday',
	'monday',
	'tuesday',
	'wednesday',
	'thursday',
	'friday',
	'saturday',
];

const MONTHS = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december',
];

const AMBIGUOUS = ['soon', 'later', 'eventually', 'someday', 'at some point'];

export function parseNaturalTask(input: string, today: Date): ParsedTask {
	let text = input.trim();
	const priority = takePriority(text);
	text = priority.rest;
	const time = takeTime(text);
	text = time.rest;
	const due = takeDate(text, today);
	text = stripLead(due.rest);
	return {
		title: text.replace(/\s+/g, ' ').trim(),
		due: due.resolution,
		time: time.value,
		priority: priority.value,
	};
}

export function formatTaskLine(task: {
	title: string;
	due?: string | null;
	time?: string | null;
	priority?: Priority | null;
	eventId?: string | null;
	done?: boolean;
}): string {
	const box = task.done ? 'x' : ' ';
	const due = task.due ? ` 📅 ${task.due}` : '';
	const time = task.time ? ` ⏰ ${task.time}` : '';
	const priority =
		task.priority === 'high'
			? ' ⏫'
			: task.priority === 'medium'
				? ' 🔼'
				: task.priority === 'low'
					? ' 🔽'
					: '';
	const marker = task.eventId ? ` %%gcal:${task.eventId}%%` : '';
	return `- [${box}] ${task.title}${due}${time}${priority}${marker}`;
}

export function parseTaskLine(line: string): MarkdownTask | null {
	const match = /^\s*[-*] \[([ xX])\]\s+(.+)$/.exec(line);
	const body = match?.[2];
	if (!match || body === undefined) return null;
	let rest = body;
	const event = /%%gcal:([^%\s]+)%%/.exec(rest);
	const eventId = event?.[1] ?? null;
	if (event) rest = rest.replace(event[0], ' ');
	const due = /📅\s*(\d{4}-\d{2}-\d{2})/.exec(rest);
	const time = /⏰\s*(\d{2}:\d{2})/.exec(rest);
	let priority: Priority | null = null;
	if (rest.includes('⏫')) priority = 'high';
	else if (rest.includes('🔼')) priority = 'medium';
	else if (rest.includes('🔽')) priority = 'low';
	const title = rest
		.replace(/📅\s*\d{4}-\d{2}-\d{2}/, ' ')
		.replace(/⏰\s*\d{2}:\d{2}/, ' ')
		.replace(/[⏫🔼🔽]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
	if (title === '') return null;
	return {
		title,
		done: match[1]?.toLowerCase() === 'x',
		due: due?.[1] ?? null,
		time: time?.[1] ?? null,
		priority,
		eventId,
		raw: line,
	};
}

export function tasksIn(text: string): Array<MarkdownTask & { line: number }> {
	return text.split('\n').flatMap((raw, line) => {
		const task = parseTaskLine(raw);
		return task ? [{ ...task, line }] : [];
	});
}

export function appendTask(text: string, line: string): string {
	if (text === '') return `${line}\n`;
	return `${text.endsWith('\n') ? text : `${text}\n`}${line}\n`;
}

function takePriority(text: string): { value: Priority | null; rest: string } {
	const rules: Array<{ pattern: RegExp; value: Priority }> = [
		{ pattern: /\b(?:high priority|urgent|p1|important)\b:?/i, value: 'high' },
		{ pattern: /\b(?:medium priority|p2)\b:?/i, value: 'medium' },
		{ pattern: /\b(?:low priority|p3)\b:?/i, value: 'low' },
	];
	for (const rule of rules) {
		if (rule.pattern.test(text)) {
			return { value: rule.value, rest: text.replace(rule.pattern, ' ') };
		}
	}
	return { value: null, rest: text };
}

function takeTime(text: string): { value: string | null; rest: string } {
	const match =
		/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(text) ??
		/\b(\d{1,2}):(\d{2})\b/.exec(text);
	if (!match) return { value: null, rest: text };
	const hour = Number(match[1]);
	const minute = Number(match[2] ?? '0');
	const meridiem = (match[3] ?? '').toLowerCase();
	let normalized = hour;
	if (meridiem === 'pm' && hour < 12) normalized += 12;
	if (meridiem === 'am' && hour === 12) normalized = 0;
	if (normalized > 23 || minute > 59 || hour > 23) return { value: null, rest: text };
	const value = `${String(normalized).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
	return { value, rest: text.replace(match[0], ' ') };
}

function takeDate(
	text: string,
	today: Date,
): { resolution: DateResolution; rest: string } {
	const iso = /\b(\d{4}-\d{2}-\d{2})\b/.exec(text);
	if (iso?.[1] && validIso(iso[1])) {
		return { resolution: { kind: 'date', iso: iso[1] }, rest: text.replace(iso[0], ' ') };
	}
	const named = namedDate(text, today);
	if (named) return named;
	const relative = /\b(today|tomorrow|yesterday)\b/i.exec(text);
	if (relative?.[1]) {
		const offset = relative[1].toLowerCase() === 'tomorrow' ? 1 : relative[1].toLowerCase() === 'yesterday' ? -1 : 0;
		return {
			resolution: { kind: 'date', iso: isoDate(addDays(today, offset)) },
			rest: text.replace(relative[0], ' '),
		};
	}
	if (/\bnext week\b/i.test(text)) {
		const monday = startOfNextWeek(today);
		return {
			resolution: {
				kind: 'ambiguous',
				prompt: 'Which day next week?',
				options: [0, 1, 2, 3, 4].map((offset) => isoDate(addDays(monday, offset))),
			},
			rest: text.replace(/\bnext week\b/i, ' '),
		};
	}
	const vague = AMBIGUOUS.find((phrase) => text.toLowerCase().includes(phrase));
	if (vague) {
		const options = unique([
			isoDate(addDays(today, 1)),
			isoDate(addDays(today, 3)),
			isoDate(addDays(today, 7)),
		]);
		return {
			resolution: { kind: 'ambiguous', prompt: 'When should this be due?', options },
			rest: text.replace(new RegExp(vague, 'i'), ' '),
		};
	}
	return { resolution: { kind: 'none' }, rest: text };
}

function namedDate(
	text: string,
	today: Date,
): { resolution: DateResolution; rest: string } | null {
	const month = MONTHS.find((name) => new RegExp(`\\b${name}\\b`, 'i').test(text));
	if (month) {
		const match = new RegExp(
			`\\b${month}\\s+(\\d{1,2})(?:,\\s*(\\d{4}))?\\b`,
			'i',
		).exec(text);
		const day = Number(match?.[1]);
		if (match && day >= 1 && day <= 31) {
			const year = match[2] ? Number(match[2]) : yearFor(today, MONTHS.indexOf(month), day);
			const iso = `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
			if (validIso(iso)) {
				return { resolution: { kind: 'date', iso }, rest: text.replace(match[0], ' ') };
			}
		}
	}
	for (let index = 0; index < WEEKDAYS.length; index++) {
		const name = WEEKDAYS[index] ?? '';
		const match = new RegExp(`\\b(?:(next|this|on|by)\\s+)?${name}\\b`, 'i').exec(text);
		if (!match) continue;
		const qualifier = (match[1] ?? '').toLowerCase();
		const upcoming = qualifier === 'next' ? 'next' : 'this';
		return {
			resolution: { kind: 'date', iso: isoDate(weekdayOn(today, index, upcoming)) },
			rest: text.replace(match[0], ' '),
		};
	}
	return null;
}

function yearFor(today: Date, monthIndex: number, day: number): number {
	const thisYear = new Date(today.getFullYear(), monthIndex, day);
	const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	return thisYear < startToday ? today.getFullYear() + 1 : today.getFullYear();
}

function weekdayOn(today: Date, weekday: number, upcoming: 'next' | 'this'): Date {
	const delta = (weekday - today.getDay() + 7) % 7;
	const days = upcoming === 'next' ? delta + 7 : delta;
	return addDays(today, days === 7 && upcoming === 'this' ? 0 : days);
}

function startOfNextWeek(today: Date): Date {
	const days = (8 - today.getDay()) % 7 || 7;
	return addDays(today, days);
}

function stripLead(text: string): string {
	return text.replace(
		/^\s*(?:please\s+)?(?:remind me to|remember to|i need to|i should|don't forget to|do not forget to)\s+/i,
		'',
	);
}

function addDays(today: Date, days: number): Date {
	return new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
}

function isoDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function validIso(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;
	const year = Number(match[1]);
	const month = Number(match[2]);
	const day = Number(match[3]);
	const date = new Date(year, month - 1, day);
	return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}
