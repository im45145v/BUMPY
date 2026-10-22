import { Notice, type App } from 'obsidian';
import { readInstructionFile } from '../instructions/obsidian';
import { loadInstructions } from '../instructions/policy';
import type { CleanupEditor } from '../notes/editor-apply';
import { executeCleanup, type CleanupMode } from '../notes/cleanup-session';
import { createProvider } from '../providers/create-provider';
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
	const pending = cleanupNotice(controller);
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
		session = await executeCleanup(
			editor,
			mode,
			host.settings.model,
			(request) => createProvider(host.settings).complete(request),
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

function cleanupNotice(controller: AbortController): {
	fragment: DocumentFragment;
	button: HTMLButtonElement;
} {
	const fragment = createFragment();
	fragment.createSpan({ text: 'Cleaning up… ' });
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
