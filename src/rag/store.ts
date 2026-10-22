import { emptyIndex, readIndex, type VectorIndex } from './index';

export async function loadStoredIndex(
	loadData: () => Promise<unknown>,
): Promise<VectorIndex> {
	const stored = await loadData();
	if (!stored || typeof stored !== 'object') return emptyIndex();
	return readIndex((stored as { ragIndex?: unknown }).ragIndex);
}

export async function saveStoredIndex(
	loadData: () => Promise<unknown>,
	saveData: (data: unknown) => Promise<void>,
	index: VectorIndex,
): Promise<void> {
	const stored = ((await loadData()) ?? {}) as Record<string, unknown>;
	await saveData({ ...stored, ragIndex: index });
}
