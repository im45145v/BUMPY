import { isExcluded } from '../linking/suggest';

export interface Chunk {
	path: string;
	title: string;
	heading: string;
	text: string;
}

export interface StoredChunk extends Chunk {
	vector: number[];
}

export interface VectorIndex {
	files: Record<string, string>;
	chunks: StoredChunk[];
	embeddings: 'local' | 'provider';
	embeddingModel: string;
}

export const MAX_CHUNKS = 2_000;
export const MAX_CHUNK_CHARS = 800;

export function emptyIndex(): VectorIndex {
	return { files: {}, chunks: [], embeddings: 'local', embeddingModel: '' };
}

export function fileHash(text: string): string {
	let hash = 2166136261;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0).toString(16);
}

export function indexDisabled(text: string): boolean {
	const matter = frontmatterInner(text);
	if (matter === null) return false;
	return /^\s*bumpy-index:\s*false\s*$/m.test(matter);
}

export function chunkNote(path: string, title: string, text: string): Chunk[] {
	if (indexDisabled(text)) return [];
	const body = noteBody(text);
	const parts = body.split(/^(?=#{1,6} )/m);
	const chunks: Chunk[] = [];
	for (const part of parts) {
		const heading = /^#{1,6} (.+)$/m.exec(part)?.[1]?.trim() ?? title;
		const prose = part.trim();
		if (prose === '') continue;
		for (let offset = 0; offset < prose.length; offset += MAX_CHUNK_CHARS) {
			const slice = prose.slice(offset, offset + MAX_CHUNK_CHARS).trim();
			if (slice) chunks.push({ path, title, heading, text: slice });
		}
	}
	return chunks;
}

export function planReindex(
	existing: VectorIndex,
	files: readonly { path: string; title: string; text: string; eligible: boolean }[],
	mode: { embeddings: 'local' | 'provider'; model: string },
): { kept: StoredChunk[]; embed: Chunk[]; hashes: Record<string, string> } {
	const hashes: Record<string, string> = {};
	const kept: StoredChunk[] = [];
	const embed: Chunk[] = [];
	const sameMode =
		existing.embeddings === mode.embeddings &&
		(mode.embeddings === 'local' || existing.embeddingModel === mode.model);
	for (const file of files) {
		if (!file.eligible || indexDisabled(file.text)) continue;
		const hash = fileHash(file.text);
		hashes[file.path] = hash;
		if (sameMode && existing.files[file.path] === hash) {
			kept.push(...existing.chunks.filter((chunk) => chunk.path === file.path));
			continue;
		}
		embed.push(...chunkNote(file.path, file.title, file.text));
	}
	return { kept, embed, hashes };
}

export function assembleIndex(
	kept: readonly StoredChunk[],
	embedded: readonly StoredChunk[],
	hashes: Record<string, string>,
	mode: { embeddings: 'local' | 'provider'; model: string },
): { index: VectorIndex; truncated: boolean } {
	const all = [...kept, ...embedded];
	const groups = new Map<string, StoredChunk[]>();
	for (const chunk of all) {
		const group = groups.get(chunk.path);
		if (group) group.push(chunk);
		else groups.set(chunk.path, [chunk]);
	}
	const chunks: StoredChunk[] = [];
	const files: Record<string, string> = {};
	for (const [path, group] of groups) {
		if (chunks.length + group.length > MAX_CHUNKS) continue;
		chunks.push(...group);
		const hash = hashes[path];
		if (typeof hash === 'string') files[path] = hash;
	}
	return {
		index: {
			files,
			chunks,
			embeddings: mode.embeddings,
			embeddingModel: mode.embeddings === 'provider' ? mode.model : '',
		},
		truncated: chunks.length < all.length,
	};
}

export function hashEmbed(text: string, dimensions = 64): number[] {
	const vector = Array.from({ length: dimensions }, () => 0);
	for (const token of text.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
		if (token.length < 3) continue;
		const hash = fileHash(token);
		const index = Number.parseInt(hash.slice(0, 6), 16) % dimensions;
		const sign = Number.parseInt(hash.slice(-1), 16) % 2 === 0 ? 1 : -1;
		const current = vector[index] ?? 0;
		vector[index] = current + sign;
	}
	return normalize(vector);
}

export function cosine(left: readonly number[], right: readonly number[]): number {
	const length = Math.min(left.length, right.length);
	let dot = 0;
	let leftNorm = 0;
	let rightNorm = 0;
	for (let i = 0; i < length; i++) {
		const a = left[i] ?? 0;
		const b = right[i] ?? 0;
		dot += a * b;
		leftNorm += a * a;
		rightNorm += b * b;
	}
	if (leftNorm === 0 || rightNorm === 0) return 0;
	return dot / Math.sqrt(leftNorm * rightNorm);
}

/** Drop passages the user excluded or that no longer exist, even if an older index still holds them. */
export function retrievableChunks(
	chunks: readonly StoredChunk[],
	excluded: readonly string[],
	exists: (path: string) => boolean,
): StoredChunk[] {
	return chunks.filter(
		(chunk) => !isExcluded(chunk.path, excluded) && exists(chunk.path),
	);
}

export function searchChunks(
	chunks: readonly StoredChunk[],
	query: readonly number[],
	limit = 5,
): Array<StoredChunk & { score: number }> {
	return chunks
		.map((chunk) => ({ ...chunk, score: cosine(chunk.vector, query) }))
		.filter((chunk) => chunk.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit);
}

export function readIndex(value: unknown): VectorIndex {
	if (!value || typeof value !== 'object') return emptyIndex();
	const record = value as {
		files?: unknown;
		chunks?: unknown;
		embeddings?: unknown;
		embeddingModel?: unknown;
	};
	const files: Record<string, string> = {};
	if (record.files && typeof record.files === 'object') {
		for (const [path, hash] of Object.entries(record.files)) {
			if (typeof hash === 'string') files[path] = hash;
		}
	}
	const chunks: StoredChunk[] = [];
	if (Array.isArray(record.chunks)) {
		for (const chunk of record.chunks) {
			if (!chunk || typeof chunk !== 'object') continue;
			const item = chunk as Partial<StoredChunk>;
			if (
				typeof item.path !== 'string' ||
				typeof item.title !== 'string' ||
				typeof item.heading !== 'string' ||
				typeof item.text !== 'string' ||
				!Array.isArray(item.vector)
			) {
				continue;
			}
			chunks.push({
				path: item.path,
				title: item.title,
				heading: item.heading,
				text: item.text,
				vector: item.vector.filter((entry) => typeof entry === 'number'),
			});
		}
	}
	const embeddings = record.embeddings === 'provider' ? 'provider' : 'local';
	const embeddingModel =
		typeof record.embeddingModel === 'string' ? record.embeddingModel : '';
	return { files, chunks, embeddings, embeddingModel };
}

function normalize(vector: number[]): number[] {
	const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
	if (norm === 0) return vector;
	return vector.map((value) => value / norm);
}

/** YAML between opening fences. A leading horizontal rule is not frontmatter. */
function frontmatterInner(text: string): string | null {
	if (!text.startsWith('---\n')) return null;
	const end = text.indexOf('\n---', 4);
	if (end < 0) return null;
	const inner = text.slice(4, end);
	let keyed = false;
	for (const line of inner.split('\n')) {
		const trimmed = line.trim();
		if (trimmed === '' || trimmed.startsWith('#')) continue;
		if (/^[A-Za-z_][A-Za-z0-9_-]*\s*:/.test(line)) {
			keyed = true;
			continue;
		}
		if (/^\s+\S/.test(line) || /^\s*-\s+/.test(line)) continue;
		return null;
	}
	return keyed ? inner : null;
}

function noteBody(text: string): string {
	const inner = frontmatterInner(text);
	if (inner === null) return text;
	const end = text.indexOf('\n---', 4);
	return text.slice(end + 4).replace(/^\n/, '');
}
