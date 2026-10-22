import { ButtonComponent, Modal, type App } from 'obsidian';
import type { KnowledgeGap } from '../insights/report';

export class GapModal extends Modal {
	constructor(
		app: App,
		private readonly gaps: readonly KnowledgeGap[],
		private readonly onResearch: (query: string) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Knowledge gaps');
		contentEl.createEl('p', {
			text: 'These are places a note looks unfinished. Research does not start until you choose it.',
			cls: 'bumpy-preview-note',
		});
		for (const gap of this.gaps) {
			const row = contentEl.createDiv();
			row.createEl('p', { text: gap.topic });
			row.createEl('p', { text: gap.reason, cls: 'bumpy-preview-note' });
			new ButtonComponent(row).setButtonText('Research this').onClick(() => {
				this.onResearch(gap.query);
				this.close();
			});
			new ButtonComponent(row).setButtonText('Open note').onClick(() => {
				void this.app.workspace.openLinkText(gap.path, gap.path, 'tab');
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
