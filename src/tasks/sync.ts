export type SyncPolicy = 'vault-wins' | 'calendar-wins' | 'ask';

export interface TrackedTask {
	key: string;
	title: string;
	date: string;
	eventId: string | null;
}

export interface TrackedEvent {
	id: string;
	title: string;
	date: string;
}

export interface SyncLink {
	taskKey: string;
	eventId: string;
	title: string;
	date: string;
}

export type SyncAction =
	| { type: 'create-event'; taskKey: string; title: string; date: string }
	| { type: 'update-event'; eventId: string; title: string; date: string; taskKey: string }
	| { type: 'update-task'; taskKey: string; eventId: string; title: string; date: string }
	| {
			type: 'conflict';
			taskKey: string;
			eventId: string;
			taskTitle: string;
			taskDate: string;
			eventTitle: string;
			eventDate: string;
	  }
	| { type: 'remember'; taskKey: string; eventId: string; title: string; date: string }
	| { type: 'unchanged'; taskKey: string };

/**
 * Vault tasks with dates are the records Bumpy creates.
 * Calendar events that Bumpy did not link are left alone.
 * When both sides changed since the last sync, `ask` reports a conflict.
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
			actions.push({
				type: 'create-event',
				taskKey: task.key,
				title: task.title,
				date: task.date,
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
			});
			continue;
		}
		const taskChanged = task.title !== link.title || task.date !== link.date;
		const eventChanged = event.title !== link.title || event.date !== link.date;
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
			taskKey: action.taskKey,
		};
	}
	return {
		type: 'update-task',
		taskKey: action.taskKey,
		eventId: action.eventId,
		title: action.eventTitle,
		date: action.eventDate,
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
		};
	}
	return {
		type: 'conflict',
		taskKey: task.key,
		eventId: event.id,
		taskTitle: task.title,
		taskDate: task.date,
		eventTitle: event.title,
		eventDate: event.date,
	};
}
