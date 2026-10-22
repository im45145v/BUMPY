export type SyncPolicy = 'vault-wins' | 'calendar-wins' | 'ask';

export interface TrackedTask {
	key: string;
	title: string;
	date: string;
	time?: string | null;
	eventId: string | null;
}

export interface TrackedEvent {
	id: string;
	title: string;
	date: string;
	time?: string | null;
}

export interface SyncLink {
	taskKey: string;
	eventId: string;
	title: string;
	date: string;
	time?: string | null;
}

export type SyncAction =
	| { type: 'create-event'; taskKey: string; title: string; date: string; time: string | null }
	| {
			type: 'update-event';
			eventId: string;
			title: string;
			date: string;
			time: string | null;
			taskKey: string;
	  }
	| {
			type: 'update-task';
			taskKey: string;
			eventId: string;
			title: string;
			date: string;
			time: string | null;
	  }
	| {
			type: 'conflict';
			taskKey: string;
			eventId: string;
			taskTitle: string;
			taskDate: string;
			taskTime: string | null;
			eventTitle: string;
			eventDate: string;
			eventTime: string | null;
	  }
	| {
			type: 'remember';
			taskKey: string;
			eventId: string;
			title: string;
			date: string;
			time: string | null;
	  }
	| { type: 'absent-event'; taskKey: string; eventId: string; title: string; date: string }
	| { type: 'unchanged'; taskKey: string };

/**
 * Vault tasks with dates are the records Bumpy creates.
 * Calendar events that Bumpy did not link are left alone.
 * When both sides changed since the last sync, `ask` reports a conflict.
 * A task that already has an event id is not given another event when that
 * event is missing from the fetched list.
 */
export function planSync(
	tasks: readonly TrackedTask[],
	events: readonly TrackedEvent[],
	links: readonly SyncLink[],
	policy: SyncPolicy,
): SyncAction[] {
	const eventsById = new Map(events.map((event) => [event.id, event]));
	const linksByTask = new Map(links.map((link) => [link.taskKey, link]));
	const linksByEvent = new Map(links.map((link) => [link.eventId, link]));
	const actions: SyncAction[] = [];

	for (const task of tasks) {
		const link =
			linksByTask.get(task.key) ??
			(task.eventId ? linksByEvent.get(task.eventId) : undefined);
		const eventId = task.eventId ?? link?.eventId ?? null;
		const event = eventId ? eventsById.get(eventId) : undefined;
		if (!event) {
			if (eventId) {
				actions.push({
					type: 'absent-event',
					taskKey: task.key,
					eventId,
					title: task.title,
					date: task.date,
				});
				continue;
			}
			actions.push({
				type: 'create-event',
				taskKey: task.key,
				title: task.title,
				date: task.date,
				time: clock(task),
			});
			continue;
		}
		if (!link) {
			actions.push({
				type: 'remember',
				taskKey: task.key,
				eventId: event.id,
				title: task.title,
				date: task.date,
				time: clock(task),
			});
			continue;
		}
		const taskChanged =
			task.title !== link.title || task.date !== link.date || timeChanged(task, event, link);
		const eventChanged =
			event.title !== link.title ||
			event.date !== link.date ||
			recordedTimeChanged(event, link);
		if (taskChanged && eventChanged) {
			actions.push(resolveConflict(task, event, policy));
			continue;
		}
		if (taskChanged) {
			actions.push({
				type: 'update-event',
				eventId: event.id,
				title: task.title,
				date: task.date,
				time: clock(task),
				taskKey: task.key,
			});
			continue;
		}
		if (eventChanged) {
			actions.push({
				type: 'update-task',
				taskKey: task.key,
				eventId: event.id,
				title: event.title,
				date: event.date,
				time: clock(event),
			});
			continue;
		}
		actions.push({ type: 'unchanged', taskKey: task.key });
	}
	return actions;
}

export function chooseConflict(
	action: Extract<SyncAction, { type: 'conflict' }>,
	choice: 'note' | 'calendar',
): SyncAction {
	if (choice === 'note') {
		return {
			type: 'update-event',
			eventId: action.eventId,
			title: action.taskTitle,
			date: action.taskDate,
			time: action.taskTime,
			taskKey: action.taskKey,
		};
	}
	return {
		type: 'update-task',
		taskKey: action.taskKey,
		eventId: action.eventId,
		title: action.eventTitle,
		date: action.eventDate,
		time: action.eventTime,
	};
}

function resolveConflict(
	task: TrackedTask,
	event: TrackedEvent,
	policy: SyncPolicy,
): SyncAction {
	if (policy === 'vault-wins') {
		return {
			type: 'update-event',
			eventId: event.id,
			title: task.title,
			date: task.date,
			time: clock(task),
			taskKey: task.key,
		};
	}
	if (policy === 'calendar-wins') {
		return {
			type: 'update-task',
			taskKey: task.key,
			eventId: event.id,
			title: event.title,
			date: event.date,
			time: clock(event),
		};
	}
	return {
		type: 'conflict',
		taskKey: task.key,
		eventId: event.id,
		taskTitle: task.title,
		taskDate: task.date,
		taskTime: clock(task),
		eventTitle: event.title,
		eventDate: event.date,
		eventTime: clock(event),
	};
}

function clock(value: { time?: string | null }): string | null {
	return value.time ?? null;
}

/**
 * Links saved before times were tracked have no `time` field.
 * A task clock that the event does not have yet updates the event.
 * Once a link stores `time`, each side is compared with that stored clock.
 */
function timeChanged(
	task: { time?: string | null },
	event: { time?: string | null },
	link: { time?: string | null },
): boolean {
	if (!('time' in link)) return clock(task) !== clock(event);
	return clock(task) !== clock(link);
}

function recordedTimeChanged(
	event: { time?: string | null },
	link: { time?: string | null },
): boolean {
	if (!('time' in link)) return false;
	return clock(event) !== clock(link);
}
