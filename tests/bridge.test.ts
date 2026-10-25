import { describe, expect, it } from 'vitest';
import { passagesForQuestion } from '../src/bridge/search';
import { hashEmbed, type StoredChunk } from '../src/rag/index';
import { CALL_NOTE_LIMIT, runVaultJob, spokenPreview, type VaultSurface } from '../src/bridge/jobs';
import { bridgeEndpoint, createBridgePoller, pollCallBridge } from '../src/bridge/poll';
import { normalizeSettings } from '../src/settings';
import type { HttpClient, HttpRequest } from '../src/providers/types';

describe('call bridge settings', () => {
	it('stays off until it is turned on', () => {
		expect(normalizeSettings({}).callBridge).toBe(false);
		expect(normalizeSettings({}).callBridgeUrl).toBe('');
		const settings = normalizeSettings({
			callBridge: true,
			callBridgeUrl: 'http://10.0.0.8:8444',
			callBridgeToken: 'token',
		});
		expect(settings.callBridge).toBe(true);
		expect(settings.callBridgeUrl).toBe('http://10.0.0.8:8444');
		expect(settings.callBridgeToken).toBe('token');
	});
});

describe('board address', () => {
	it('accepts a local address and refuses a public one', () => {
		expect(bridgeEndpoint('http://192.168.1.20:8444/', '/bridge/jobs')).toBe(
			'http://192.168.1.20:8444/bridge/jobs',
		);
		expect(bridgeEndpoint('https://127.0.0.1:8444', '/bridge/jobs')).toBe(
			'https://127.0.0.1:8444/bridge/jobs',
		);
		expect(bridgeEndpoint('http://uno.local:8444', '/bridge/jobs')).toBeNull();
		expect(bridgeEndpoint('https://example.com', '/bridge/jobs')).toBeNull();
		expect(bridgeEndpoint('http://user:pass@10.0.0.8:8444', '/bridge/jobs')).toBeNull();
	});
});

describe('vault jobs', () => {
	it('lists open tasks and does not write a preview', async () => {
		const notes = {
			'Home.md': '- [x] Done\n- [ ] Pay rent 📅 2026-10-23\n',
			'Later.md': '- [ ] Buy milk\n',
		};
		const { surface, writes } = memory(notes);
		const tasks = await runVaultJob(surface, {
			id: 'tasklist1',
			name: 'vault.tasks',
			arguments: {},
		});
		expect(tasks).toEqual({
			ok: true,
			result: 'Pay rent, due 2026-10-23 (Home.md)\nBuy milk (Later.md)',
		});
		const preview = await runVaultJob(surface, {
			id: 'preview01',
			name: 'vault.preview',
			arguments: {
				path: 'Home.md',
				proposed: '- [x] Done\n- [ ] Pay rent 📅 2026-10-23\nHello\n',
			},
		});
		expect(preview.ok).toBe(true);
		expect(writes).toEqual([]);
		if (preview.ok) {
			const result = preview.result as { original: string; spoken: string };
			expect(result.original).toBe(notes['Home.md']);
			expect(result.spoken).toBe(spokenPreview([]));
		}
	});

	it('writes only when the preview still matches', async () => {
		const notes = { 'Home.md': 'old note' };
		const { surface, writes } = memory(notes);
		const changed = await runVaultJob(surface, {
			id: 'apply0001',
			name: 'vault.apply',
			arguments: { path: 'Home.md', original: 'older note', proposed: 'new note' },
		});
		expect(changed.ok).toBe(false);
		expect(writes).toEqual([]);
		const applied = await runVaultJob(surface, {
			id: 'apply0002',
			name: 'vault.apply',
			arguments: { path: 'Home.md', original: 'old note', proposed: 'new note' },
		});
		expect(applied).toEqual({ ok: true, result: { written: true, path: 'Home.md' } });
		expect(writes).toEqual(['Home.md']);
		expect(notes['Home.md']).toBe('new note');
		const again = await runVaultJob(surface, {
			id: 'apply0003',
			name: 'vault.apply',
			arguments: { path: 'Home.md', original: 'old note', proposed: 'new note' },
		});
		expect(again).toEqual({
			ok: true,
			result: { written: true, path: 'Home.md', unchanged: true },
		});
		expect(writes).toEqual(['Home.md']);
	});

	it('reads a whole short note and refuses to rewrite a long one', async () => {
		const notes = {
			'Short.md': 'A short note.',
			'Long.md': 'x'.repeat(CALL_NOTE_LIMIT + 50),
		};
		const { surface, writes } = memory(notes);
		const read = await runVaultJob(surface, {
			id: 'read00002',
			name: 'vault.read',
			arguments: { path: 'Short.md' },
		});
		expect(read).toEqual({ ok: true, result: 'A short note.' });
		const excerpt = await runVaultJob(surface, {
			id: 'read00003',
			name: 'vault.read',
			arguments: { path: 'Long.md' },
		});
		expect(excerpt.ok).toBe(true);
		expect(String(excerpt.ok ? excerpt.result : '')).toContain('too long to change on a call');
		const preview = await runVaultJob(surface, {
			id: 'preview02',
			name: 'vault.preview',
			arguments: { path: 'Long.md', proposed: 'replacement' },
		});
		expect(preview).toEqual({
			ok: false,
			error: 'That note is too long to change on a call. Edit it in Obsidian.',
		});
		expect(writes).toEqual([]);
	});

	it('refuses a path outside the vault and an unknown tool', async () => {
		const { surface, writes } = memory({ 'Home.md': 'note' });
		const escaped = await runVaultJob(surface, {
			id: 'read00001',
			name: 'vault.read',
			arguments: { path: '../Secret.md' },
		});
		expect(escaped).toEqual({ ok: false, error: 'invalid arguments' });
		const unknown = await runVaultJob(surface, {
			id: 'nope00001',
			name: 'vault.shell',
			arguments: {},
		});
		expect(unknown).toEqual({ ok: false, error: 'unknown tool' });
		expect(writes).toEqual([]);
	});

	it('returns indexed passages for a vault question', async () => {
		const text = 'Rent is due on Friday at the bank';
		const chunk: StoredChunk = {
			path: 'Home.md',
			title: 'Home',
			heading: 'Money',
			text,
			vector: hashEmbed(text),
		};
		const passages = await passagesForQuestion(
			{
				files: {},
				chunks: [chunk],
				embeddings: 'local',
				embeddingModel: '',
				omitted: {},
				ready: true,
			},
			[],
			() => true,
			'When is rent due?',
			async (question) => hashEmbed(question),
		);
		expect(passages).toContain('Home.md');
		expect(passages).toContain('Rent is due');
		const { surface } = memory({});
		surface.search = async () => passages;
		const asked = await runVaultJob(surface, {
			id: 'ask000001',
			name: 'vault.ask',
			arguments: { question: 'When is rent due?' },
		});
		expect(asked).toEqual({ ok: true, result: passages });
	});
});

describe('polling', () => {
	it('does nothing while the bridge is off', async () => {
		const calls: HttpRequest[] = [];
		await pollCallBridge(recording(calls), normalizeSettings({}), unusedSurface());
		expect(calls).toEqual([]);
	});

	it('posts the vault result for the job it was given', async () => {
		const calls: HttpRequest[] = [];
		const settings = normalizeSettings({
			callBridge: true,
			callBridgeUrl: 'http://10.0.0.8:8444',
			callBridgeToken: 'token',
		});
		const http = recording(calls, (request) => {
			if (request.method === 'GET') {
				return {
					status: 200,
					body: JSON.stringify({
						job: { id: 'abc12345', name: 'vault.tasks', arguments: {} },
					}),
				};
			}
			return { status: 200, body: '{"ok":true}' };
		});
		const { surface } = memory({ 'Home.md': '- [ ] Pay rent 📅 2026-10-23\n' });
		await pollCallBridge(http, settings, surface);
		expect(calls[0]?.url).toBe('http://10.0.0.8:8444/bridge/jobs');
		expect(calls[0]?.headers.Authorization).toBe('Bearer token');
		expect(calls[1]?.url).toBe('http://10.0.0.8:8444/bridge/jobs/abc12345');
		const posted = calls[1]?.body;
		expect(typeof posted === 'string' ? posted : '').toContain('Pay rent');
	});

	it('does not start a second poll while one is running', async () => {
		let started = 0;
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const http: HttpClient = async () => {
			started += 1;
			await gate;
			return { status: 200, body: '{"job":null}' };
		};
		const settings = normalizeSettings({
			callBridge: true,
			callBridgeUrl: 'http://127.0.0.1:8444',
			callBridgeToken: 'token',
		});
		const poll = createBridgePoller(
			http,
			() => settings,
			() => unusedSurface(),
		);
		const first = poll();
		const second = poll();
		await Promise.resolve();
		expect(started).toBe(1);
		release();
		await first;
		await second;
	});

	it('opens a preview only after the board accepts it', async () => {
		let opened = false;
		const settings = normalizeSettings({
			callBridge: true,
			callBridgeUrl: 'http://127.0.0.1:8444',
			callBridgeToken: 'token',
		});
		const http = recording([], (request) => {
			if (request.method === 'GET') {
				return {
					status: 200,
					body: JSON.stringify({
						job: {
							id: 'preview99',
							name: 'vault.preview',
							arguments: { path: 'Home.md', proposed: 'Hello there' },
						},
						preview: false,
					}),
				};
			}
			return { status: 404, body: '{"error":"gone"}' };
		});
		const { surface } = memory({ 'Home.md': 'Hello' });
		surface.showPreview = () => {
			opened = true;
		};
		let released = false;
		await pollCallBridge(http, settings, surface, {
			onPreview: () => {
				released = true;
			},
		});
		expect(opened).toBe(false);
		expect(released).toBe(true);
	});

	it('closes the preview after a spoken apply is written', async () => {
		let closed = false;
		const settings = normalizeSettings({
			callBridge: true,
			callBridgeUrl: 'http://127.0.0.1:8444',
			callBridgeToken: 'token',
		});
		const http = recording([], (request) => {
			if (request.method === 'GET') {
				return {
					status: 200,
					body: JSON.stringify({
						job: {
							id: 'apply0001',
							name: 'vault.apply',
							arguments: {
								path: 'Home.md',
								original: 'Hello',
								proposed: 'Hello there',
							},
						},
						preview: true,
					}),
				};
			}
			return { status: 200, body: '{}' };
		});
		const { surface } = memory({ 'Home.md': 'Hello' });
		await pollCallBridge(http, settings, surface, {
			onPreview: (open) => {
				if (!open) closed = true;
			},
		});
		expect(closed).toBe(true);
	});

	it('stays quiet when the board is down', async () => {
		const http: HttpClient = async () => {
			throw new Error('down');
		};
		const settings = normalizeSettings({
			callBridge: true,
			callBridgeUrl: 'http://127.0.0.1:8444',
			callBridgeToken: 'token',
		});
		const poll = createBridgePoller(
			http,
			() => settings,
			() => unusedSurface(),
		);
		await poll();
		await poll();
	});
});

function memory(notes: Record<string, string>): { surface: VaultSurface; writes: string[] } {
	const writes: string[] = [];
	const surface: VaultSurface = {
		notes: async () =>
			Object.entries(notes).map(([path, text]) => ({ path, title: path, text })),
		read: async (path) => (path in notes ? notes[path] ?? null : null),
		write: async (path, text, expected) => {
			if (expected !== undefined && notes[path] !== expected) {
				throw new Error('This note changed while the preview was open. Discard it and try again.');
			}
			writes.push(path);
			notes[path] = text;
		},
		search: async () => 'passages',
	};
	return { surface, writes };
}

function unusedSurface(): VaultSurface {
	return memory({}).surface;
}

function recording(
	calls: HttpRequest[],
	respond: (request: HttpRequest) => { status: number; body: string } = () => ({
		status: 200,
		body: '{"job":null}',
	}),
): HttpClient {
	return async (request) => {
		calls.push(request);
		return respond(request);
	};
}
