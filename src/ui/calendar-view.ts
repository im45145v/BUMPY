import { ItemView, MarkdownView, TFile, type WorkspaceLeaf } from 'obsidian';
import { buildMonth, dueTasks, localIso } from '../tasks/calendar';
import { tasksIn, type MarkdownTask } from '../tasks/parse';
import { parseFolders } from '../linking/suggest';
import { readTaskNotes } from '../vault/notes';
import type { CleanupHost } from '../commands/cleanup';

export const CALENDAR_VIEW = 'bumpy-calendar';

interface PlacedTask extends MarkdownTask {
	path: string;
	line: number;
}

export class CalendarView extends ItemView {
	private cursor: Date = new Date();

	constructor(
		leaf: WorkspaceLeaf,
		private readonly host: CleanupHost,
	) {
		super(leaf);
	}

	getViewType(): string {
		return CALENDAR_VIEW;
	}

	getDisplayText(): string {
		return 'Calendar';
	}

	async onOpen(): Promise<void> {
		await this.draw();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private async draw(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bumpy-calendar-view');
		const year = this.cursor.getFullYear();
		const month = this.cursor.getMonth() + 1;
		const title = contentEl.createDiv({ cls: 'bumpy-calendar-title' });
		title.createEl('button', { text: 'Previous' }).addEventListener('click', () => {
			this.cursor = new Date(year, month - 2, 1);
			void this.draw();
		});
		title.createSpan({
			text: this.cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
		});
		title.createEl('button', { text: 'Next' }).addEventListener('click', () => {
			this.cursor = new Date(year, month, 1);
			void this.draw();
		});

		const { notes } = await readTaskNotes(
			this.app,
			parseFolders(this.host.settings.excludedFolders),
		);
		const tasks: PlacedTask[] = notes.flatMap((note) =>
			tasksIn(note.text)
				.filter((task) => !task.done)
				.map((task) => ({ ...task, path: note.path })),
		);
		const today = localIso(new Date());
		this.drawDue(contentEl, dueTasks(tasks, today));
		const cells = buildMonth(year, month, tasks);
		const grid = contentEl.createDiv({ cls: 'bumpy-calendar' });
		for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
			grid.createDiv({ text: label, cls: 'bumpy-calendar-label' });
		}
		for (const cell of cells) {
			const classes = ['bumpy-calendar-day'];
			if (!cell.inMonth) classes.push('bumpy-calendar-outside');
			if (cell.iso === today) classes.push('bumpy-calendar-today');
			const day = grid.createDiv({ cls: classes.join(' ') });
			day.createDiv({ text: cell.iso.slice(8), cls: 'bumpy-calendar-date' });
			for (const task of cell.tasks.slice(0, 4)) {
				this.taskButton(day, taskLabel(task), task);
			}
		}
	}

	private drawDue(parent: HTMLElement, tasks: PlacedTask[]): void {
		if (tasks.length === 0) return;
		const due = parent.createDiv({ cls: 'bumpy-due' });
		due.createDiv({ text: 'Due', cls: 'bumpy-due-title' });
		due.createEl('p', {
			text: 'Open tasks due today or earlier. A notice also appears at the task time.',
			cls: 'bumpy-preview-note',
		});
		for (const task of tasks.slice(0, 12)) {
			const when = task.time ? `${task.due} ${task.time}` : task.due;
			this.taskButton(due, `${when} ${task.title}`, task);
		}
	}

	private taskButton(parent: HTMLElement, label: string, task: PlacedTask): void {
		const button = parent.createEl('button', { text: label, cls: 'bumpy-calendar-task' });
		button.title = label;
		button.addEventListener('click', () => {
			void openTask(this, task);
		});
	}
}

function taskLabel(task: PlacedTask): string {
	return task.time ? `${task.time} ${task.title}` : task.title;
}

async function openTask(view: CalendarView, task: PlacedTask): Promise<void> {
	const file = view.app.vault.getAbstractFileByPath(task.path);
	if (!(file instanceof TFile)) return;
	const leaf = view.app.workspace.getLeaf(false);
	await leaf.openFile(file);
	const opened = leaf.view;
	if (opened instanceof MarkdownView) {
		opened.editor.setCursor({ line: task.line, ch: 0 });
	}
}
