import { TFile, type App } from 'obsidian';
import { isExcluded, parseFolders } from '../linking/suggest';
import { obsidianHttp } from '../providers/obsidian-http';
import { usesBackboard } from '../providers/presets';
import { embedWithProvider } from '../rag/provider-embed';
import { embeddingIndexModel, resolveFeature } from '../providers/features';
import { indexUnavailableReason } from '../rag/index';
import { loadStoredIndex, pluginIndexFile } from '../rag/store';
import { readTaskNotes } from '../vault/notes';
import type { BumpySettings } from '../settings';
import type { VaultSurface } from './jobs';
import { openCallPreview } from './preview';
import { localQueryVector, passagesForQuestion } from './search';

export interface BridgePlugin {
	app: App;
	settings: BumpySettings;
	loadData(): Promise<unknown>;
	manifest: { dir?: string };
}

export function obsidianVaultSurface(plugin: BridgePlugin): VaultSurface {
	const excluded = () => parseFolders(plugin.settings.excludedFolders);
	const read = async (path: string) => {
		if (isExcluded(path, excluded())) return null;
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) return null;
		return plugin.app.vault.read(file);
	};
	const write = async (path: string, text: string, expected?: string) => {
		if (isExcluded(path, excluded())) throw new Error('That note is not available.');
		const file = plugin.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error('That note is not available.');
		let stale = false;
		await plugin.app.vault.process(file, (data) => {
			if (expected !== undefined && data !== expected) {
				stale = true;
				return data;
			}
			return text;
		});
		if (stale) {
			throw new Error('This note changed while the preview was open. Discard it and try again.');
		}
	};
	return {
		notes: async () => (await readTaskNotes(plugin.app, excluded())).notes,
		read,
		write,
		search: (question) => searchVault(plugin, question),
		showPreview: (preview) => {
			openCallPreview(plugin, preview, write, read);
		},
	};
}

async function searchVault(plugin: BridgePlugin, question: string): Promise<string> {
	const index = await loadStoredIndex(pluginIndexFile(plugin), () => plugin.loadData());
	const excluded = parseFolders(plugin.settings.excludedFolders);
	const endpoint = resolveFeature(plugin.settings, 'embeddings');
	const model =
		plugin.settings.embeddings === 'provider'
			? embeddingIndexModel(plugin.settings.embeddingModel, endpoint)
			: '';
	const unavailable = indexUnavailableReason(index, {
		embeddings: plugin.settings.embeddings,
		model,
	});
	if (unavailable) throw new Error(unavailable);
	return passagesForQuestion(
		index,
		excluded,
		(path) => plugin.app.vault.getAbstractFileByPath(path) instanceof TFile,
		question,
		(text) => embedQuery(plugin, text),
	);
}

async function embedQuery(plugin: BridgePlugin, question: string): Promise<number[]> {
	if (plugin.settings.embeddings === 'local') return localQueryVector(question);
	const endpoint = resolveFeature(plugin.settings, 'embeddings');
	if (usesBackboard(endpoint.preset, endpoint.baseUrl)) {
		throw new Error(
			'Backboard does not embed vault notes. Choose another embeddings provider, or keep embeddings on local hashing.',
		);
	}
	const vectors = await embedWithProvider(
		obsidianHttp,
		endpoint.baseUrl,
		endpoint.apiKey,
		plugin.settings.embeddingModel,
		[question],
	);
	const vector = vectors[0];
	if (!vector) throw new Error('Could not embed the question.');
	return vector;
}
