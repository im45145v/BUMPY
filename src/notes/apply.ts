export type ApplyDecision =
	| { ok: true; next: string }
	| { ok: false; reason: string };

export function decideReplacement(
	current: string,
	original: string,
	proposed: string,
): ApplyDecision {
	if (proposed.trim() === '') {
		return { ok: false, reason: 'The proposal is empty.' };
	}
	if (current !== original) {
		return {
			ok: false,
			reason:
				'This text changed while the preview was open. Discard the preview and run the cleanup again.',
		};
	}
	if (current === proposed) {
		return { ok: false, reason: 'The proposal matches the current text.' };
	}
	return { ok: true, next: proposed };
}
