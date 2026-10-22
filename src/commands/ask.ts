import { Notice, type Plugin } from 'obsidian';
import { readInstructionFile } from '../instructions/obsidian';
import { loadInstructions } from '../instructions/policy';
import { insertReviewedText } from '../notes/insert';
import type { CleanupEditor } from '../notes/editor-apply';
import { cancelled } from '../providers/abort';
import { createProvider } from '../providers/create-provider';
import { obsidianHttp } from '../providers/obsidian-http';
import { ProviderError } from '../providers/types';
import { answerWithSources, buildAskMessages } from '../rag/ask';
import { embedInBatches } from '../rag/batch';
import {
	assembleIndex,
	hashEmbed,
	planReindex,
	searchChunks,
	type StoredChunk,
} from '../rag/index';
import { embedWithProvider } from '../rag/provider-embed';
import { loadStoredIndex, saveStoredIndex } from '../rag/store';
import { parseFolders } from '../linking/suggest';
import { AnswerModal } from '../ui/answer-modal';
import { pendingNotice } from '../ui/pending';
import { QuestionModal } from '../ui/question-modal';
import { readMarkdownNotes } from '../vault/notes';
import type { DataHost } from './knowledge';
import { KNOWLEDGE_COMMANDS } from './knowledge-specs';

export function registerAskCommands(
	plugin: DataHost & Pick<Plugin, 'addCommand'>,
): void {
	plugin.addCommand({
		id: KNOWLEDGE_COMMANDS[0].id,
		name: KNOWLEDGE_COMMANDS[0].name,
		callback: () => {
			void updateIndex(plugin);
		},
	});
	plugin.addCommand({
		id: KNOWLEDGE_COMMANDS[1].id,
		name: KNOWLEDGE_COMMANDS[1].name,
		callback: () => {
			new QuestionModal(plugin.app, {
				title: 'Ask the vault',
				note: 'The answer is built from indexed passages. Nothing is written until you insert it.',
				confirm: 'Ask',
				onSubmit: (question) => {
					void askVault(plugin, question);
				},
			}).open();
		},
	});
}

async function updateIndex(plugin: DataHost): Promise<void> {
	const controller = plugin.requests.start();
	const pending = pendingNotice('Updating the index…', controller);
	try {
		const notes = await readMarkdownNotes(
			plugin.app,
			parseFolders(plugin.settings.excludedFolders),
		);
		const existing = await loadStoredIndex(() => plugin.loadData());
		const mode = {
			embeddings: plugin.settings.embeddings,
			model: plugin.settings.embeddingModel.trim(),
		};
		const plan = planReindex(
			existing,
			notes.map((note) => ({ ...note, eligible: true })),
			mode,
		);
		const vectors = await embedPassages(plugin, plan.embed.map((chunk) => chunk.text), controller.signal);
		if (controller.signal.aborted) return;
		const embedded: StoredChunk[] = plan.embed.map((chunk, index) => ({
			...chunk,
			vector: vectors[index] ?? [],
		}));
		const assembled = assembleIndex(plan.kept, embedded, plan.hashes, mode);
		await saveStoredIndex(
			() => plugin.loadData(),
			(data) => plugin.saveData(data),
			assembled.index,
		);
		const count = Object.keys(assembled.index.files).length;
		new Notice(
			assembled.truncated
				? `Indexed ${count} notes. Some passages were left out of the index.`
				: `Indexed ${count} notes.`,
		);
	} catch (error) {
		if (!cancelled(error, controller.signal)) {
			new Notice(
				error instanceof ProviderError ? error.message : 'Could not update the index.',
			);
		}
	} finally {
		pending.release();
		plugin.requests.finish(controller);
	}
}

async function askVault(plugin: DataHost, question: string): Promise<void> {
	const controller = plugin.requests.start();
	const pending = pendingNotice('Asking the vault…', controller);
	try {
		const index = await loadStoredIndex(() => plugin.loadData());
		if (index.chunks.length === 0 || index.embeddings !== plugin.settings.embeddings) {
			new Notice('Update the vault index first.');
			return;
		}
		const [query] = await embedPassages(plugin, [question], controller.signal);
		if (!query || controller.signal.aborted) return;
		const matches = searchChunks(index.chunks, query, 5);
		if (matches.length === 0) {
			new Notice('Nothing in the index matches that question.');
			return;
		}
		const instructions = await loadInstructions(
			plugin.app.workspace.getActiveFile()?.path ?? '',
			(path) => readInstructionFile(plugin.app, path),
		);
		let answer = 'No model is set, so this is only the retrieved passages.';
		if (plugin.settings.model.trim() !== '') {
			try {
				answer = await createProvider(plugin.settings).complete({
					model: plugin.settings.model,
					temperature: 0,
					messages: buildAskMessages(question, matches, instructions.text),
					signal: controller.signal,
					redact: [question, ...matches.map((match) => match.text)],
				});
			} catch (error) {
				if (cancelled(error, controller.signal)) return;
				answer =
					error instanceof ProviderError
						? error.message
						: 'The model request failed.';
			}
		}
		if (controller.signal.aborted) return;
		const text = answerWithSources(answer, matches);
		const editor = plugin.app.workspace.activeEditor?.editor;
		const cursor = editor?.getCursor('from');
		const snapshot = editor?.getValue() ?? '';
		new AnswerModal(
			plugin.app,
			text,
			matches,
			editor && cursor
				? () => insertAnswer(editor, cursor, snapshot, text)
				: null,
		).open();
	} catch (error) {
		if (!cancelled(error, controller.signal)) {
			new Notice(
				error instanceof ProviderError ? error.message : 'Could not ask the vault.',
			);
		}
	} finally {
		pending.release();
		plugin.requests.finish(controller);
	}
}

async function embedPassages(
	plugin: DataHost,
	texts: readonly string[],
	signal: AbortSignal,
): Promise<number[][]> {
	if (texts.length === 0) return [];
	if (plugin.settings.embeddings === 'local') return texts.map((text) => hashEmbed(text));
	return embedInBatches(texts, (batch) =>
		embedWithProvider(
			obsidianHttp,
			plugin.settings.baseUrl,
			plugin.settings.apiKey,
			plugin.settings.embeddingModel,
			batch,
			signal,
		),
	);
}

function insertAnswer(
	editor: CleanupEditor,
	cursor: { line: number; ch: number },
	snapshot: string,
	text: string,
): boolean {
	const decision = insertReviewedText(editor, cursor, snapshot, text);
	if (!decision.ok) {
		new Notice(decision.reason);
		return false;
	}
	return true;
}
