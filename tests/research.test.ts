import { describe, expect, it } from 'vitest';
import {
	buildInterpretationMessages,
	buildResearchNote,
	researchPath,
	stripUnknownUrls,
} from '../src/research/note';
import { searchWeb } from '../src/research/search';
import { ProviderError, type HttpRequest } from '../src/providers/types';

describe('research notes', () => {
	it('keeps provider URLs and removes URLs the model invented', () => {
		const hits = [
			{
				title: 'Tomato guide',
				url: 'https://example.com/tomatoes',
				snippet: 'Water tomatoes in the morning.',
			},
		];
		const note = buildResearchNote({
			topic: 'Tomato water',
			date: '2026-10-22',
			hits,
			interpretation: 'See also https://invented.example/secret and https://example.com/tomatoes.',
			related: [{ title: 'Garden', path: 'Garden.md' }],
		});
		expect(note).toContain('https://example.com/tomatoes');
		expect(note).not.toContain('https://invented.example/secret');
		expect(note).toContain('[link removed]');
		expect(note).toContain('[[Garden]]');
		expect(note).toContain('AI-generated');
		expect(researchPath('Tomato water')).toBe('Research/tomato-water.md');
		const messages = buildInterpretationMessages('Tomato water', hits);
		expect(messages[0]?.content).toContain('untrusted data');
		expect(messages[1]?.content).toContain('Water tomatoes in the morning.');
		expect(stripUnknownUrls('https://example.com/tomatoes', [])).toBe('[link removed]');
	});
});

describe('web search', () => {
	it('reads Searxng results and does not call an invalid URL', async () => {
		let captured: HttpRequest | undefined;
		const hits = await searchWeb(
			async (request) => {
				captured = request;
				return {
					status: 200,
					body: JSON.stringify({
						results: [
							{ title: 'Guide', url: 'https://example.com/a', content: 'A snippet' },
							{ title: 'Missing', url: 'not-a-url' },
						],
					}),
				};
			},
			'searxng',
			'http://127.0.0.1:8080',
			'',
			'tomatoes',
		);
		expect(hits).toEqual([
			{ title: 'Guide', url: 'https://example.com/a', snippet: 'A snippet' },
		]);
		expect(captured?.url).toContain('format=json');
		expect(captured?.url).toContain('q=tomatoes');
		await expect(searchWeb(async () => ({ status: 200, body: '{}' }), 'searxng', 'notaurl', '', 'q')).rejects.toBeInstanceOf(
			ProviderError,
		);
	});

	it('sends the Brave key as a header and hides it from errors', async () => {
		let captured: HttpRequest | undefined;
		await searchWeb(
			async (request) => {
				captured = request;
				return {
					status: 200,
					body: JSON.stringify({
						web: { results: [{ title: 'Guide', url: 'https://example.com/a', description: 'A' }] },
					}),
				};
			},
			'brave',
			'',
			'brave-secret-key',
			'tomatoes',
		);
		expect(captured?.headers['X-Subscription-Token']).toBe('brave-secret-key');
		expect(captured?.url).not.toContain('brave-secret-key');
		const failed = await searchWeb(
			async () => ({
				status: 401,
				body: JSON.stringify({ message: 'bad brave-secret-key' }),
			}),
			'brave',
			'',
			'brave-secret-key',
			'tomatoes',
		).catch((error: unknown) => error);
		expect((failed as Error).message).not.toContain('brave-secret-key');
	});
});
