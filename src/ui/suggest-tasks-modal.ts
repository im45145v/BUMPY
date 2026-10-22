import { ButtonComponent, Modal, Notice, Setting, type App } from 'obsidian';
import { writeIfUnchanged } from '../notes/document';
import type { CleanupEditor } from '../notes/editor-apply';
import { appendTask, formatTaskLine, type DateResolution, type Priority } from '../tasks/parse';

export interface TaskSuggestion {
	title: string;
	source: string;
	due: DateResolution;
	time: string | null;
	priority: Priority | null;
}

export class SuggestTasksModal extends Modal {
	private readonly selected = new Set<number>();
	private readonly chosen = new Map<number, string>();

	constructor(
		app: App,
		private readonly editor: CleanupEditor,
		private readonly snapshot: string,
		private readonly suggestions: readonly TaskSuggestion[],
	) {
		super(app);
		suggestions.forEach((_, index) => this.selected.add(index));
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Suggest tasks');
		contentEl.createEl('p', {
			text: 'Nothing is written until you add the selected tasks.',
			cls: 'bumpy-preview-note',
		});
		this.suggestions.forEach((suggestion, index) => {
			new Setting(contentEl)
				.setName(suggestion.title)
				.setDesc(suggestion.source)
				.addToggle((toggle) => {
					toggle.setValue(true).onChange((value) => {
						if (value) this.selected.add(index);
						else this.selected.delete(index);
					});
				});
			if (suggestion.due.kind === 'ambiguous') {
				contentEl.createEl('p', { text: suggestion.due.prompt });
				const dates = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
				for (const iso of suggestion.due.options) {
					new ButtonComponent(dates).setButtonText(iso).onClick(() => {
						this.chosen.set(index, iso);
					});
				}
			}
		});
		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText('Discard').onClick(() => this.close());
		new ButtonComponent(actions)
			.setButtonText('Add tasks')
			.setCta()
			.onClick(() => {
				if (this.commit()) this.close();
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private commit(): boolean {
		let next = this.snapshot;
		let added = 0;
		for (const [index, suggestion] of this.suggestions.entries()) {
			if (!this.selected.has(index)) continue;
			const due = dueDate(suggestion, this.chosen.get(index));
			if (!due.ok) {
				new Notice(`Choose a date for ${suggestion.title}.`);
				return false;
			}
			next = appendTask(
				next,
				formatTaskLine({
					title: suggestion.title,
					due: due.due,
					time: suggestion.time,
					priority: suggestion.priority,
				}),
			);
			added += 1;
		}
		if (added === 0) {
			new Notice('Select at least one task.');
			return false;
		}
		const written = writeIfUnchanged(
			this.editor,
			this.snapshot,
			next,
			'There are no tasks to add.',
		);
		if (!written.ok) {
			new Notice(written.reason);
			return false;
		}
		return true;
	}
}

function dueDate(
	suggestion: TaskSuggestion,
	chosen: string | undefined,
): { ok: true; due: string | null } | { ok: false } {
	if (suggestion.due.kind === 'date') return { ok: true, due: suggestion.due.iso };
	if (suggestion.due.kind === 'none') return { ok: true, due: null };
	if (!chosen) return { ok: false };
	return { ok: true, due: chosen };
}
