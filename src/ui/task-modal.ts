import { ButtonComponent, Modal, Notice, type App } from 'obsidian';
import type { CleanupEditor } from '../notes/editor-apply';
import { writeIfUnchanged } from '../notes/document';
import {
	appendTask,
	formatTaskLine,
	parseNaturalTask,
	type DateResolution,
} from '../tasks/parse';

export class TaskCaptureModal extends Modal {
	private phrase: string;
	private resolution: DateResolution = { kind: 'none' };

	constructor(
		app: App,
		private readonly editor: CleanupEditor,
		phrase: string,
		private readonly today: Date,
	) {
		super(app);
		this.phrase = phrase;
	}

	onOpen(): void {
		this.setTitle('Capture task');
		this.renderPhrase();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private renderPhrase(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('p', {
			text: 'Write the task in a sentence. Nothing is saved until you add it.',
			cls: 'bumpy-preview-note',
		});
		const field = contentEl.createEl('textarea', { cls: 'bumpy-transcript' });
		field.value = this.phrase;
		field.addEventListener('input', () => {
			this.phrase = field.value;
		});
		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText('Cancel').onClick(() => this.close());
		new ButtonComponent(actions)
			.setButtonText('Add task')
			.setCta()
			.onClick(() => {
				const parsed = parseNaturalTask(this.phrase, this.today);
				if (parsed.title === '') {
					new Notice('The task is empty.');
					return;
				}
				this.resolution = parsed.due;
				if (parsed.due.kind === 'ambiguous') {
					this.renderChoice(parsed.title, parsed.time, parsed.priority);
					return;
				}
				const due = parsed.due.kind === 'date' ? parsed.due.iso : null;
				this.commit(parsed.title, due, parsed.time, parsed.priority);
			});
	}

	private renderChoice(
		title: string,
		time: string | null,
		priority: 'high' | 'medium' | 'low' | null,
	): void {
		if (this.resolution.kind !== 'ambiguous') return;
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('p', { text: this.resolution.prompt });
		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		for (const iso of this.resolution.options) {
			new ButtonComponent(actions).setButtonText(iso).onClick(() => {
				this.commit(title, iso, time, priority);
			});
		}
		new ButtonComponent(actions).setButtonText('Cancel').onClick(() => this.close());
	}

	private commit(
		title: string,
		due: string | null,
		time: string | null,
		priority: 'high' | 'medium' | 'low' | null,
	): void {
		const snapshot = this.editor.getValue();
		const line = formatTaskLine({ title, due, time, priority });
		const decision = writeIfUnchanged(
			this.editor,
			snapshot,
			appendTask(snapshot, line),
			'The task is empty.',
		);
		if (!decision.ok) {
			new Notice(decision.reason);
			return;
		}
		this.close();
	}
}
