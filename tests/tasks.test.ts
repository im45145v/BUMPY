import { describe, expect, it } from 'vitest';
import { buildMonth, dueReminderKeys, dueTasks, reminderInstant } from '../src/tasks/calendar';
import { createGoogleEvent, googleEventBody, listGoogleEvents } from '../src/tasks/google';
import { readFiredReminders, reminderKey } from '../src/tasks/reminders';
import {
	appendTask,
	formatTaskLine,
	parseNaturalTask,
	parseTaskLine,
} from '../src/tasks/parse';
import { chooseConflict, planSync } from '../src/tasks/sync';
import type { HttpRequest } from '../src/providers/types';

const today = new Date(2026, 9, 22);

describe('natural tasks', () => {
	it('reads a date, a time, and a priority', () => {
		expect(parseNaturalTask('Pay rent tomorrow', today)).toMatchObject({
			title: 'Pay rent',
			due: { kind: 'date', iso: '2026-10-23' },
			priority: null,
		});
		expect(parseNaturalTask('Remind me to stretch at 3pm tomorrow', today)).toMatchObject({
			title: 'stretch',
			time: '15:00',
			due: { kind: 'date', iso: '2026-10-23' },
		});
		expect(parseNaturalTask('high priority: email Ada by Friday', today)).toMatchObject({
			title: 'email Ada',
			priority: 'high',
			due: { kind: 'date', iso: '2026-10-23' },
		});
	});

	it('asks when the deadline is ambiguous', () => {
		const nextWeek = parseNaturalTask('Call Sam next week', today);
		expect(nextWeek.due.kind).toBe('ambiguous');
		if (nextWeek.due.kind !== 'ambiguous') return;
		expect(nextWeek.due.prompt).toMatch(/next week/);
		expect(nextWeek.due.options).toEqual([
			'2026-10-26',
			'2026-10-27',
			'2026-10-28',
			'2026-10-29',
			'2026-10-30',
		]);
		expect(parseNaturalTask('File this soon', today).due.kind).toBe('ambiguous');
	});

	it('round-trips a markdown task', () => {
		const line = formatTaskLine({
			title: 'Pay rent',
			due: '2026-10-23',
			time: '09:00',
			priority: 'high',
			eventId: 'evt-1',
		});
		expect(parseTaskLine(line)).toMatchObject({
			title: 'Pay rent',
			due: '2026-10-23',
			time: '09:00',
			priority: 'high',
			eventId: 'evt-1',
			done: false,
		});
		expect(appendTask('Notes\n', line).endsWith(`${line}\n`)).toBe(true);
	});
});

describe('calendar and reminders', () => {
	it('builds a Monday-first month and reminds once', () => {
		const cells = buildMonth(2026, 10, [
			{
				title: 'Pay rent',
				done: false,
				due: '2026-10-23',
				time: null,
				priority: null,
				eventId: null,
				raw: '',
			},
		]);
		expect(cells).toHaveLength(42);
		expect(cells[0]?.iso).toBe('2026-09-28');
		expect(cells.find((cell) => cell.iso === '2026-10-23')?.tasks).toHaveLength(1);
		const at = reminderInstant('2026-10-23', null, 9) ?? 0;
		const key = 'rent';
		expect(dueReminderKeys([{ key, at }], at + 1000, new Set())).toEqual([key]);
		expect(dueReminderKeys([{ key, at }], at + 1000, new Set([key]))).toEqual([]);
		expect(reminderKey('Tasks.md', { due: '2026-10-23', time: '15:00', title: 'Stretch' })).toBe(
			'Tasks.md:2026-10-23:15:00:Stretch',
		);
		expect(
			dueTasks(
				[
					{
						title: 'Later',
						done: false,
						due: '2026-10-24',
						time: null,
					},
					{
						title: 'Stretch',
						done: false,
						due: '2026-10-22',
						time: '15:00',
					},
					{
						title: 'Done',
						done: true,
						due: '2026-10-22',
						time: null,
					},
				],
				'2026-10-22',
			).map((task) => task.title),
		).toEqual(['Stretch']);
		expect(readFiredReminders({ firedReminders: ['Tasks.md:2026-10-23::Pay rent', 4] })).toEqual([
			'Tasks.md:2026-10-23::Pay rent',
		]);
	});
});

describe('calendar sync', () => {
	it('creates, updates, and asks on conflicts', () => {
		const task = { key: 'rent', title: 'Pay rent', date: '2026-10-23', eventId: 'evt-1' };
		const event = { id: 'evt-1', title: 'Pay rent', date: '2026-10-23' };
		const link = { taskKey: 'rent', eventId: 'evt-1', title: 'Pay rent', date: '2026-10-23' };
		expect(planSync([{ ...task, eventId: null }], [], [], 'ask')[0]?.type).toBe(
			'create-event',
		);
		expect(planSync([task], [event], [link], 'ask')[0]?.type).toBe('unchanged');
		expect(
			planSync([task], [{ ...event, title: 'Rent' }], [link], 'ask')[0]?.type,
		).toBe('update-task');
		expect(
			planSync([{ ...task, title: 'Pay the rent' }], [event], [link], 'vault-wins')[0]
				?.type,
		).toBe('update-event');
		const conflict = planSync(
			[{ ...task, title: 'Pay the rent' }],
			[{ ...event, date: '2026-10-24' }],
			[link],
			'ask',
		)[0];
		expect(conflict?.type).toBe('conflict');
		if (conflict?.type === 'conflict') {
			expect(chooseConflict(conflict, 'note')).toMatchObject({
				type: 'update-event',
				title: 'Pay the rent',
				date: '2026-10-23',
			});
			expect(chooseConflict(conflict, 'calendar')).toMatchObject({
				type: 'update-task',
				date: '2026-10-24',
			});
		}
		expect(
			planSync([{ ...task, eventId: 'evt-1' }], [event], [], 'ask')[0]?.type,
		).toBe('remember');
		expect(
			planSync([task], [], [link], 'ask')[0]?.type,
		).toBe('absent-event');
		expect(
			planSync([{ ...task, eventId: null }], [], [link], 'ask')[0]?.type,
		).toBe('absent-event');
	});

	it('calls Google Calendar without putting the token in the URL or the error', async () => {
		let captured: HttpRequest | undefined;
		const created = await createGoogleEvent(
			async (request) => {
				captured = request;
				return {
					status: 200,
					body: JSON.stringify({
						id: 'evt-1',
						summary: 'Pay rent',
						start: { date: '2026-10-23' },
					}),
				};
			},
			'primary',
			'sk-calendar-secret',
			{ title: 'Pay rent', date: '2026-10-23' },
		);
		expect(created).toEqual({
			id: 'evt-1',
			title: 'Pay rent',
			date: '2026-10-23',
			time: null,
		});
		expect(captured?.url).toContain('/calendars/primary/events');
		expect(captured?.url).not.toContain('sk-calendar-secret');
		expect(typeof captured?.body).toBe('string');
		expect(captured?.body).toContain('"end":{"date":"2026-10-24"}');
		expect(captured?.headers.Authorization).toBe('Bearer sk-calendar-secret');

		const denied = await listGoogleEvents(
			async () => ({
				status: 401,
				body: JSON.stringify({
					error: { message: 'bad token sk-calendar-secret' },
				}),
			}),
			'primary',
			'sk-calendar-secret',
			'2026-10-01T00:00:00Z',
			'2026-11-01T00:00:00Z',
		).catch((error: unknown) => error);
		expect((denied as Error).message).toBe(
			'Google Calendar declined the access token.',
		);
		expect((denied as Error).message).not.toContain('sk-calendar-secret');
	});

	it('reads every calendar page before deciding an event is missing', async () => {
		const urls: string[] = [];
		const events = await listGoogleEvents(
			async (request) => {
				urls.push(request.url);
				if (!request.url.includes('pageToken')) {
					return {
						status: 200,
						body: JSON.stringify({
							items: [
								{
									id: 'evt-1',
									summary: 'Pay rent',
									start: { date: '2026-10-23' },
								},
							],
							nextPageToken: 'page-2',
						}),
					};
				}
				return {
					status: 200,
					body: JSON.stringify({
						items: [
							{
								id: 'evt-2',
								summary: 'Call Sam',
								start: { date: '2026-10-24' },
							},
						],
					}),
				};
			},
			'primary',
			'token',
			'2026-10-01T00:00:00Z',
			'2026-11-01T00:00:00Z',
		);
		expect(events.map((event) => event.id)).toEqual(['evt-1', 'evt-2']);
		expect(urls).toHaveLength(2);
		expect(urls[1]).toContain('pageToken=page-2');
		expect(urls[0]).not.toContain('token');
	});

	it('sends a timed task as a 30-minute event and reads the clock back', () => {
		expect(
			googleEventBody({
				title: 'Stretch',
				date: '2026-10-23',
				time: '23:45',
				timeZone: 'UTC',
			}),
		).toEqual({
			summary: 'Stretch',
			start: { dateTime: '2026-10-23T23:45:00', timeZone: 'UTC' },
			end: { dateTime: '2026-10-24T00:15:00', timeZone: 'UTC' },
		});
	});

	it('treats a changed time as a task change', () => {
		const task = {
			key: 'stretch',
			title: 'Stretch',
			date: '2026-10-23',
			time: '16:00',
			eventId: 'evt-1',
		};
		const event = { id: 'evt-1', title: 'Stretch', date: '2026-10-23', time: '15:00' };
		const link = {
			taskKey: 'stretch',
			eventId: 'evt-1',
			title: 'Stretch',
			date: '2026-10-23',
			time: '15:00',
		};
		expect(planSync([task], [event], [link], 'ask')[0]).toMatchObject({
			type: 'update-event',
			time: '16:00',
		});
		expect(
			planSync(
				[{ ...task, time: '15:00' }],
				[{ ...event, time: null }],
				[
					{
						taskKey: 'stretch',
						eventId: 'evt-1',
						title: 'Stretch',
						date: '2026-10-23',
					},
				],
				'ask',
			)[0]?.type,
		).toBe('update-event');
	});
});
