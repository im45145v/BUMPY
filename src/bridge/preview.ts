import { Notice, type App } from 'obsidian';
import { decideReplacement } from '../notes/apply';
import { obsidianHttp } from '../providers/obsidian-http';
import type { BumpySettings } from '../settings';
import { CleanupPreviewModal } from '../ui/preview-modal';
import type { CallPreview } from './jobs';
import { bridgeEndpoint } from './poll';

interface PreviewHost {
	app: App;
	settings: BumpySettings;
}

export function openCallPreview(
	plugin: PreviewHost,
	preview: CallPreview,
	write: (path: string, text: string) => Promise<void>,
	read: (path: string) => Promise<string | null>,
): void {
	let wrote = false;
	new CleanupPreviewModal(plugin.app, {
		title: 'Review call change',
		original: preview.original,
		proposed: preview.proposed,
		warnings: preview.warnings,
		note: 'This replaces the whole note. Nothing is written until you apply it here, or say apply on the call.',
		onApply: async () => {
			try {
				const current = await read(preview.path);
				if (current === null) {
					new Notice('That note is not available.');
					return false;
				}
				if (current === preview.proposed) {
					wrote = true;
					await releaseCallPreview(plugin);
					new Notice('That note already has this text.');
					return true;
				}
				const decision = decideReplacement(current, preview.original, preview.proposed);
				if (!decision.ok) {
					new Notice(decision.reason);
					return false;
				}
				await write(preview.path, decision.next);
				wrote = true;
				await releaseCallPreview(plugin);
				return true;
			} catch (error) {
				const message = error instanceof Error ? error.message : 'Could not write that note.';
				new Notice(message);
				return false;
			}
		},
		onDismiss: () => {
			if (!wrote) void releaseCallPreview(plugin);
		},
	}).open();
}

async function releaseCallPreview(plugin: PreviewHost): Promise<void> {
	const token = plugin.settings.callBridgeToken.trim();
	const url = bridgeEndpoint(plugin.settings.callBridgeUrl, '/bridge/preview/drop');
	if (!plugin.settings.callBridge || token === '' || url === null) return;
	try {
		await obsidianHttp({
			url,
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			contentType: 'application/json',
			body: '{}',
		});
	} catch {
		return;
	}
}
