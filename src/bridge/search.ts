import {
	hashEmbed,
	retrievableChunks,
	searchChunks,
	type VectorIndex,
} from '../rag/index';

export async function passagesForQuestion(
	index: VectorIndex,
	excluded: readonly string[],
	exists: (path: string) => boolean,
	question: string,
	embedQuery: (question: string) => Promise<number[]>,
): Promise<string> {
	const chunks = retrievableChunks(index.chunks, excluded, exists);
	if (chunks.length === 0) {
		throw new Error(
			index.chunks.length === 0
				? 'The index has no passages yet.'
				: 'The indexed notes are excluded or no longer in the vault. Update the vault index.',
		);
	}
	const query = await embedQuery(question);
	return formatPassages(searchChunks(chunks, query, 5));
}

export function formatPassages(
	matches: readonly { title: string; path: string; heading: string; text: string }[],
): string {
	if (matches.length === 0) return 'The vault does not have a matching passage.';
	return matches
		.map(
			(match) =>
				`${match.title} (${match.path}), ${match.heading}: ${match.text.slice(0, 500)}`,
		)
		.join('\n\n')
		.slice(0, 4000);
}

export function localQueryVector(question: string): number[] {
	return hashEmbed(question);
}
