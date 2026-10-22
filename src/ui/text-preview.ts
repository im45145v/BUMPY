import { ButtonComponent, Modal, Notice, type App } from 'obsidian';

export class TextPreviewModal extends Modal {
	constructor(
		app: App,
		private readonly options: {
			title: string;
			note: string;
			text: string;
			confirm: string;
			warnings?: readonly string[];
			onConfirm: () => Promise<boolean> | boolean;
		},
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bumpy-preview');
		this.setTitle(this.options.title);
		contentEl.createEl('p', { text: this.options.note, cls: 'bumpy-preview-note' });
		const warnings = this.options.warnings ?? [];
		if (warnings.length > 0) {
			const box = contentEl.createDiv({ cls: 'bumpy-preview-warnings' });
			const list = box.createEl('ul');
			for (const warning of warnings) list.createEl('li', { text: warning });
		}
		contentEl.createEl('pre', { text: this.options.text, cls: 'bumpy-preview-text' });
		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText('Discard').onClick(() => this.close());
		new ButtonComponent(actions)
			.setButtonText(this.options.confirm)
			.setCta()
			.onClick(() => {
				void Promise.resolve()
					.then(() => this.options.onConfirm())
					.then((ok) => {
						if (ok) this.close();
					})
					.catch(() => {
						new Notice('Could not finish that action.');
					});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
