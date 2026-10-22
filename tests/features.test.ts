import { describe, expect, it } from 'vitest';
import {
	applyFeaturePreset,
	embeddingIndexModel,
	resolveFeature,
} from '../src/providers/features';
import { usesBackboard } from '../src/providers/presets';
import { normalizeSettings } from '../src/settings';

describe('feature providers', () => {
	it('keeps older settings on the shared provider', () => {
		const settings = normalizeSettings({
			preset: 'ollama',
			baseUrl: 'http://127.0.0.1:11434/v1',
			model: 'llama3.2',
			apiKey: '',
		});
		expect(settings.features.cleanup.source).toBe('shared');
		expect(resolveFeature(settings, 'cleanup')).toEqual({
			preset: 'ollama',
			baseUrl: 'http://127.0.0.1:11434/v1',
			model: 'llama3.2',
			apiKey: '',
		});
	});

	it('uses a feature provider without reusing the default key', () => {
		const settings = normalizeSettings({
			preset: 'backboard',
			baseUrl: 'https://app.backboard.io/api',
			model: 'gpt-4o',
			apiKey: 'bb-default',
			features: {
				cleanup: {
					source: 'groq',
					baseUrl: 'https://api.groq.com/openai/v1',
					model: 'llama-3.3-70b-versatile',
					apiKey: 'gsk-feature',
				},
				speech: {
					source: 'openai',
					baseUrl: 'https://api.openai.com/v1',
					model: '',
					apiKey: 'sk-speech',
				},
			},
		});
		const cleanup = resolveFeature(settings, 'cleanup');
		expect(cleanup.apiKey).toBe('gsk-feature');
		expect(cleanup.apiKey).not.toBe('bb-default');
		expect(usesBackboard(cleanup.preset, cleanup.baseUrl)).toBe(false);
		const answers = resolveFeature(settings, 'ask');
		expect(usesBackboard(answers.preset, answers.baseUrl)).toBe(true);
		expect(resolveFeature(settings, 'speech')).toMatchObject({
			preset: 'openai',
			baseUrl: 'https://api.openai.com/v1',
			apiKey: 'sk-speech',
		});
		expect(settings.features.research.source).toBe('shared');
	});

	it('fills a feature preset and ignores an unknown source', () => {
		const settings = normalizeSettings({
			features: { embeddings: { source: 'not-a-provider', apiKey: 'secret' } },
		});
		expect(settings.features.embeddings.source).toBe('shared');
		expect(settings.features.embeddings.apiKey).toBe('secret');
		applyFeaturePreset(settings.features.embeddings, 'openai');
		expect(settings.features.embeddings.baseUrl).toBe('https://api.openai.com/v1');
		expect(embeddingIndexModel('nomic-embed-text', settings.features.embeddings)).toBe(
			'nomic-embed-text\nhttps://api.openai.com/v1',
		);
	});
});
