import { Notice, type Plugin } from 'obsidian';
import { readInstructionFile } from '../instructions/obsidian';
import { loadInstructions } from '../instructions/policy';
import { parseFolders, relatedNotes } from '../linking/suggest';
import { cancelled } from '../providers/abort';
import { createProvider } from '../providers/create-provider';
import { obsidianHttp } from '../providers/obsidian-http';
import { ProviderError } from '../providers/types';
import { localIsoDate } from '../insights/report';
import {
	buildInterpretationMessages,
	buildResearchNote,
	researchPath,
} from '../research/note';
import { searchWeb } from '../research/search';
import { pendingNotice } from '../ui/pending';
import { QuestionModal } from '../ui/question-modal';
import { readMarkdownNotes } from '../vault/notes';
import { previewNewNote } from './create-preview';
import type { DataHost } from './knowledge';
import { KNOWLEDGE_COMMANDS } from './knowledge-specs';

export function registerResearchCommands(
	plugin: DataHost & Pick<Plugin, 'addCommand'>,
): void {
	plugin.addCommand({
		id: KNOWLEDGE_COMMANDS[2].id,
		name: KNOWLEDGE_COMMANDS[2].name,
		callback: () => {
			new QuestionModal(plugin.app, {
				title: 'Research a topic',
				note: 'Sources come from the search provider. Nothing is written until you create the note.',
				confirm: 'Search',
				onSubmit: (topic) => {
					void researchTopic(plugin, topic);
				},
			}).open();
		},
	});
}

export async function researchTopic(plugin: DataHost, topic: string): Promise<void> {
	if (plugin.settings.searchProvider === 'off') {
		new Notice('Turn on web search in settings before researching.');
		return;
	}
	const controller = plugin.requests.start();
	const pending = pendingNotice('Researching…', controller);
	try {
		const hits = await searchWeb(
			obsidianHttp,
			plugin.settings.searchProvider,
			plugin.settings.searchUrl,
			plugin.settings.searchApiKey,
			topic,
			controller.signal,
		);
		if (controller.signal.aborted) return;
		const instructions = await loadInstructions(
			plugin.app.workspace.getActiveFile()?.path ?? '',
			(path) => readInstructionFile(plugin.app, path),
		);
		const interpretation = await interpret(
			plugin,
			topic,
			hits,
			instructions.text,
			controller.signal,
		);
		if (controller.signal.aborted) return;
		const notes = await readMarkdownNotes(
			plugin.app,
			parseFolders(plugin.settings.excludedFolders),
		);
		const path = researchPath(topic);
		const related = relatedNotes(
			{
				path,
				title: topic,
				text: [topic, ...hits.map((hit) => hit.snippet)].join('\n'),
			},
			notes,
			parseFolders(plugin.settings.excludedFolders),
		);
		const text = buildResearchNote({
			topic,
			date: localIsoDate(new Date()),
			hits,
			interpretation: interpretation.text,
			related,
		});
		pending.release();
		previewNewNote(plugin.app, {
			title: 'Review research',
			path,
			text,
			warnings: interpretation.warnings,
		});
	} catch (error) {
		if (!cancelled(error, controller.signal)) {
			new Notice(
				error instanceof ProviderError ? error.message : 'Could not research that topic.',
			);
		}
	} finally {
		pending.release();
		plugin.requests.finish(controller);
	}
}

async function interpret(
	plugin: DataHost,
	topic: string,
	hits: readonly { title: string; url: string; snippet: string }[],
	instructions: string,
	signal: AbortSignal,
): Promise<{ text: string | null; warnings: string[] }> {
	if (plugin.settings.model.trim() === '') {
		return {
			text: null,
			warnings: ['Set a model in settings to add an interpretation.'],
		};
	}
	if (hits.length === 0) return { text: null, warnings: [] };
	try {
		const text = await createProvider(plugin.settings).complete({
			model: plugin.settings.model,
			temperature: 0,
			messages: buildInterpretationMessages(topic, hits, instructions),
			signal,
			redact: hits.map((hit) => hit.snippet),
		});
		return { text, warnings: [] };
	} catch (error) {
		if (cancelled(error, signal)) throw error;
		return {
			text: null,
			warnings: [
				error instanceof ProviderError
					? error.message
					: 'The interpretation request failed.',
			],
		};
	}
}
