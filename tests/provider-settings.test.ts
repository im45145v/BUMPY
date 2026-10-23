import { describe, expect, it } from 'vitest';
import { checkProvider, formatProviderCheck } from '../src/providers/models';
import {
	applyPresetSelection,
	defaultEmbeddingModel,
	inferPreset,
	presetModelList,
	withCurrentModel,
} from '../src/providers/presets';
import { chatCompletionsUrl } from '../src/providers/openai-compatible';
import type { HttpRequest } from '../src/providers/types';
import { normalizeSettings } from '../src/settings';

describe('provider settings', () => {
	it('fills a known local URL when older settings have no preset', () => {
		expect(
			normalizeSettings({
				baseUrl: 'http://127.0.0.1:11434/v1',
				model: 'llama3.2',
				apiKey: '',
			}).preset,
		).toBe('ollama');
		expect(inferPreset('https://api.openai.com/v1/')).toBe('openai');
		expect(inferPreset('https://generativelanguage.googleapis.com/v1beta/openai')).toBe(
			'gemini',
		);
		expect(inferPreset('https://app.backboard.io/api')).toBe('backboard');
		expect(inferPreset('https://api.anthropic.com/v1')).toBe('anthropic');
		expect(inferPreset('https://api.groq.com/openai/v1')).toBe('groq');
		expect(inferPreset('https://openrouter.ai/api/v1')).toBe('openrouter');
		expect(inferPreset('https://api.mistral.ai/v1')).toBe('mistral');
		expect(inferPreset('https://api.deepseek.com/v1')).toBe('deepseek');
		expect(inferPreset('https://api.x.ai/v1')).toBe('xai');
		expect(inferPreset('http://127.0.0.1:9999/v1')).toBe('custom');
		expect(
			chatCompletionsUrl('https://generativelanguage.googleapis.com/v1beta/openai'),
		).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
	});

	it('fills the Gemini and Backboard URLs and starting models', () => {
		const settings = normalizeSettings({});
		applyPresetSelection(settings, 'gemini');
		expect(settings.baseUrl).toBe(
			'https://generativelanguage.googleapis.com/v1beta/openai',
		);
		expect(settings.model).toBe('gemini-3.8-flash');
		applyPresetSelection(settings, 'backboard');
		expect(settings.baseUrl).toBe('https://app.backboard.io/api');
		expect(settings.model).toBe('gpt-4o');
		applyPresetSelection(settings, 'groq');
		expect(settings.baseUrl).toBe('https://api.groq.com/openai/v1');
		expect(settings.model).toBe('llama-3.3-70b-versatile');
		applyPresetSelection(settings, 'anthropic');
		expect(settings.baseUrl).toBe('https://api.anthropic.com/v1');
		expect(settings.model).toBe('claude-sonnet-4-5');
		applyPresetSelection(settings, 'mistral');
		expect(settings.baseUrl).toBe('https://api.mistral.ai/v1');
		expect(settings.model).toBe('mistral-medium-latest');
		expect(presetModelList('mistral')).toContain('mistral-small-latest');
		expect(withCurrentModel(presetModelList('mistral'), 'custom-model')[0]).toBe(
			'custom-model',
		);
		expect(defaultEmbeddingModel('mistral')).toBe('mistral-embed');
		settings.model = 'llama3.2';
		applyPresetSelection(settings, 'ollama');
		expect(settings.baseUrl).toBe('http://127.0.0.1:11434/v1');
		expect(settings.model).toBe('llama3.2');
	});

	it('keeps a saved preset and does not invent an API key', () => {
		const settings = normalizeSettings({
			preset: 'custom',
			baseUrl: 'http://127.0.0.1:11434/v1',
			model: 'local',
		});
		expect(settings.preset).toBe('custom');
		expect(settings.apiKey).toBe('');
	});
});

describe('checkProvider', () => {
	it('lists models and sends the key only in the header', async () => {
		let captured: HttpRequest | undefined;
		const result = await checkProvider(
			async (request) => {
				captured = request;
				return {
					status: 200,
					body: JSON.stringify({ data: [{ id: 'llama3.2' }, { id: ' ' }, {}] }),
				};
			},
			'http://127.0.0.1:11434/v1',
			'sk-test-secret',
		);
		expect(result).toEqual({ ok: true, models: ['llama3.2'] });
		expect(captured?.method).toBe('GET');
		expect(captured?.url).toBe('http://127.0.0.1:11434/v1/models');
		expect(captured?.headers.Authorization).toBe('Bearer sk-test-secret');
		expect(captured?.url).not.toContain('sk-test-secret');
		expect(captured?.body).toBeUndefined();
	});

	it('hides a key echoed by the provider', async () => {
		const result = await checkProvider(
			async () => ({
				status: 401,
				body: JSON.stringify({ error: { message: 'bad key sk-test-secret' } }),
			}),
			'https://api.openai.com/v1',
			'sk-test-secret',
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.message).toBe('The model request failed (401).');
			expect(result.message).not.toContain('sk-test-secret');
		}
	});

	it('summarizes a model list without the API key', () => {
		const models = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];
		expect(formatProviderCheck({ ok: true, models })).toBe(
			'Connected. Models: a, b, c, d, e, f, g, h, and 1 more.',
		);
		expect(formatProviderCheck({ ok: true, models: [] })).toMatch(/did not list/);
	});

	it('reports an invalid URL without calling the network', async () => {
		let calls = 0;
		const result = await checkProvider(
			async () => {
				calls += 1;
				return { status: 200, body: '{}' };
			},
			'not a url',
			'',
		);
		expect(result).toEqual({ ok: false, message: 'The provider URL is not valid.' });
		expect(calls).toBe(0);
	});
});
