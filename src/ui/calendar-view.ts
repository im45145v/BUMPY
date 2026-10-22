import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { buildMonth } from '../tasks/calendar';
import { tasksIn, type MarkdownTask } from '../tasks/parse';
import { parseFolders } from '../linking/suggest';
import { readMarkdownNotes } from '../vault/notes';
import type { CleanupHost } from '../commands/cleanup';

export const CALENDAR_VIEW = 'bumpy-calendar';

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

		const notes = await readMarkdownNotes(
			this.app,
			parseFolders(this.host.settings.excludedFolders),
		);
		const tasks: MarkdownTask[] = notes.flatMap((note) =>
			tasksIn(note.text).filter((task) => !task.done),
		);
		const cells = buildMonth(year, month, tasks);
		const grid = contentEl.createDiv({ cls: 'bumpy-calendar' });
		for (const label of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
			grid.createDiv({ text: label, cls: 'bumpy-calendar-label' });
		}
		for (const cell of cells) {
			const day = grid.createDiv({
				cls: cell.inMonth ? 'bumpy-calendar-day' : 'bumpy-calendar-day bumpy-calendar-outside',
			});
			day.createDiv({ text: cell.iso.slice(8), cls: 'bumpy-calendar-date' });
			for (const task of cell.tasks.slice(0, 4)) {
				day.createDiv({ text: task.title, cls: 'bumpy-calendar-task' });
			}
		}
	}
}
