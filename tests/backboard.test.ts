import { describe, expect, it } from 'vitest';
import {
	BackboardProvider,
	backboardMessagesUrl,
	backboardProviderFor,
	checkBackboard,
} from '../src/providers/backboard';
import { ProviderError, type HttpRequest } from '../src/providers/types';

describe('Backboard provider', () => {
	it('sends the key as X-API-Key and does not store memory', async () => {
		let captured: HttpRequest | undefined;
		const text = await new BackboardProvider(
			async (request) => {
				captured = request;
				return { status: 200, body: JSON.stringify({ content: 'Clean note' }) };
			},
			'https://app.backboard.io/api',
			'bb-secret',
		).complete({
			model: 'gemini-3.8-flash',
			temperature: 0.2,
			messages: [
				{ role: 'system', content: 'Revise the note.' },
				{ role: 'user', content: 'private watering note' },
			],
		});
		expect(text).toBe('Clean note');
		expect(captured?.url).toBe('https://app.backboard.io/api/threads/messages');
		expect(captured?.headers['X-API-Key']).toBe('bb-secret');
		expect(captured?.headers.Authorization).toBeUndefined();
		expect(captured?.url).not.toContain('bb-secret');
		expect(typeof captured?.body).toBe('string');
		const body = JSON.parse(captured?.body as string) as {
			content: string;
			system_prompt: string;
			model_name: string;
			llm_provider: string;
			memory: string;
			web_search: string;
		};
		expect(body.content).toBe('private watering note');
		expect(body.system_prompt).toBe('Revise the note.');
		expect(body.model_name).toBe('gemini-3.8-flash');
		expect(body.llm_provider).toBe('google');
		expect(body.memory).toBe('off');
		expect(body.web_search).toBe('off');
		expect(backboardProviderFor('gpt-4o')).toBe('openai');
		expect(backboardProviderFor('claude-sonnet-4-5')).toBe('anthropic');
		expect(backboardMessagesUrl('https://app.backboard.io/api#')).toBe(
			'https://app.backboard.io/api/threads/messages',
		);
	});

	it('hides the key and the note from a provider error', async () => {
		const error = await new BackboardProvider(
			async () => ({
				status: 401,
				body: JSON.stringify({
					error: { message: 'bad key bb-secret for private watering note' },
				}),
			}),
			'https://app.backboard.io/api',
			'bb-secret',
		)
			.complete({
				model: 'gpt-4o',
				temperature: 0,
				messages: [{ role: 'user', content: 'private watering note' }],
			})
			.catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ProviderError);
		expect((error as Error).message).toBe('The model request failed (401).');
		expect((error as Error).message).not.toContain('bb-secret');
		expect((error as Error).message).not.toContain('watering');
	});

	it('lists model names from the Backboard catalog', async () => {
		let captured: HttpRequest | undefined;
		const result = await checkBackboard(
			async (request) => {
				captured = request;
				return {
					status: 200,
					body: JSON.stringify({
						models: [{ provider: 'openai', name: 'gpt-4o' }, { name: ' ' }],
					}),
				};
			},
			'https://app.backboard.io/api/',
			'bb-secret',
		);
		expect(result).toEqual({ ok: true, models: ['gpt-4o'] });
		expect(captured?.method).toBe('GET');
		expect(captured?.url).toContain('https://app.backboard.io/api/models');
		expect(captured?.url).toContain('model_type=llm');
		expect(captured?.headers['X-API-Key']).toBe('bb-secret');
		expect(captured?.url).not.toContain('bb-secret');
	});
});
