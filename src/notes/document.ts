import type { ApplyDecision } from './apply';
import { documentRange, type CleanupEditor } from './editor-apply';

export function writeIfUnchanged(
	editor: CleanupEditor,
	snapshot: string,
	next: string,
	emptyReason: string,
): ApplyDecision {
	if (next.trim() === '') return { ok: false, reason: emptyReason };
	if (editor.getValue() !== snapshot) {
		return {
			ok: false,
			reason:
				'This note changed while the preview was open. Discard it and try again.',
		};
	}
	if (next === snapshot) {
		return { ok: false, reason: 'The proposal matches the current text.' };
	}
	const end = documentRange(editor).to;
	editor.replaceRange(next, { line: 0, ch: 0 }, end);
	return { ok: true, next };
}
