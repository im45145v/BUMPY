import { describe, expect, it } from 'vitest';
import { decideReplacement } from '../src/notes/apply';

describe('decideReplacement', () => {
	it('accepts a proposal when the text is unchanged', () => {
		const decision = decideReplacement('messy note', 'messy note', 'Clean note');
		expect(decision).toEqual({ ok: true, next: 'Clean note' });
	});

	it('refuses to write when the text changed after the preview opened', () => {
		const decision = decideReplacement('edited', 'messy note', 'Clean note');
		expect(decision.ok).toBe(false);
		if (!decision.ok) expect(decision.reason).toMatch(/changed/);
	});

	it('refuses an empty proposal', () => {
		const decision = decideReplacement('messy note', 'messy note', '  \n');
		expect(decision).toEqual({
			ok: false,
			reason: 'The proposal is empty.',
		});
	});

	it('refuses a proposal that matches the current text', () => {
		const decision = decideReplacement('same', 'same', 'same');
		expect(decision.ok).toBe(false);
	});
});
