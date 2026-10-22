import { App, ButtonComponent, Modal } from 'obsidian';

export interface CleanupPreview {
	original: string;
	proposed: string;
	warnings?: readonly string[];
	onApply: () => boolean;
}

export class CleanupPreviewModal extends Modal {
	constructor(
		app: App,
		private readonly preview: CleanupPreview,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bumpy-preview');
		this.setTitle('Review cleanup');

		contentEl.createEl('p', {
			text: 'Nothing is written until you apply this proposal.',
			cls: 'bumpy-preview-note',
		});

		if (this.preview.proposed.trim() === '') {
			contentEl.createEl('p', {
				text: 'The model returned an empty proposal.',
			});
		}

		const warnings = this.preview.warnings ?? [];
		if (warnings.length > 0) {
			const box = contentEl.createDiv({ cls: 'bumpy-preview-warnings' });
			box.createEl('p', { text: 'Review these warnings before applying.' });
			const list = box.createEl('ul');
			for (const warning of warnings) list.createEl('li', { text: warning });
		}

		const columns = contentEl.createDiv({ cls: 'bumpy-preview-columns' });
		addPane(columns, 'Original', this.preview.original);
		addPane(columns, 'Proposed', this.preview.proposed);

		const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText('Discard').onClick(() => {
			this.close();
		});

		const apply = new ButtonComponent(actions)
			.setButtonText(warnings.length > 0 ? 'Apply anyway' : 'Apply')
			.setCta()
			.onClick(() => {
				if (this.preview.onApply()) this.close();
			});
		if (this.preview.proposed.trim() === '') apply.setDisabled(true);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function addPane(parent: HTMLElement, title: string, text: string): void {
	const pane = parent.createDiv({ cls: 'bumpy-preview-pane' });
	pane.createEl('h3', { text: title });
	pane.createEl('pre', { text, cls: 'bumpy-preview-text' });
}
