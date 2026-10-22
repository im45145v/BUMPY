import { ButtonComponent, Modal, Notice, type App } from 'obsidian';

export class QuestionModal extends Modal {
	private value = '';

	constructor(
		app: App,
		private readonly options: {
			title: string;
			note: string;
			confirm: string;
			onSubmit: (value: string) => void;
		},
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle(this.options.title);
		contentEl.createEl('p', { text: this.options.note, cls: 'bumpy-preview-note' });
		const field = contentEl.createEl('textarea', { cls: 'bumpy-transcript' });
		field.addEventListener('input', () => {
			this.value = field.value;
		});
		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText('Cancel').onClick(() => this.close());
		new ButtonComponent(actions)
			.setButtonText(this.options.confirm)
			.setCta()
			.onClick(() => {
				const value = this.value.trim();
				if (value === '') {
					new Notice('Enter some text first.');
					return;
				}
				this.close();
				this.options.onSubmit(value);
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
