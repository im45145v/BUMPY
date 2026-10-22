import type { ApplyDecision } from './apply';
import {
	applyReviewedRange,
	documentRange,
	selectionRange,
	type CleanupEditor,
	type EditorRange,
} from './editor-apply';
import {
	CLEANUP_TEMPERATURE,
	buildCleanupMessages,
	cleanupInputError,
	modelSettingError,
	unwrapModelMarkdown,
} from './cleanup';
import {
	ProviderError,
	type CompletionRequest,
} from '../providers/types';

export type CleanupMode = 'selection' | 'note';

export type CleanupSession =
	| { status: 'blocked'; message: string }
	| {
			status: 'preview';
			original: string;
			proposed: string;
			apply: () => ApplyDecision;
	  };

export async function executeCleanup(
	editor: CleanupEditor,
	mode: CleanupMode,
	model: string,
	complete: (request: CompletionRequest) => Promise<string>,
): Promise<CleanupSession> {
	const prepared = prepareCleanup(editor, mode, model);
	if (!prepared.ok) return { status: 'blocked', message: prepared.message };

	let raw: string;
	try {
		raw = await complete({
			model: model.trim(),
			temperature: CLEANUP_TEMPERATURE,
			messages: prepared.messages,
		});
	} catch (error) {
		const message =
			error instanceof ProviderError ? error.message : 'Cleanup failed.';
		return { status: 'blocked', message };
	}

	const proposed = unwrapModelMarkdown(prepared.original, raw);
	return {
		status: 'preview',
		original: prepared.original,
		proposed,
		apply: () =>
			applyReviewedRange(editor, prepared.range, prepared.original, proposed),
	};
}

function prepareCleanup(
	editor: CleanupEditor,
	mode: CleanupMode,
	model: string,
):
	| { ok: false; message: string }
	| { ok: true; original: string; range: EditorRange; messages: ReturnType<typeof buildCleanupMessages> } {
	const range = mode === 'selection' ? selectionRange(editor) : documentRange(editor);
	if (!range) {
		return { ok: false, message: 'Select some text to clean up.' };
	}

	const original = editor.getRange(range.from, range.to);
	const inputError = cleanupInputError(original, mode);
	if (inputError) return { ok: false, message: inputError };

	const modelError = modelSettingError(model);
	if (modelError) return { ok: false, message: modelError };

	return {
		ok: true,
		original,
		range,
		messages: buildCleanupMessages(original),
	};
}
