import { emptyIndex, readIndex, type VectorIndex } from './index';
import { updatePluginData } from '../vault/plugin-data';

export async function loadStoredIndex(
	loadData: () => Promise<unknown>,
): Promise<VectorIndex> {
	const stored = await loadData();
	if (!stored || typeof stored !== 'object') return emptyIndex();
	return readIndex((stored as { ragIndex?: unknown }).ragIndex);
}

export async function saveStoredIndex(
	host: { loadData(): Promise<unknown>; saveData(data: unknown): Promise<void> },
	index: VectorIndex,
): Promise<void> {
	await updatePluginData(host, (data) => {
		data.ragIndex = index;
	});
}
