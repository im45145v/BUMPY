import { ButtonComponent, Modal, type App } from 'obsidian';

export interface AnswerSource {
	path: string;
	title: string;
	heading: string;
	text: string;
}

export class AnswerModal extends Modal {
	constructor(
		app: App,
		private readonly answer: string,
		private readonly sources: readonly AnswerSource[],
		private readonly onInsert: (() => boolean) | null,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bumpy-preview');
		this.setTitle('Vault answer');
		contentEl.createEl('p', {
			text: 'This answer uses the retrieved passages. It is not written until you insert it.',
			cls: 'bumpy-preview-note',
		});
		contentEl.createEl('pre', { text: this.answer, cls: 'bumpy-preview-text' });
		contentEl.createEl('h3', { text: 'Sources' });
		if (this.sources.length === 0) {
			contentEl.createEl('p', { text: 'No passages were retrieved.' });
		}
		for (const source of this.sources) {
			const row = contentEl.createDiv();
			row.createEl('p', { text: `${source.title} — ${source.heading}` });
			row.createEl('pre', { text: source.text, cls: 'bumpy-preview-text' });
			new ButtonComponent(row).setButtonText('Open note').onClick(() => {
				void this.app.workspace.openLinkText(source.path, source.path, 'tab');
			});
		}
		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText('Discard').onClick(() => this.close());
		if (this.onInsert) {
			new ButtonComponent(actions)
				.setButtonText('Insert')
				.setCta()
				.onClick(() => {
					if (this.onInsert?.()) this.close();
				});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
