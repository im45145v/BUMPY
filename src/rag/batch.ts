import { ProviderError } from '../providers/types';

export async function embedInBatches(
	texts: readonly string[],
	embed: (batch: readonly string[]) => Promise<number[][]>,
	batchSize = 16,
): Promise<number[][]> {
	const vectors: number[][] = [];
	for (let offset = 0; offset < texts.length; offset += batchSize) {
		const batch = texts.slice(offset, offset + batchSize);
		const result = await embed(batch);
		if (result.length !== batch.length) {
			throw new ProviderError(
				'The model provider returned a response Bumpy could not read.',
			);
		}
		vectors.push(...result);
	}
	return vectors;
}
