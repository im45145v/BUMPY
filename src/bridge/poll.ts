import type { BumpySettings } from '../settings';
import type { HttpClient } from '../providers/types';
import { readBridgeJob, runVaultJob, type VaultSurface } from './jobs';

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

export async function pollCallBridge(
	http: HttpClient,
	settings: BumpySettings,
	surface: VaultSurface,
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
	const job = readBridgeJob(listed.body);
	if (!job) return;
	const result = await runVaultJob(surface, job);
	const resultUrl = bridgeEndpoint(settings.callBridgeUrl, `/bridge/jobs/${job.id}`);
	if (!resultUrl) return;
	await http({
		url: resultUrl,
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		contentType: 'application/json',
		body: JSON.stringify(result),
	});
}

export function createBridgePoller(
	http: HttpClient,
	settings: () => BumpySettings,
	surface: () => VaultSurface,
): () => Promise<void> {
	let busy = false;
	return async () => {
		if (busy || !settings().callBridge) return;
		busy = true;
		try {
			await pollCallBridge(http, settings(), surface());
		} finally {
			busy = false;
		}
	};
}

function localHost(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return true;
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
