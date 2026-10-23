import { describe, expect, it } from 'vitest';
import { updatePluginData } from '../src/vault/plugin-data';

describe('plugin data', () => {
	it('applies overlapping saves in order', async () => {
		let data: Record<string, unknown> = { keep: 1 };
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		let loads = 0;
		const host = {
			async loadData(): Promise<unknown> {
				loads += 1;
				if (loads === 1) await gate;
				return { ...data };
			},
			async saveData(next: unknown): Promise<void> {
				data = { ...(next as Record<string, unknown>) };
			},
		};
		const first = updatePluginData(host, (stored) => {
			stored.a = 1;
		});
		const second = updatePluginData(host, (stored) => {
			stored.b = 2;
		});
		release();
		await first;
		await second;
		expect(data).toEqual({ keep: 1, a: 1, b: 2 });
	});
});
