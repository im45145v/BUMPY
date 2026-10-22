import { describe, expect, it } from 'vitest';
import { assessProposal } from '../src/notes/validate-proposal';

const NOTE = [
	'---',
	'title: Plan',
	'---',
	'# Plan',
	'',
	'See [[Roadmap]] and [docs](https://example.com).',
	'',
	'![[diagram.png]]',
	'',
	'```ts',
	'const n = 1;',
	'```',
	'',
	'- [x] Shipped the draft',
	'- [ ] Review the draft',
].join('\n');

describe('assessProposal', () => {
	it('stays quiet when the proposal keeps the structure', () => {
		const proposed = NOTE.replace('See ', 'Read ');
		expect(assessProposal(NOTE, proposed)).toEqual([]);
		expect(assessProposal(NOTE, NOTE)).toEqual([]);
		expect(assessProposal(NOTE, '   ')).toEqual([]);
	});

	it('warns when links, frontmatter, code, or tasks disappear', () => {
		const proposed = '# Plan\n\nA short replacement.';
		const warnings = assessProposal(NOTE, proposed);
		expect(warnings.some((warning) => warning.includes('Frontmatter'))).toBe(true);
		expect(warnings.some((warning) => warning.includes('[[Roadmap]]') || warning.includes('Roadmap'))).toBe(true);
		expect(warnings.some((warning) => warning.includes('https://example.com'))).toBe(true);
		expect(warnings.some((warning) => warning.includes('diagram.png'))).toBe(true);
		expect(warnings.some((warning) => warning.includes('code'))).toBe(true);
		expect(warnings.some((warning) => warning.includes('Tasks'))).toBe(true);
		expect(warnings.some((warning) => warning.includes('completed'))).toBe(true);
	});

	it('warns about a large deletion and an unfinished fence', () => {
		const original = 'word '.repeat(40);
		expect(assessProposal(original, 'word')).toContain(
			'This removes about half or more of the text.',
		);
		expect(assessProposal('Hello.', '```\nstill open')).toContain(
			'A code fence looks unfinished.',
		);
	});
});
