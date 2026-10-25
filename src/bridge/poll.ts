import type { BumpySettings } from '../settings';
import type { HttpClient } from '../providers/types';
import { callPreviewFrom, readBridgeJob, runVaultJob, type BridgeJob, type VaultSurface } from './jobs';

export function bridgeEndpoint(base: string, path: string): string | null {
	let url: URL;
	try {
		url = new URL(base.trim());
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
	if (url.username !== '' || url.password !== '') return null;
	if (!localHost(url.hostname)) return null;
	const suffix = path.startsWith('/') ? path : `/${path}`;
	return `${url.origin}${suffix}`;
}

export interface BridgeBoard {
	job: BridgeJob | null;
	/** False when the board says no preview is waiting. Null when the board did not say. */
	preview: boolean | null;
}

export function readBridgeBoard(body: string): BridgeBoard | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== 'object') return null;
	const previewValue = (parsed as { preview?: unknown }).preview;
	const preview = previewValue === true ? true : previewValue === false ? false : null;
	return { job: readBridgeJob(body), preview };
}

export async function pollCallBridge(
	http: HttpClient,
	settings: BumpySettings,
	surface: VaultSurface,
	hooks?: { onPreview?: (open: boolean) => void },
): Promise<void> {
	if (!settings.callBridge) return;
	const token = settings.callBridgeToken.trim();
	const jobsUrl = bridgeEndpoint(settings.callBridgeUrl, '/bridge/jobs');
	if (!token || !jobsUrl) return;
	const listed = await http({
		url: jobsUrl,
		method: 'GET',
		headers: { Authorization: `Bearer ${token}` },
	});
	if (listed.status < 200 || listed.status >= 300) return;
	const board = readBridgeBoard(listed.body);
	if (!board) return;
	if (board.preview === false) hooks?.onPreview?.(false);
	const job = board.job;
	if (!job) return;
	const result = await runVaultJob(surface, job);
	const resultUrl = bridgeEndpoint(settings.callBridgeUrl, `/bridge/jobs/${job.id}`);
	if (!resultUrl) return;
	const posted = await http({
		url: resultUrl,
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		contentType: 'application/json',
		body: JSON.stringify(result),
	});
	if (posted.status < 200 || posted.status >= 300) return;
	if (job.name === 'vault.apply' && result.ok) hooks?.onPreview?.(false);
	if (job.name !== 'vault.preview' || !result.ok || !surface.showPreview) return;
	const preview = callPreviewFrom(result.result);
	if (preview) surface.showPreview(preview);
}

export function createBridgePoller(
	http: HttpClient,
	settings: () => BumpySettings,
	surface: () => VaultSurface,
	hooks?: { onPreview?: (open: boolean) => void },
): () => Promise<void> {
	let busy = false;
	return async () => {
		if (busy || !settings().callBridge) return;
		busy = true;
		try {
			await pollCallBridge(http, settings(), surface(), hooks);
		} catch {
			return;
		} finally {
			busy = false;
		}
	};
}

function localHost(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (host === 'localhost' || host === '::1') return true;
	const parts = host.split('.').map((part) => Number(part));
	if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
		return false;
	}
	const a = parts[0] ?? -1;
	const b = parts[1] ?? -1;
	return (
		a === 10 ||
		a === 127 ||
		(a === 192 && b === 168) ||
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 169 && b === 254)
	);
}
