import { ButtonComponent, Modal, Notice, TFile, type Plugin } from 'obsidian';
import type { CleanupHost } from './cleanup';
import { TASK_COMMANDS } from './task-specs';
import { parseFolders } from '../linking/suggest';
import type { CleanupEditor } from '../notes/editor-apply';
import { selectionRange } from '../notes/editor-apply';
import { obsidianHttp } from '../providers/obsidian-http';
import { createGoogleEvent, listGoogleEvents, updateGoogleEvent } from '../tasks/google';
import { dueReminderKeys, reminderInstant } from '../tasks/calendar';
import {
	formatTaskLine,
	parseTaskLine,
	tasksIn,
} from '../tasks/parse';
import {
	chooseConflict,
	planSync,
	type SyncAction,
	type SyncLink,
	type TrackedTask,
} from '../tasks/sync';
import { ProviderError } from '../providers/types';
import { CalendarView, CALENDAR_VIEW } from '../ui/calendar-view';
import { TaskCaptureModal } from '../ui/task-modal';
import { readMarkdownNotes } from '../vault/notes';

export interface TaskHost extends CleanupHost {
	firedReminders: Set<string>;
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

export function registerTaskFeatures(
	plugin: TaskHost &
		Pick<Plugin, 'addCommand' | 'registerView' | 'registerInterval'>,
): void {
	plugin.registerView(CALENDAR_VIEW, (leaf) => new CalendarView(leaf, plugin));
	plugin.addCommand({
		id: TASK_COMMANDS[0].id,
		name: TASK_COMMANDS[0].name,
		editorCallback: (editor: CleanupEditor) => {
			const range = selectionRange(editor);
			const phrase = range ? editor.getRange(range.from, range.to) : '';
			new TaskCaptureModal(plugin.app, editor, phrase, new Date()).open();
		},
	});
	plugin.addCommand({
		id: TASK_COMMANDS[1].id,
		name: TASK_COMMANDS[1].name,
		callback: () => {
			void plugin.app.workspace.getLeaf(true).setViewState({
				type: CALENDAR_VIEW,
				active: true,
			});
		},
	});
	plugin.addCommand({
		id: TASK_COMMANDS[2].id,
		name: TASK_COMMANDS[2].name,
		callback: () => {
			void syncCalendar(plugin);
		},
	});
	plugin.registerInterval(
		window.setInterval(() => {
			void remind(plugin);
		}, 60_000),
	);
}

async function remind(plugin: TaskHost): Promise<void> {
	const notes = await readMarkdownNotes(
		plugin.app,
		parseFolders(plugin.settings.excludedFolders),
	);
	const items = notes.flatMap((note) =>
		tasksIn(note.text).flatMap((task) => {
			if (task.done || !task.due) return [];
			const at = reminderInstant(task.due, task.time, plugin.settings.reminderHour);
			if (at === null) return [];
			return [{ key: `${note.path}:${task.line}:${task.title}`, title: task.title, at }];
		}),
	);
	for (const key of dueReminderKeys(items, Date.now(), plugin.firedReminders)) {
		plugin.firedReminders.add(key);
		const title = items.find((item) => item.key === key)?.title ?? 'Task';
		new Notice(`Reminder: ${title}`);
	}
}

async function syncCalendar(plugin: TaskHost): Promise<void> {
	const token = plugin.settings.googleAccessToken.trim();
	const calendarId = plugin.settings.googleCalendarId.trim();
	if (token === '' || calendarId === '') {
		new Notice('Add a Google calendar access token and calendar ID in settings.');
		return;
	}
	const controller = plugin.requests.start();
	const notice = new Notice('Checking calendar…', 0);
	try {
		const notes = await readMarkdownNotes(
			plugin.app,
			parseFolders(plugin.settings.excludedFolders),
		);
		const located = notes.flatMap((note) =>
			tasksIn(note.text).flatMap((task) => {
				if (!task.due) return [];
				const tracked: TrackedTask = {
					key: `${note.path}:${task.line}:${task.title}`,
					title: task.title,
					date: task.due,
					eventId: task.eventId,
				};
				return [{ notePath: note.path, raw: task.raw, tracked }];
			}),
		);
		const start = new Date();
		start.setMonth(start.getMonth() - 1);
		const end = new Date();
		end.setMonth(end.getMonth() + 3);
		const events = await listGoogleEvents(
			obsidianHttp,
			calendarId,
			token,
			start.toISOString(),
			end.toISOString(),
			controller.signal,
		);
		const links = await loadLinks(plugin);
		const actions = planSync(
			located.map((item) => item.tracked),
			events,
			links,
			plugin.settings.calendarConflict,
		);
		if (controller.signal.aborted) return;
		new SyncModal(plugin, actions, located, token, calendarId, links).open();
	} catch (error) {
		if (!controller.signal.aborted) {
			const message =
				error instanceof ProviderError ? error.message : 'Calendar sync failed.';
			new Notice(message);
		}
	} finally {
		notice.hide();
		plugin.requests.finish(controller);
	}
}

class SyncModal extends Modal {
	private readonly choices = new Map<string, 'note' | 'calendar'>();

	constructor(
		private readonly plugin: TaskHost,
		private readonly actions: SyncAction[],
		private readonly located: Array<{
			notePath: string;
			raw: string;
			tracked: TrackedTask;
		}>,
		private readonly token: string,
		private readonly calendarId: string,
		private readonly links: SyncLink[],
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Review calendar sync');
		contentEl.createEl('p', {
			text: 'Nothing is written until you apply this plan.',
			cls: 'bumpy-preview-note',
		});
		if (this.actions.every((action) => action.type === 'unchanged')) {
			contentEl.createEl('p', { text: 'Calendar is already in sync.' });
		}
		for (const action of this.actions) {
			if (action.type === 'unchanged' || action.type === 'remember') continue;
			if (action.type !== 'conflict') {
				contentEl.createEl('p', { text: describe(action) });
				continue;
			}
			const row = contentEl.createDiv();
			row.createEl('p', { text: describe(action) });
			const status = row.createEl('p', {
				text: 'No choice yet. This conflict is skipped until you choose.',
				cls: 'bumpy-preview-note',
			});
			const choice = row.createDiv({ cls: 'bumpy-preview-actions' });
			new ButtonComponent(choice).setButtonText('Keep the note').onClick(() => {
				this.choices.set(action.taskKey, 'note');
				status.setText('The note will be kept.');
			});
			new ButtonComponent(choice).setButtonText('Use the calendar').onClick(() => {
				this.choices.set(action.taskKey, 'calendar');
				status.setText('The calendar will be used.');
			});
		}
		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText('Discard').onClick(() => this.close());
		new ButtonComponent(actions)
			.setButtonText('Apply')
			.setCta()
			.onClick(() => {
				void this.apply();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async apply(): Promise<void> {
		const nextLinks = [...this.links];
		for (const action of this.resolved()) {
			if (action.type === 'unchanged') continue;
			if (action.type === 'conflict') {
				new Notice('A calendar conflict was skipped because it has no choice.');
				continue;
			}
			if (action.type === 'remember') {
				upsertLink(nextLinks, action);
				continue;
			}
			if (action.type === 'create-event') {
				const created = await createGoogleEvent(
					obsidianHttp,
					this.calendarId,
					this.token,
					{ title: action.title, date: action.date },
				);
				const source = this.located.find((item) => item.tracked.key === action.taskKey);
				if (source) {
					const task = parseTaskLine(source.raw);
					if (task) {
						await replaceLine(
							this.plugin,
							source.notePath,
							source.raw,
							formatTaskLine({ ...task, eventId: created.id }),
						);
					}
				}
				upsertLink(nextLinks, {
					taskKey: action.taskKey,
					eventId: created.id,
					title: action.title,
					date: action.date,
				});
				continue;
			}
			if (action.type === 'update-event') {
				await updateGoogleEvent(obsidianHttp, this.calendarId, this.token, {
					id: action.eventId,
					title: action.title,
					date: action.date,
				});
				upsertLink(nextLinks, {
					taskKey: action.taskKey,
					eventId: action.eventId,
					title: action.title,
					date: action.date,
				});
				continue;
			}
			const source = this.located.find((item) => item.tracked.key === action.taskKey);
			const task = source ? parseTaskLine(source.raw) : null;
			if (source && task) {
				await replaceLine(
					this.plugin,
					source.notePath,
					source.raw,
					formatTaskLine({
						...task,
						title: action.title,
						due: action.date,
						eventId: action.eventId,
					}),
				);
			}
			upsertLink(nextLinks, {
				taskKey: action.taskKey,
				eventId: action.eventId,
				title: action.title,
				date: action.date,
			});
		}
		await saveLinks(this.plugin, nextLinks);
		this.close();
	}

	private resolved(): SyncAction[] {
		return this.actions.map((action) => {
			if (action.type !== 'conflict') return action;
			const choice = this.choices.get(action.taskKey);
			return choice ? chooseConflict(action, choice) : action;
		});
	}
}

function describe(action: SyncAction): string {
	switch (action.type) {
		case 'create-event':
			return `Create a calendar event for ${action.title} on ${action.date}.`;
		case 'update-event':
			return `Update the calendar event to ${action.title} on ${action.date}.`;
		case 'update-task':
			return `Update the note task to ${action.title} on ${action.date}.`;
		case 'conflict':
			return `${action.taskTitle} on ${action.taskDate} conflicts with ${action.eventTitle} on ${action.eventDate}.`;
		default:
			return '';
	}
}

function upsertLink(links: SyncLink[], link: SyncLink): void {
	const index = links.findIndex(
		(item) => item.taskKey === link.taskKey || item.eventId === link.eventId,
	);
	if (index >= 0) links[index] = link;
	else links.push(link);
}

async function loadLinks(plugin: TaskHost): Promise<SyncLink[]> {
	const stored = (await plugin.loadData()) as { calendarLinks?: SyncLink[] } | null;
	return Array.isArray(stored?.calendarLinks) ? stored.calendarLinks : [];
}

async function saveLinks(plugin: TaskHost, links: SyncLink[]): Promise<void> {
	const stored = ((await plugin.loadData()) ?? {}) as Record<string, unknown>;
	await plugin.saveData({ ...stored, calendarLinks: links });
}

async function replaceLine(
	plugin: TaskHost,
	path: string,
	raw: string,
	next: string,
): Promise<void> {
	const file = plugin.app.vault.getAbstractFileByPath(path);
	if (!(file instanceof TFile)) return;
	await plugin.app.vault.process(file, (data) =>
		data.includes(raw) ? data.replace(raw, next) : data,
	);
}
