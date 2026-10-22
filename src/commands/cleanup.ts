import { Notice, type App } from 'obsidian';
import { readInstructionFile } from '../instructions/obsidian';
import { loadInstructions } from '../instructions/policy';
import { selectionRange, type CleanupEditor } from '../notes/editor-apply';
import { executeCleanup, type CleanupMode } from '../notes/cleanup-session';
import { createProvider } from '../providers/create-provider';
import { resolveFeature } from '../providers/features';
import { cancelOnClick } from '../requests/dismiss';
import type { RequestScope } from '../requests/scope';
import type { BumpySettings } from '../settings';
import { CleanupPreviewModal } from '../ui/preview-modal';

export interface CleanupHost {
	app: App;
	settings: BumpySettings;
	requests: RequestScope;
}

export async function runCleanup(
	host: CleanupHost,
	editor: CleanupEditor,
	mode: CleanupMode,
): Promise<void> {
	const controller = host.requests.start();
	const cleaningSelection =
		mode === 'selection' || (mode === 'auto' && selectionRange(editor) !== null);
	const pending = cleanupNotice(
		controller,
		cleaningSelection ? 'Cleaning up the selection… ' : 'Cleaning up the note… ',
	);
	const notice = new Notice(pending.fragment, 0);
	const surface =
		pending.button.parentElement?.parentElement ??
		pending.button.parentElement ??
		pending.button;
	const release = cancelOnClick(surface, controller);

	let session: Awaited<ReturnType<typeof executeCleanup>>;
	let instructionWarnings: string[] = [];
	try {
		const instructions = await loadInstructions(
			host.app.workspace.getActiveFile()?.path ?? '',
			(path) => readInstructionFile(host.app, path),
		);
		instructionWarnings = instructions.warnings;
		const endpoint = resolveFeature(host.settings, 'cleanup');
		session = await executeCleanup(
			editor,
			mode,
			endpoint.model,
			(request) => createProvider(endpoint).complete(request),
			{ signal: controller.signal, instructions: instructions.text },
		);
	} finally {
		release();
		notice.hide();
		host.requests.finish(controller);
	}

	if (controller.signal.aborted || session.status === 'cancelled') return;

	if (session.status === 'blocked') {
		new Notice(session.message);
		for (const warning of instructionWarnings) new Notice(warning);
		return;
	}

	new CleanupPreviewModal(host.app, {
		original: session.original,
		proposed: session.proposed,
		note:
			session.target === 'selection'
				? 'This replaces only the selected text. Nothing is written until you apply.'
				: 'This replaces the whole note. Nothing is written until you apply.',
		warnings: [...instructionWarnings, ...session.warnings],
		onApply: () => {
			const decision = session.apply();
			if (!decision.ok) {
				new Notice(decision.reason);
				return false;
			}
			return true;
		},
	}).open();
}

function cleanupNotice(
	controller: AbortController,
	label: string,
): {
	fragment: DocumentFragment;
	button: HTMLButtonElement;
} {
	const fragment = createFragment();
	fragment.createSpan({ text: label });
	const button = fragment.createEl('button', {
		text: 'Cancel',
		cls: 'bumpy-notice-cancel',
	});
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		controller.abort();
	});
	return { fragment, button };
}
