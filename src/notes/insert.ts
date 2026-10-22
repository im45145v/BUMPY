import type { ApplyDecision } from './apply';
import type { CleanupEditor, EditorPosition } from './editor-apply';

export function decideInsertion(
	current: string,
	snapshot: string,
	text: string,
): ApplyDecision {
	if (text.trim() === '') {
		return { ok: false, reason: 'The transcript is empty.' };
	}
	if (current !== snapshot) {
		return {
			ok: false,
			reason:
				'This note changed while the transcript was open. Discard it and try again.',
		};
	}
	return { ok: true, next: text };
}

export function insertReviewedText(
	editor: CleanupEditor,
	cursor: EditorPosition,
	snapshot: string,
	text: string,
): ApplyDecision {
	const decision = decideInsertion(editor.getValue(), snapshot, text);
	if (decision.ok) editor.replaceRange(decision.next, cursor);
	return decision;
}
