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
	type CleanupTarget,
} from './cleanup';
import { cancelled } from '../providers/abort';
import {
	ProviderError,
	type CompletionRequest,
} from '../providers/types';
import { assessProposal } from './validate-proposal';

export type CleanupMode = CleanupTarget | 'auto';

export type CleanupSession =
	| { status: 'blocked'; message: string }
	| { status: 'cancelled' }
	| {
			status: 'preview';
			target: CleanupTarget;
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
	mode: CleanupTarget,
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
			messages: buildCleanupMessages(original, instructions, mode),
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
	const target = cleanupTarget(editor, mode);
	if (!target) {
		return {
			status: 'blocked',
			message:
				mode === 'selection' ? 'Select some text to clean up.' : 'This note is empty.',
		};
	}
	const range = target === 'selection' ? selectionRange(editor) : documentRange(editor);
	if (!range) return { status: 'blocked', message: 'Select some text to clean up.' };

	const original = editor.getRange(range.from, range.to);
	const proposal = await proposeCleanup(original, target, model, complete, options);
	if (proposal.status !== 'ready') return proposal;

	return {
		status: 'preview',
		target,
		original: proposal.original,
		proposed: proposal.proposed,
		warnings: proposal.warnings,
		apply: () =>
			applyReviewedRange(editor, range, proposal.original, proposal.proposed),
	};
}

function cleanupTarget(editor: CleanupEditor, mode: CleanupMode): CleanupTarget | null {
	if (mode === 'selection') return selectionRange(editor) ? 'selection' : null;
	if (mode === 'auto') {
		if (selectionRange(editor)) return 'selection';
		if (editor.getValue().trim() === '') return null;
		return 'note';
	}
	return 'note';
}

