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

interface OpenPreview {
	generation: number;
	close: () => void;
}

let generation = 0;
let current: OpenPreview | null = null;

/** Closes the Obsidian preview when the call no longer has one. */
export function closeCallPreview(): void {
	const open = current;
	current = null;
	open?.close();
}

export function openCallPreview(
	plugin: PreviewHost,
	preview: CallPreview,
	write: (path: string, text: string, expected?: string) => Promise<void>,
	read: (path: string) => Promise<string | null>,
): void {
	const mine = ++generation;
	const previous = current;
	current = null;
	previous?.close();
	let wrote = false;
	const modal = new CleanupPreviewModal(plugin.app, {
		title: 'Review call change',
		original: preview.original,
		proposed: preview.proposed,
		warnings: preview.warnings,
		note: 'This replaces the whole note. Say apply to write it, or discard to cancel. Nothing is written until you do.',
		onApply: async () => {
			try {
				const note = await read(preview.path);
				if (note === null) {
					new Notice('That note is not available.');
					return false;
				}
				if (note === preview.proposed) {
					wrote = true;
					await releaseCallPreview(plugin);
					new Notice('That note already has this text.');
					return true;
				}
				const decision = decideReplacement(note, preview.original, preview.proposed);
				if (!decision.ok) {
					new Notice(decision.reason);
					return false;
				}
				await write(preview.path, decision.next, note);
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
			const stillCurrent = current?.generation === mine;
			if (stillCurrent) current = null;
			if (!wrote && stillCurrent) void releaseCallPreview(plugin);
		},
	});
	current = { generation: mine, close: () => modal.close() };
	modal.open();
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
