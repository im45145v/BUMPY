import { ButtonComponent, Modal, Notice, Setting, type App } from 'obsidian';
import {
	applyReviewedLinks,
	type LinkEdit,
	type RelatedNote,
} from '../linking/suggest';
import { writeIfUnchanged } from '../notes/document';
import type { CleanupEditor } from '../notes/editor-apply';

export class LinksModal extends Modal {
	private readonly selected = new Set<number>();

	constructor(
		app: App,
		private readonly editor: CleanupEditor,
		private readonly snapshot: string,
		private readonly sourcePath: string,
		private readonly edits: LinkEdit[],
		private readonly related: RelatedNote[],
		private readonly backlinks: Array<{ path: string; title: string }>,
	) {
		super(app);
		edits.forEach((_, index) => this.selected.add(index));
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bumpy-links');
		this.setTitle('Review links');
		contentEl.createEl('p', {
			text: 'Nothing is written until you apply the selected links.',
			cls: 'bumpy-preview-note',
		});

		if (this.edits.length === 0) {
			contentEl.createEl('p', { text: 'No new links to suggest in this note.' });
		}
		this.edits.forEach((edit, index) => {
			new Setting(contentEl)
				.setName(edit.replacement)
				.setDesc(edit.reason)
				.addToggle((toggle) =>
					toggle.setValue(true).onChange((value) => {
						if (value) this.selected.add(index);
						else this.selected.delete(index);
					}),
				);
		});

		if (this.related.length > 0 || this.backlinks.length > 0) {
			contentEl.createEl('h3', { text: 'Related notes' });
		}
		for (const note of this.related) {
			const label =
				note.terms.length > 0
					? `${note.title} shares ${note.terms.join(', ')}.`
					: note.title;
			new Setting(contentEl).setName(note.title).setDesc(label).addButton((button) =>
				button.setButtonText('Open').onClick(() => {
					void this.app.workspace.openLinkText(note.title, this.sourcePath, 'tab');
				}),
			);
		}
		for (const note of this.backlinks) {
			if (this.related.some((related) => related.path === note.path)) continue;
			new Setting(contentEl)
				.setName(note.title)
				.setDesc('Links to this note.')
				.addButton((button) =>
					button.setButtonText('Open').onClick(() => {
						void this.app.workspace.openLinkText(
							note.title,
							this.sourcePath,
							'tab',
						);
					}),
				);
		}

		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText('Discard').onClick(() => this.close());
		const apply = new ButtonComponent(actions)
			.setButtonText('Apply')
			.setCta()
			.onClick(() => {
				const chosen = this.edits.filter((_, index) => this.selected.has(index));
				const decision = applyReviewedLinks(this.editor.getValue(), this.snapshot, chosen);
				if (!decision.ok) {
					new Notice(decision.reason);
					return;
				}
				const written = writeIfUnchanged(
					this.editor,
					this.snapshot,
					decision.next,
					'There are no links to apply.',
				);
				if (!written.ok) {
					new Notice(written.reason);
					return;
				}
				this.close();
			});
		if (this.edits.length === 0) apply.setDisabled(true);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
