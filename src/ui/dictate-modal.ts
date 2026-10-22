import { ButtonComponent, Modal, Notice, type App } from 'obsidian';
import type { DictatePhase } from '../audio/phase';
import type { CleanupHost } from '../commands/cleanup';
import { readInstructionFile } from '../instructions/obsidian';
import { loadInstructions } from '../instructions/policy';
import type { CleanupEditor, EditorPosition } from '../notes/editor-apply';
import { insertReviewedText } from '../notes/insert';
import { proposeCleanup } from '../notes/cleanup-session';
import { createProvider } from '../providers/create-provider';
import { resolveFeature } from '../providers/features';
import { CleanupPreviewModal } from './preview-modal';

export class DictateModal extends Modal {
	private transcript = '';
	private snapshot = '';
	private cursor: EditorPosition = { line: 0, ch: 0 };
	private readonly controller: AbortController;
	private releaseStop: (() => void) | null = null;

	constructor(
		app: App,
		private readonly host: CleanupHost,
		private readonly editor: CleanupEditor,
		private readonly capture: (request: {
			signal: AbortSignal;
			stopped: Promise<void>;
			onPhase: (phase: DictatePhase) => void;
		}) => Promise<{ ok: true; text: string } | { ok: false; message: string }>,
		controller: AbortController,
		private readonly onFinish: () => void,
	) {
		super(app);
		this.controller = controller;
	}

	onOpen(): void {
		this.setTitle('Dictate');
		void this.captureSpeech();
	}

	onClose(): void {
		this.controller.abort();
		this.releaseStop?.();
		this.onFinish();
		this.contentEl.empty();
	}

	private async captureSpeech(): Promise<void> {
		let stopped!: () => void;
		const stoppedPromise = new Promise<void>((resolve) => {
			stopped = resolve;
		});
		this.releaseStop = stopped;
		this.render({ name: 'recording', partial: '' });
		const result = await this.capture({
			signal: this.controller.signal,
			stopped: stoppedPromise,
			onPhase: (phase) => {
				if (phase.name === 'review') {
					this.transcript = phase.transcript;
					this.snapshot = this.editor.getValue();
					this.cursor = this.editor.getCursor();
				}
				if (!this.controller.signal.aborted) this.render(phase);
			},
		});
		if (this.controller.signal.aborted) return;
		if (!result.ok) this.render({ name: 'error', message: result.message });
	}

	private render(phase: DictatePhase): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bumpy-dictate');

		if (phase.name === 'recording') {
			contentEl.createEl('p', { text: 'Recording. Select stop when you are done.' });
			if (phase.partial) {
				contentEl.createEl('p', { text: phase.partial, cls: 'bumpy-dictate-partial' });
			}
			this.actions(contentEl, 'Stop', () => this.releaseStop?.());
			return;
		}

		if (phase.name === 'transcribing') {
			contentEl.createEl('p', { text: 'Transcribing…' });
			this.actions(contentEl, 'Cancel', () => this.close());
			return;
		}

		if (phase.name === 'error') {
			contentEl.createEl('p', { text: phase.message });
			this.actions(contentEl, 'Close', () => this.close());
			return;
		}

		if (phase.name === 'review') {
			contentEl.createEl('p', {
				text: 'Edit the transcript, then insert it or clean it up.',
				cls: 'bumpy-preview-note',
			});
			const field = contentEl.createEl('textarea', { cls: 'bumpy-transcript' });
			field.value = this.transcript;
			field.addEventListener('input', () => {
				this.transcript = field.value;
			});
			const actions = contentEl.createDiv({ cls: 'bumpy-preview-actions' });
			new ButtonComponent(actions).setButtonText('Discard').onClick(() => this.close());
			new ButtonComponent(actions).setButtonText('Clean up').onClick(() => {
				void this.cleanUp();
			});
			new ButtonComponent(actions)
				.setButtonText('Insert')
				.setCta()
				.onClick(() => {
					if (this.insert(this.transcript)) this.close();
				});
		}
	}

	private actions(
		parent: HTMLElement,
		label: string,
		onClick: () => void,
	): void {
		const actions = parent.createDiv({ cls: 'bumpy-preview-actions' });
		new ButtonComponent(actions).setButtonText(label).setCta().onClick(onClick);
		if (label !== 'Cancel' && label !== 'Close') {
			new ButtonComponent(actions).setButtonText('Cancel').onClick(() => this.close());
		}
	}

	private insert(text: string): boolean {
		const decision = insertReviewedText(
			this.editor,
			this.cursor,
			this.snapshot,
			text,
		);
		if (!decision.ok) {
			new Notice(decision.reason);
			return false;
		}
		return true;
	}

	private async cleanUp(): Promise<void> {
		const instructions = await loadInstructions(
			this.host.app.workspace.getActiveFile()?.path ?? '',
			(path) => readInstructionFile(this.host.app, path),
		);
		const endpoint = resolveFeature(this.host.settings, 'cleanup');
		const proposal = await proposeCleanup(
			this.transcript,
			'selection',
			endpoint.model,
			(request) => createProvider(endpoint).complete(request),
			{ signal: this.controller.signal, instructions: instructions.text },
		);
		if (this.controller.signal.aborted || proposal.status === 'cancelled') return;
		if (proposal.status === 'blocked') {
			new Notice(proposal.message);
			return;
		}
		new CleanupPreviewModal(this.app, {
			original: proposal.original,
			proposed: proposal.proposed,
			warnings: [...instructions.warnings, ...proposal.warnings],
			onApply: () => this.insert(proposal.proposed),
		}).open();
	}
}
