import type { ApplyDecision } from './apply';
import {
	applyReviewedRange,
	documentRange,
	selectionRange,
	type CleanupEditor,
} from './editor-apply';
import {
	CLEANUP_TEMPERATURE,
	buildCleanupMessages,
	cleanupInputError,
	modelSettingError,
	unwrapModelMarkdown,
} from './cleanup';
import { cancelled } from '../providers/abort';
import {
	ProviderError,
	type CompletionRequest,
} from '../providers/types';
import { assessProposal } from './validate-proposal';

export type CleanupMode = 'selection' | 'note';

export type CleanupSession =
	| { status: 'blocked'; message: string }
	| { status: 'cancelled' }
	| {
			status: 'preview';
			original: string;
			proposed: string;
			warnings: string[];
			apply: () => ApplyDecision;
	  };

export interface CleanupOptions {
	signal?: AbortSignal;
	instructions?: string;
}

export type CleanupProposal =
	| { status: 'blocked'; message: string }
	| { status: 'cancelled' }
	| {
			status: 'ready';
			original: string;
			proposed: string;
			warnings: string[];
	  };

/** Revises Markdown without writing it. Callers decide where an accepted proposal goes. */
export async function proposeCleanup(
	original: string,
	mode: CleanupMode,
	model: string,
	complete: (request: CompletionRequest) => Promise<string>,
	options?: CleanupOptions,
): Promise<CleanupProposal> {
	const signal = options?.signal;
	const instructions = options?.instructions ?? '';
	if (signal?.aborted) return { status: 'cancelled' };

	const inputError = cleanupInputError(original, mode);
	if (inputError) return { status: 'blocked', message: inputError };
	const modelError = modelSettingError(model);
	if (modelError) return { status: 'blocked', message: modelError };

	let raw: string;
	try {
		raw = await complete({
			model: model.trim(),
			temperature: CLEANUP_TEMPERATURE,
			messages: buildCleanupMessages(original, instructions),
			signal,
			redact: instructions.trim() ? [instructions, original] : [original],
		});
	} catch (error) {
		if (cancelled(error, signal)) return { status: 'cancelled' };
		const message =
			error instanceof ProviderError ? error.message : 'Cleanup failed.';
		return { status: 'blocked', message };
	}
	if (signal?.aborted) return { status: 'cancelled' };

	const proposed = unwrapModelMarkdown(original, raw);
	return {
		status: 'ready',
		original,
		proposed,
		warnings: assessProposal(original, proposed),
	};
}

export async function executeCleanup(
	editor: CleanupEditor,
	mode: CleanupMode,
	model: string,
	complete: (request: CompletionRequest) => Promise<string>,
	options?: CleanupOptions,
): Promise<CleanupSession> {
	const range = mode === 'selection' ? selectionRange(editor) : documentRange(editor);
	if (!range) return { status: 'blocked', message: 'Select some text to clean up.' };

	const original = editor.getRange(range.from, range.to);
	const proposal = await proposeCleanup(original, mode, model, complete, options);
	if (proposal.status !== 'ready') return proposal;

	return {
		status: 'preview',
		original: proposal.original,
		proposed: proposal.proposed,
		warnings: proposal.warnings,
		apply: () =>
			applyReviewedRange(editor, range, proposal.original, proposal.proposed),
	};
}

