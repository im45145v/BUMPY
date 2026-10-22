import { describe, expect, it } from 'vitest';
import {
	OpenAICompatibleProvider,
	chatCompletionsUrl,
} from '../src/providers/openai-compatible';
import { ProviderError, type HttpClient, type HttpRequest } from '../src/providers/types';

function provider(
	http: HttpClient,
	apiKey = '',
	baseUrl = 'http://127.0.0.1:11434/v1',
): OpenAICompatibleProvider {
	return new OpenAICompatibleProvider(http, baseUrl, apiKey);
}

describe('chatCompletionsUrl', () => {
	it('appends the chat completions path once', () => {
		expect(chatCompletionsUrl('http://127.0.0.1:11434/v1/')).toBe(
			'http://127.0.0.1:11434/v1/chat/completions',
		);
		expect(
			chatCompletionsUrl('http://127.0.0.1:11434/v1/chat/completions'),
		).toBe('http://127.0.0.1:11434/v1/chat/completions');
	});

	it('rejects non-http URLs', () => {
		expect(() => chatCompletionsUrl('javascript:alert(1)')).toThrow(ProviderError);
		expect(() => chatCompletionsUrl('not a url')).toThrow(/not valid/);
	});
});

describe('OpenAICompatibleProvider', () => {
	it('returns message text and omits the API key when none is set', async () => {
		let captured: HttpRequest | undefined;
		const result = await provider(async (request) => {
			captured = request;
			return {
				status: 200,
				body: JSON.stringify({
					choices: [{ message: { content: 'Clean note' } }],
				}),
			};
		}).complete({
			model: 'llama3.2',
			temperature: 0.2,
			messages: [
				{ role: 'system', content: 'rules' },
				{ role: 'user', content: 'secret note' },
			],
		});

		expect(result).toBe('Clean note');
		expect(captured?.headers.Authorization).toBeUndefined();
		expect(captured?.body).toContain('secret note');
		expect(captured?.body).not.toContain('sk-');
	});

	it('sends a bearer token only in the header', async () => {
		let captured: HttpRequest | undefined;
		await provider(async (request) => {
			captured = request;
			return {
				status: 200,
				body: JSON.stringify({
					choices: [{ message: { content: [{ type: 'text', text: 'Ok' }] } }],
				}),
			};
		}, 'sk-test-secret').complete({
			model: 'gpt-4.1',
			temperature: 0.2,
			messages: [{ role: 'user', content: 'note' }],
		});

		expect(captured?.headers.Authorization).toBe('Bearer sk-test-secret');
		expect(captured?.body).not.toContain('sk-test-secret');
	});

	it('hides an API key that a server echoes back', async () => {
		const client = provider(async () => {
			return {
				status: 401,
				body: JSON.stringify({
					error: { message: 'bad key sk-test-secret' },
				}),
			};
		}, 'sk-test-secret');

		await expect(
			client.complete({
				model: 'm',
				temperature: 0,
				messages: [{ role: 'user', content: 'note' }],
			}),
		).rejects.toThrow('The model request failed (401).');
	});

	it('reports the provider status without dumping the note', async () => {
		const client = provider(async () => {
			return {
				status: 500,
				body: JSON.stringify({ error: { message: 'overloaded' } }),
			};
		});

		await expect(
			client.complete({
				model: 'm',
				temperature: 0,
				messages: [{ role: 'user', content: 'private note' }],
			}),
		).rejects.toThrow('The model request failed (500). overloaded');
	});

	it('rejects malformed and empty payloads without echoing the note', async () => {
		const note = 'Private meeting notes about the launch.';
		const messages = [
			{
				role: 'user' as const,
				content: `Revise the note content below.\n\n<untrusted_note>\n${note}\n</untrusted_note>`,
			},
		];

		const malformed = await provider(async () => ({
			status: 200,
			body: `not-json ${note}`,
		}))
			.complete({ model: 'm', temperature: 0, messages })
			.catch((error: unknown) => error);
		expect(malformed).toBeInstanceOf(ProviderError);
		expect((malformed as ProviderError).message).toBe(
			'The model provider returned a response Bumpy could not read.',
		);
		expect((malformed as ProviderError).message).not.toContain(note);

		const empty = await provider(async () => ({
			status: 200,
			body: JSON.stringify({ choices: [{ message: {} }] }),
		}))
			.complete({ model: 'm', temperature: 0, messages })
			.catch((error: unknown) => error);
		expect((empty as ProviderError).message).toBe(
			'The model returned an empty response.',
		);

		const echoed = await provider(async () => ({
			status: 400,
			body: JSON.stringify({ error: { message: note } }),
		}))
			.complete({ model: 'm', temperature: 0, messages })
			.catch((error: unknown) => error);
		expect((echoed as ProviderError).message).toBe(
			'The model request failed (400).',
		);
		expect((echoed as ProviderError).message).not.toContain(note);
	});

	it('does not echo a non-json error body', async () => {
		const note = 'Private meeting notes about the launch.';
		const error = await provider(async () => ({
			status: 502,
			body: note,
		}))
			.complete({
				model: 'm',
				temperature: 0,
				messages: [{ role: 'user', content: note }],
			})
			.catch((caught: unknown) => caught);
		expect((error as ProviderError).message).toBe(
			'The model request failed (502).',
		);
		expect((error as ProviderError).message).not.toContain('Private meeting');
	});

	it('truncates a long provider error', async () => {
		const error = await provider(async () => ({
			status: 500,
			body: JSON.stringify({ error: { message: 'x'.repeat(500) } }),
		}))
			.complete({
				model: 'm',
				temperature: 0,
				messages: [{ role: 'user', content: 'short' }],
			})
			.catch((caught: unknown) => caught);
		const message = (error as ProviderError).message;
		expect(message.startsWith('The model request failed (500). ')).toBe(true);
		expect(message.length).toBeLessThanOrEqual(
			'The model request failed (500). '.length + 180,
		);
	});

	it('accepts https and rejects other protocols', () => {
		expect(chatCompletionsUrl('https://api.example.com/v1')).toBe(
			'https://api.example.com/v1/chat/completions',
		);
		expect(() => chatCompletionsUrl('file:///tmp/secret')).toThrow(
			/http:\/\/ or https:\/\//,
		);
	});

	it('uses a fixed message when the connection fails', async () => {
		const client = provider(async () => {
			throw new Error('connect ECONNREFUSED 127.0.0.1');
		});
		await expect(
			client.complete({
				model: 'm',
				temperature: 0,
				messages: [{ role: 'user', content: 'note' }],
			}),
		).rejects.toThrow('Could not reach the model provider.');
	});
});
