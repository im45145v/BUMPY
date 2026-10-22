import { describe, expect, it } from 'vitest';
import { ProviderError, type CompletionRequest } from '../src/providers/types';
import { executeCleanup } from '../src/notes/cleanup-session';
import {
	canCleanNote,
	canCleanSelection,
	type CleanupEditor,
	type EditorPosition,
} from '../src/notes/editor-apply';
import { CLEANUP_COMMANDS } from '../src/commands/specs';
import { MAX_CLEANUP_CHARS } from '../src/notes/cleanup';

const NOTE = [
	'# Heading',
	'',
	'See [docs](https://example.com) and [[WikiLink]].',
	'',
	'| A | B |',
	'| --- | --- |',
	'| 1 | 2 |',
	'',
	'```ts',
	'const x = 1;',
	'```',
	'',
	'![[attachment.png]]',
].join('\n');

const CLEANED = NOTE.replace('See ', 'Read ');

class FakeEditor implements CleanupEditor {
	lines: string[];
	replacements = 0;
	private readonly anchor: EditorPosition | null;
	private readonly head: EditorPosition | null;

	constructor(
		text: string,
		selection?: { from: EditorPosition; to: EditorPosition },
	) {
		this.lines = text.split('\n');
		this.anchor = selection?.from ?? null;
		this.head = selection?.to ?? null;
	}

	getValue(): string {
		return this.lines.join('\n');
	}

	somethingSelected(): boolean {
		if (!this.anchor || !this.head) return false;
		return this.getRange(this.anchor, this.head).length > 0;
	}

	getCursor(side?: 'from' | 'to'): EditorPosition {
		const from = this.anchor ?? { line: 0, ch: 0 };
		const to = this.head ?? from;
		return side === 'to' ? to : from;
	}

	lastLine(): number {
		return this.lines.length - 1;
	}

	getLine(line: number): string {
		return this.lines[line] ?? '';
	}

	getRange(from: EditorPosition, to: EditorPosition): string {
		const value = this.getValue();
		return value.slice(offset(this.lines, from), offset(this.lines, to));
	}

	replaceRange(
		replacement: string,
		from: EditorPosition,
		to?: EditorPosition,
	): void {
		const end = to ?? from;
		const value = this.getValue();
		const next =
			value.slice(0, offset(this.lines, from)) +
			replacement +
			value.slice(offset(this.lines, end));
		this.lines = next.split('\n');
		this.replacements += 1;
	}
}

function offset(lines: string[], pos: EditorPosition): number {
	let cursor = 0;
	for (let line = 0; line < pos.line; line++) {
		cursor += (lines[line] ?? '').length + 1;
	}
	return cursor + pos.ch;
}

function selectionOf(text: string, line: number): {
	from: EditorPosition;
	to: EditorPosition;
} {
	return {
		from: { line, ch: 0 },
		to: { line, ch: text.split('\n')[line]?.length ?? 0 },
	};
}

function responding(body: string) {
	const requests: CompletionRequest[] = [];
	const complete = async (request: CompletionRequest) => {
		requests.push(request);
		return body;
	};
	return { complete, requests };
}

describe('cleanup commands', () => {
	it('registers selection and whole-note cleanup', () => {
		expect(CLEANUP_COMMANDS.map((command) => command.id)).toEqual([
			'cleanup-selection',
			'cleanup-note',
		]);
		expect(CLEANUP_COMMANDS.map((command) => command.mode)).toEqual([
			'selection',
			'note',
		]);
	});
});

describe('executeCleanup', () => {
	it('cleans a selection without sending or rewriting the rest of the note', async () => {
		const line = 2;
		const editor = new FakeEditor(NOTE, selectionOf(NOTE, line));
		expect(canCleanSelection(editor)).toBe(true);
		const originalLine = editor.getLine(line);
		const proposedLine = originalLine.replace('See ', 'Read ');
		const provider = responding('```markdown\n' + proposedLine + '\n```');

		const session = await executeCleanup(
			editor,
			'selection',
			'llama3.2',
			provider.complete,
		);

		expect(session.status).toBe('preview');
		if (session.status !== 'preview') return;
		expect(provider.requests[0]?.messages[1]?.content).toContain(originalLine);
		expect(provider.requests[0]?.messages[1]?.content).not.toContain('# Heading');
		expect(provider.requests[0]?.messages[1]?.content).not.toContain('| A | B |');
		expect(JSON.stringify(provider.requests[0])).not.toContain('sk-');

		expect(editor.replacements).toBe(0);
		expect(editor.getValue()).toBe(NOTE);

		expect(session.apply()).toEqual({ ok: true, next: proposedLine });
		expect(editor.replacements).toBe(1);
		expect(editor.getLine(line)).toBe(proposedLine);
		expect(editor.getLine(line)).toContain('[[WikiLink]]');
		expect(editor.getLine(line)).toContain('[docs](https://example.com)');
		expect(editor.getValue()).toContain('# Heading');
		expect(editor.getValue()).toContain('| A | B |');
		expect(editor.getValue()).toContain('```ts');
		expect(editor.getValue()).toContain('![[attachment.png]]');
		expect(session.apply().ok).toBe(false);
		expect(editor.replacements).toBe(1);
	});

	it('cleans a whole note and keeps markdown structures', async () => {
		const editor = new FakeEditor(NOTE);
		expect(canCleanNote(editor)).toBe(true);
		const provider = responding('```md\n' + CLEANED + '\n```');
		const session = await executeCleanup(
			editor,
			'note',
			'llama3.2',
			provider.complete,
		);

		expect(session.status).toBe('preview');
		if (session.status !== 'preview') return;
		expect(provider.requests[0]?.messages[1]?.content).toContain('# Heading');
		expect(provider.requests[0]?.messages[1]?.content).toContain('```ts');
		expect(session.proposed).toBe(CLEANED);
		expect(session.apply().ok).toBe(true);
		expect(editor.getValue()).toBe(CLEANED);
		expect(editor.getValue()).toContain('# Heading');
		expect(editor.getValue()).toContain('[[WikiLink]]');
		expect(editor.getValue()).toContain('[docs](https://example.com)');
		expect(editor.getValue()).toContain('| --- | --- |');
		expect(editor.getValue()).toContain('```ts\nconst x = 1;\n```');
		expect(editor.getValue()).toContain('![[attachment.png]]');
	});

	it('leaves the note unchanged when the preview is discarded', async () => {
		const editor = new FakeEditor(NOTE);
		const provider = responding(CLEANED);
		const session = await executeCleanup(
			editor,
			'note',
			'llama3.2',
			provider.complete,
		);
		expect(session.status).toBe('preview');
		expect(editor.getValue()).toBe(NOTE);
		expect(editor.replacements).toBe(0);
	});

	it('refuses to overwrite a selection that changed after the preview opened', async () => {
		const line = 2;
		const editor = new FakeEditor(NOTE, selectionOf(NOTE, line));
		const provider = responding('Read [docs](https://example.com) and [[WikiLink]].');
		const session = await executeCleanup(
			editor,
			'selection',
			'llama3.2',
			provider.complete,
		);
		editor.lines[line] = 'typed while waiting';
		expect(session.status).toBe('preview');
		if (session.status !== 'preview') return;
		const decision = session.apply();
		expect(decision.ok).toBe(false);
		expect(editor.getLine(line)).toBe('typed while waiting');
		expect(editor.replacements).toBe(0);
		expect(editor.getLine(0)).toBe('# Heading');
	});

	it('still applies a selection when only text outside that range changed', async () => {
		const line = 2;
		const editor = new FakeEditor(NOTE, selectionOf(NOTE, line));
		const proposed = 'Read [docs](https://example.com) and [[WikiLink]].';
		const session = await executeCleanup(
			editor,
			'selection',
			'llama3.2',
			responding(proposed).complete,
		);
		editor.lines[0] = '# Renamed while waiting';
		expect(session.status).toBe('preview');
		if (session.status !== 'preview') return;
		expect(session.apply().ok).toBe(true);
		expect(editor.getLine(0)).toBe('# Renamed while waiting');
		expect(editor.getLine(line)).toBe(proposed);
		expect(editor.getValue()).toContain('| A | B |');
	});

	it('does not call the provider for empty or oversized input', async () => {
		let calls = 0;
		const complete = async () => {
			calls += 1;
			return 'nope';
		};

		const emptySelection = await executeCleanup(
			new FakeEditor(NOTE),
			'selection',
			'llama3.2',
			complete,
		);
		expect(emptySelection).toMatchObject({
			status: 'blocked',
			message: 'Select some text to clean up.',
		});

		const emptyNote = await executeCleanup(
			new FakeEditor('  \n'),
			'note',
			'llama3.2',
			complete,
		);
		expect(emptyNote.status).toBe('blocked');
		if (emptyNote.status === 'blocked') {
			expect(emptyNote.message).toMatch(/empty/);
		}
		expect(canCleanNote(new FakeEditor('  \n'))).toBe(false);

		const tooLong = await executeCleanup(
			new FakeEditor('a'.repeat(MAX_CLEANUP_CHARS + 1)),
			'note',
			'llama3.2',
			complete,
		);
		expect(tooLong.status).toBe('blocked');
		if (tooLong.status === 'blocked') expect(tooLong.message).toMatch(/too long/);

		const noModel = await executeCleanup(
			new FakeEditor(NOTE),
			'note',
			'  ',
			complete,
		);
		expect(noModel.status).toBe('blocked');
		if (noModel.status === 'blocked') expect(noModel.message).toMatch(/model/);
		expect(calls).toBe(0);
	});

	it('keeps the note when the provider fails', async () => {
		const editor = new FakeEditor(NOTE);
		const failed = await executeCleanup(editor, 'note', 'llama3.2', async () => {
			throw new ProviderError('The model request failed (401).');
		});
		expect(failed).toEqual({
			status: 'blocked',
			message: 'The model request failed (401).',
		});
		expect(editor.getValue()).toBe(NOTE);

		const unknown = await executeCleanup(editor, 'note', 'llama3.2', async () => {
			throw new Error('socket hang up');
		});
		expect(unknown).toEqual({ status: 'blocked', message: 'Cleanup failed.' });
		expect(editor.replacements).toBe(0);
	});

	it('does not apply an empty unwrapped proposal', async () => {
		const editor = new FakeEditor('Messy paragraph.');
		const session = await executeCleanup(
			editor,
			'note',
			'llama3.2',
			async () => '```markdown\n\n```',
		);
		expect(session.status).toBe('preview');
		if (session.status !== 'preview') return;
		expect(session.proposed).toBe('');
		expect(session.apply().ok).toBe(false);
		expect(editor.getValue()).toBe('Messy paragraph.');
	});
});
