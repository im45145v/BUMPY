import { decideReplacement, type ApplyDecision } from './apply';

export interface EditorPosition {
	line: number;
	ch: number;
}

/** Structural view of the Obsidian editor methods cleanup uses. */
export interface CleanupEditor {
	somethingSelected(): boolean;
	getCursor(side?: 'from' | 'to'): EditorPosition;
	lastLine(): number;
	getLine(line: number): string;
	getRange(from: EditorPosition, to: EditorPosition): string;
	replaceRange(
		replacement: string,
		from: EditorPosition,
		to?: EditorPosition,
	): void;
	getValue(): string;
}

export interface EditorRange {
	from: EditorPosition;
	to: EditorPosition;
}

export function canCleanSelection(editor: CleanupEditor): boolean {
	return editor.somethingSelected();
}

export function canCleanNote(editor: CleanupEditor): boolean {
	return editor.getValue().trim() !== '';
}

export function selectionRange(editor: CleanupEditor): EditorRange | null {
	if (!editor.somethingSelected()) return null;
	return {
		from: editor.getCursor('from'),
		to: editor.getCursor('to'),
	};
}

export function documentRange(editor: CleanupEditor): EditorRange {
	const last = editor.lastLine();
	return {
		from: { line: 0, ch: 0 },
		to: { line: last, ch: editor.getLine(last).length },
	};
}

export function applyReviewedRange(
	editor: CleanupEditor,
	range: EditorRange,
	original: string,
	proposed: string,
): ApplyDecision {
	const decision = decideReplacement(
		editor.getRange(range.from, range.to),
		original,
		proposed,
	);
	if (decision.ok) {
		editor.replaceRange(decision.next, range.from, range.to);
	}
	return decision;
}
