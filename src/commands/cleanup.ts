import { Notice, type App } from 'obsidian';
import type { CleanupEditor } from '../notes/editor-apply';
import { executeCleanup, type CleanupMode } from '../notes/cleanup-session';
import { createProvider } from '../providers/create-provider';
import type { BumpySettings } from '../settings';
import { CleanupPreviewModal } from '../ui/preview-modal';

export interface CleanupHost {
	app: App;
	settings: BumpySettings;
}

export async function runCleanup(
	host: CleanupHost,
	editor: CleanupEditor,
	mode: CleanupMode,
): Promise<void> {
	const session = await executeCleanup(
		editor,
		mode,
		host.settings.model,
		async (request) => {
			const notice = new Notice('Cleaning up…', 0);
			try {
				return await createProvider(host.settings).complete(request);
			} finally {
				notice.hide();
			}
		},
	);

	if (session.status === 'blocked') {
		new Notice(session.message);
		return;
	}

	new CleanupPreviewModal(host.app, {
		original: session.original,
		proposed: session.proposed,
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
