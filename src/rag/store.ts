import { emptyIndex, readIndex, type VectorIndex } from './index';
import { updatePluginData, type PluginDataHost } from '../vault/plugin-data';

export interface IndexFile {
	read(): Promise<string | null>;
	write(text: string): Promise<void>;
}

export interface IndexAdapter {
	exists(path: string): Promise<boolean>;
	read(path: string): Promise<string>;
	write(path: string, data: string): Promise<void>;
}

/** Passage vectors live beside the plugin so a settings change does not rewrite them. */
export function pluginIndexFile(
	plugin: {
		manifest: { dir?: string };
		app: { vault: { adapter: IndexAdapter } };
	},
): IndexFile | null {
	const dir = plugin.manifest.dir;
	if (!dir) return null;
	const path = `${dir}/rag-index.json`;
	const adapter = plugin.app.vault.adapter;
	return {
		async read() {
			try {
				if (!(await adapter.exists(path))) return null;
				return await adapter.read(path);
			} catch {
				return null;
			}
		},
		write(text) {
			return adapter.write(path, text);
		},
	};
}

export async function loadStoredIndex(
	file: IndexFile | null,
	legacy: () => Promise<unknown>,
): Promise<VectorIndex> {
	if (file) {
		const text = await file.read();
		if (text) {
			try {
				return readIndex(JSON.parse(text) as unknown);
			} catch {
				return emptyIndex();
			}
		}
	}
	const stored = await legacy();
	if (!stored || typeof stored !== 'object') return emptyIndex();
	return readIndex((stored as { ragIndex?: unknown }).ragIndex);
}

export async function saveStoredIndex(
	file: IndexFile | null,
	host: PluginDataHost,
	index: VectorIndex,
): Promise<void> {
	if (file) {
		await file.write(JSON.stringify(index));
		await updatePluginData(host, (data) => {
			delete data.ragIndex;
		});
		return;
	}
	await updatePluginData(host, (data) => {
		data.ragIndex = index;
	});
}

/** Moves an index out of plugin data the first time this device opens it. */
export async function settleIndexStorage(
	file: IndexFile | null,
	host: PluginDataHost,
): Promise<void> {
	if (!file) return;
	const stored = await host.loadData();
	const legacy =
		stored && typeof stored === 'object'
			? (stored as { ragIndex?: unknown }).ragIndex
			: undefined;
	if (legacy === undefined) return;
	const current = await file.read();
	if (!current) await file.write(JSON.stringify(legacy));
	await updatePluginData(host, (data) => {
		delete data.ragIndex;
	});
}
