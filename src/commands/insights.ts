import { Notice, type Plugin } from 'obsidian';
import {
	dailyBriefing,
	findGaps,
	journalDigest,
	localIsoDate,
	notesInPeriod,
	startOfLocalDay,
	suggestTasks,
	thoughtTimeline,
	type BriefingNote,
} from '../insights/report';
import { parseFolders, relatedNotes } from '../linking/suggest';
import type { CleanupEditor } from '../notes/editor-apply';
import { parseNaturalTask, tasksIn } from '../tasks/parse';
import { GapModal } from '../ui/gap-modal';
import { SuggestTasksModal } from '../ui/suggest-tasks-modal';
import { readTimedNotes } from '../vault/notes';
import { previewNewNote } from './create-preview';
import type { DataHost } from './knowledge';
import { researchTopic } from './research';
import { KNOWLEDGE_COMMANDS } from './knowledge-specs';

export function registerInsightCommands(
	plugin: DataHost & Pick<Plugin, 'addCommand'>,
): void {
	plugin.addCommand({
		id: KNOWLEDGE_COMMANDS[3].id,
		name: KNOWLEDGE_COMMANDS[3].name,
		callback: () => {
			void showBriefing(plugin);
		},
	});
	plugin.addCommand({
		id: KNOWLEDGE_COMMANDS[4].id,
		name: KNOWLEDGE_COMMANDS[4].name,
		callback: () => {
			void showJournal(plugin);
		},
	});
	plugin.addCommand({
		id: KNOWLEDGE_COMMANDS[5].id,
		name: KNOWLEDGE_COMMANDS[5].name,
		callback: () => {
			void showThoughts(plugin);
		},
	});
	plugin.addCommand({
		id: KNOWLEDGE_COMMANDS[6].id,
		name: KNOWLEDGE_COMMANDS[6].name,
		callback: () => {
			void showGaps(plugin);
		},
	});
	plugin.addCommand({
		id: KNOWLEDGE_COMMANDS[7].id,
		name: KNOWLEDGE_COMMANDS[7].name,
		editorCallback: (editor: CleanupEditor) => {
			openTaskSuggestions(plugin, editor);
		},
	});
}

async function showBriefing(plugin: DataHost): Promise<void> {
	const notes = await loadNotes(plugin);
	const today = new Date();
	const date = localIsoDate(today);
	const start = startOfLocalDay(today);
	const recent = notes.filter((note) => note.mtime >= start && note.mtime < start + 86_400_000);
	const tasks = notes.flatMap((note) =>
		tasksIn(note.text).map((task) => ({
			title: task.title,
			due: task.due,
			done: task.done,
			path: note.path,
		})),
	);
	previewNewNote(plugin.app, {
		title: 'Daily briefing',
		path: `Briefings/${date}.md`,
		text: dailyBriefing({ date, tasks, notes: recent }),
	});
}

async function showJournal(plugin: DataHost): Promise<void> {
	const notes = await loadNotes(plugin);
	const folder = journalFolder(plugin);
	const end = Date.now();
	const start = end - plugin.settings.journalDays * 86_400_000;
	const period = notesInPeriod(notes, folder, start, end);
	if (period.length === 0) {
		new Notice('No journal notes in that period.');
		return;
	}
	const date = localIsoDate(new Date());
	previewNewNote(plugin.app, {
		title: 'Journal summary',
		path: `${folder}/digest-${date}.md`,
		text: journalDigest(period, `last ${plugin.settings.journalDays} days`),
	});
}

async function showThoughts(plugin: DataHost): Promise<void> {
	const notes = await loadNotes(plugin);
	const active = plugin.app.workspace.getActiveFile();
	const current = active ? notes.find((note) => note.path === active.path) : undefined;
	const excluded = parseFolders(plugin.settings.excludedFolders);
	const picked = current
		? [
				current,
				...relatedNotes(current, notes, excluded)
					.map((related) => notes.find((note) => note.path === related.path))
					.filter((note): note is BriefingNote => note !== undefined),
			]
		: notesInPeriod(
				notes,
				journalFolder(plugin),
				Date.now() - plugin.settings.journalDays * 86_400_000,
				Date.now(),
			);
	if (picked.length === 0) {
		new Notice('No related notes to trace.');
		return;
	}
	previewNewNote(plugin.app, {
		title: 'Thought evolution',
		path: `Briefings/thoughts-${localIsoDate(new Date())}.md`,
		text: thoughtTimeline(picked),
	});
}

async function showGaps(plugin: DataHost): Promise<void> {
	const notes = await loadNotes(plugin);
	const active = plugin.app.workspace.getActiveFile();
	const current = active ? notes.find((note) => note.path === active.path) : undefined;
	const source = current
		? [current]
		: notesInPeriod(
				notes,
				journalFolder(plugin),
				0,
				Date.now(),
			);
	const gaps = findGaps(source);
	if (gaps.length === 0) {
		new Notice('No knowledge gaps stood out.');
		return;
	}
	new GapModal(plugin.app, gaps, (query) => {
		void researchTopic(plugin, query);
	}).open();
}

function openTaskSuggestions(plugin: DataHost, editor: CleanupEditor): void {
	const today = new Date();
	const suggestions = suggestTasks(editor.getValue()).flatMap((item) => {
		const parsed = parseNaturalTask(item.title, today);
		if (parsed.title === '') return [];
		return [
			{
				title: parsed.title,
				source: item.source,
				due: parsed.due,
				time: parsed.time,
				priority: parsed.priority,
			},
		];
	});
	if (suggestions.length === 0) {
		new Notice('No task suggestions in this note.');
		return;
	}
	new SuggestTasksModal(plugin.app, editor, editor.getValue(), suggestions).open();
}

async function loadNotes(plugin: DataHost): Promise<BriefingNote[]> {
	return readTimedNotes(plugin.app, parseFolders(plugin.settings.excludedFolders));
}

function journalFolder(plugin: DataHost): string {
	const folder = plugin.settings.journalFolder.trim().replace(/^\/+|\/+$/g, '');
	return folder === '' ? 'Journal' : folder;
}
