import { describe, expect, it } from 'vitest';
import {
	buildDocumentDraft,
	buildDocumentMessages,
	collectPassages,
} from '../src/research/documents';
import { buildInterpretationMessages, buildResearchNote } from '../src/research/note';
import {
	formatRunCost,
	isUltramarineEndpoint,
	ultramarineCostUsd,
} from '../src/providers/ultramarine';

describe('Ultramarine cost', () => {
	it('bills cached input once, at the cached rate', () => {
		expect(
			ultramarineCostUsd({
				inputTokens: 20_000,
				cachedInputTokens: 0,
				outputTokens: 1_000,
			}),
		).toBeCloseTo(0.0035, 8);
		expect(
			formatRunCost({
				inputTokens: 20_000,
				cachedInputTokens: 20_000,
				outputTokens: 0,
			}),
		).toBe(
			'Ultramarine reported 20000 input tokens (20000 cached) and 0 output tokens. At $0.15 per million uncached input tokens, $0.03 per million cached input tokens, and $0.50 per million output tokens, this run cost $0.000600.',
		);
		expect(isUltramarineEndpoint('https://api.paperinstruments.com/v1/')).toBe(true);
		expect(isUltramarineEndpoint('https://api.openai.com/v1')).toBe(false);
	});

	it('records the cost on a research note and uses a separate prompt', () => {
		const cost = formatRunCost({
			inputTokens: 20_000,
			cachedInputTokens: 0,
			outputTokens: 1_000,
		});
		const note = buildResearchNote({
			topic: 'Tomatoes',
			date: '2026-10-23',
			hits: [{ title: 'Guide', url: 'https://example.com/a', snippet: 'Water them.' }],
			interpretation: 'Water tomatoes in the morning.',
			related: [],
			cost,
		});
		expect(note).toContain('## Run cost');
		expect(note).toContain('$0.003500');
		expect(note.indexOf('## Run cost')).toBeLessThan(note.indexOf('## Related notes'));
		const messages = buildInterpretationMessages(
			'Tomatoes',
			[{ title: 'Guide', url: 'https://example.com/a', snippet: 'Water them.' }],
			'',
			'ultramarine',
		);
		expect(messages[0]?.content).toContain('Leave out filler');
		expect(messages[0]?.content).not.toContain('Write a short interpretation');
	});
});

describe('document research', () => {
	it('skips instruction files and keeps a bounded pile', () => {
		const passages = collectPassages([
			{ path: 'BUMPY.md', text: 'Be brief.' },
			{ path: '.hidden/secret.md', text: 'secret' },
			{ path: 'notes/b.md', text: 'Second fact.' },
			{ path: 'notes/a.md', text: 'First fact.' },
			{ path: 'notes/empty.md', text: '   ' },
			{ path: 'notes/long.md', text: 'x'.repeat(7_000) },
		]);
		expect(passages.map((passage) => passage.path)).toEqual([
			'notes/a.md',
			'notes/b.md',
			'notes/long.md',
		]);
		expect(passages[2]?.text.endsWith('\n[truncated]')).toBe(true);
		expect(passages[2]?.text.length).toBeLessThan(7_000);
		const messages = buildDocumentMessages('Water', passages, 'Prefer short sentences.');
		expect(messages[0]?.content).toContain('untrusted data');
		expect(messages[0]?.content).toContain('Prefer short sentences.');
		expect(messages[1]?.content).toContain('notes/a.md');
		expect(messages[1]?.content).not.toContain('Be brief.');
		const draft = buildDocumentDraft({
			topic: 'Water',
			date: '2026-10-23',
			passages,
			interpretation: 'The notes mention water.',
			cost: formatRunCost({
				inputTokens: 1_000,
				cachedInputTokens: 0,
				outputTokens: 0,
			}),
		});
		expect(draft).toContain('This draft is a preview.');
		expect(draft).toContain('notes/a.md');
		expect(draft).toContain('$0.000150');
	});
});
