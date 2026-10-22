import { describe, expect, it } from 'vitest';
import {
	applyReviewedLinks,
	findBacklinks,
	parseFolders,
	relatedNotes,
	suggestLinkEdits,
	type NoteRecord,
} from '../src/linking/suggest';
import { LINK_COMMANDS } from '../src/commands/link-specs';

const current: NoteRecord = {
	path: 'Plans/Today.md',
	title: 'Today',
	text: [
		'See the Project Roadmap before Friday.',
		'The roadmap is already linked as [[Project Roadmap]].',
		'',
		'```',
		'Project Roadmap',
		'```',
		'',
		'Also read Weekly Review.',
	].join('\n'),
};

const notes: NoteRecord[] = [
	current,
	{
		path: 'Plans/Project Roadmap.md',
		title: 'Project Roadmap',
		text: 'Milestones for the launch plan and budget.',
	},
	{
		path: 'Plans/Roadmap.md',
		title: 'Roadmap',
		text: 'A shorter roadmap note.',
	},
	{
		path: 'Reviews/Weekly Review.md',
		title: 'Weekly Review',
		text: 'Review the launch plan and budget with the team.',
	},
	{
		path: '.trash/Old.md',
		title: 'Old Launch',
		text: 'See Today in the trash.',
	},
	{
		path: 'Notes/Back.md',
		title: 'Back',
		text: 'Mentioned in [[Today]] yesterday.',
	},
];

describe('suggest links', () => {
	it('registers link commands', () => {
		expect(LINK_COMMANDS.map((command) => command.id)).toEqual([
			'suggest-links',
			'show-related-notes',
		]);
	});

	it('links plain mentions and leaves existing links and code alone', () => {
		const edits = suggestLinkEdits(current, notes, parseFolders('.trash'));
		const replacements = edits.map((edit) => edit.replacement);
		expect(replacements).toContain('[[Project Roadmap]]');
		expect(replacements).toContain('[[Weekly Review]]');
		expect(replacements).toContain('[[Roadmap|roadmap]]');
		const linked = applyReviewedLinks(current.text, current.text, edits);
		expect(linked.ok).toBe(true);
		if (!linked.ok) return;
		expect(linked.next).toContain('See the [[Project Roadmap]] before Friday.');
		expect(linked.next).toContain('[[Project Roadmap]].');
		expect(linked.next.match(/\[\[Project Roadmap\]\]/g)?.length).toBe(2);
		expect(linked.next).toContain('```\nProject Roadmap\n```');
		expect(linked.next).toContain('[[Roadmap|roadmap]]');
		expect(linked.next).not.toContain('[[Old Launch]]');
	});

	it('preserves a different casing with an alias', () => {
		const source: NoteRecord = {
			path: 'A.md',
			title: 'A note',
			text: 'Read the weekly review today.',
		};
		const edits = suggestLinkEdits(source, notes, []);
		expect(edits.map((edit) => edit.replacement)).toContain(
			'[[Weekly Review|weekly review]]',
		);
	});

	it('refuses to write after the note changes', () => {
		const edits = suggestLinkEdits(current, notes, []);
		const decision = applyReviewedLinks('changed', current.text, edits);
		expect(decision.ok).toBe(false);
	});

	it('finds related notes and backlinks', () => {
		const related = relatedNotes(current, notes, ['.trash']);
		expect(related.map((note) => note.title)).toContain('Weekly Review');
		expect(related.map((note) => note.path)).not.toContain('.trash/Old.md');
		expect(findBacklinks(current, notes)).toEqual([
			{ path: 'Notes/Back.md', title: 'Back' },
		]);
	});
});
