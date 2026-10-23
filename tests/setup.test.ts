import { describe, expect, it } from 'vitest';
import saved from '../docs/setup.md?raw';
import { PRESET_IDS, PROVIDER_PRESETS } from '../src/providers/presets';
import { SPEECH_INPUTS, SPEECH_OUTPUTS } from '../src/audio/speech-catalog';
import type { SetupButton, SetupChange, SetupRun } from '../src/setup/apply';
import { chooseChatModel, chooseEmbeddingModel } from '../src/setup/apply';
import { renderSetupMarkdown, SETUP_GUIDES } from '../src/setup/guides';
import {
	OLLAMA_CHAT_MODEL,
	OLLAMA_EMBED_MODEL,
	ollamaInstallCommand,
	ollamaNativeOrigin,
	pullOllamaModel,
} from '../src/setup/ollama';
import { runSetupButton } from '../src/setup/run';
import { normalizeSettings } from '../src/settings';
import type { HttpClient, HttpRequest } from '../src/providers/types';

describe('setup guides', () => {
	it('covers every chat provider, speech route, and search provider', () => {
		const presets = new Set<string>();
		const inputs = new Set<string>();
		const outputs = new Set<string>();
		const searches = new Set<string>();
		for (const guide of SETUP_GUIDES) {
			for (const button of guide.buttons) {
				const change = changeOf(button.run);
				if (!change) continue;
				if (change.preset) presets.add(change.preset);
				if (change.embeddingPreset) presets.add(change.embeddingPreset);
				if (change.speechInput) inputs.add(change.speechInput);
				if (change.speechOutput) outputs.add(change.speechOutput);
				if (change.searchProvider) searches.add(change.searchProvider);
			}
		}
		expect([...presets].sort()).toEqual([...PRESET_IDS].sort());
		expect([...inputs].sort()).toEqual(SPEECH_INPUTS.map((item) => item.id).sort());
		expect([...outputs].sort()).toEqual(SPEECH_OUTPUTS.map((item) => item.id).sort());
		expect([...searches].sort()).toEqual(['brave', 'searxng', 'serpapi', 'tavily']);
		const ids = SETUP_GUIDES.map((guide) => guide.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('writes the repository page from the same steps', () => {
		const markdown = renderSetupMarkdown();
		for (const id of PRESET_IDS) {
			const preset = PROVIDER_PRESETS[id];
			expect(markdown).toContain(preset.label);
			if (preset.baseUrl) expect(markdown).toContain(preset.baseUrl);
			if ('model' in preset && preset.model) expect(markdown).toContain(preset.model);
		}
		expect(markdown).toContain(OLLAMA_CHAT_MODEL);
		expect(markdown).toContain(OLLAMA_EMBED_MODEL);
		expect(markdown).toContain('Local hashing');
		expect(markdown).toContain('SearXNG');
		expect(saved).toBe(markdown);
	});

	it('keeps stored keys when a provider is selected', async () => {
		const settings = normalizeSettings({
			preset: 'openai',
			baseUrl: 'https://api.openai.com/v1',
			model: 'gpt-4o',
			apiKey: 'chat-key',
			searchApiKey: 'search-key',
			googleAccessToken: 'token',
			speechKeys: {
				openai: 'speech-key',
				groq: '',
				grok: '',
				gradium: '',
				mistral: '',
				deepgram: '',
				elevenlabs: '',
			},
		});
		await applyButton(settings, 'ollama', 'Use Ollama');
		expect(settings.preset).toBe('ollama');
		expect(settings.baseUrl).toBe('http://127.0.0.1:11434/v1');
		expect(settings.model).toBe(OLLAMA_CHAT_MODEL);
		expect(settings.apiKey).toBe('chat-key');

		await applyButton(settings, 'ollama-embeddings', 'Use Ollama embeddings');
		expect(settings.preset).toBe('ollama');
		expect(settings.embeddings).toBe('provider');
		expect(settings.embeddingModel).toBe(OLLAMA_EMBED_MODEL);
		expect(settings.features.embeddings.source).toBe('ollama');
		expect(settings.features.embeddings.baseUrl).toBe('http://127.0.0.1:11434/v1');
		expect(settings.features.embeddings.model).toBe(OLLAMA_EMBED_MODEL);
		expect(settings.apiKey).toBe('chat-key');

		await applyButton(settings, 'openai', 'Use OpenAI');
		expect(settings.model).toBe('gpt-4o');
		expect(settings.apiKey).toBe('chat-key');

		await applyButton(settings, 'openai-speech', 'Use OpenAI speech');
		expect(settings.speechInput).toBe('openai');
		expect(settings.speechOutput).toBe('openai');
		expect(settings.transcriptionModel).toBe('whisper-1');
		expect(settings.speechModel).toBe('tts-1');
		expect(settings.speechVoice).toBe('alloy');
		expect(settings.speechKeys.openai).toBe('speech-key');

		await applyButton(settings, 'google-calendar', 'Use primary calendar');
		expect(settings.googleCalendarId).toBe('primary');
		expect(settings.googleAccessToken).toBe('token');
		expect(settings.searchApiKey).toBe('search-key');
	});

	it('downloads an Ollama model without sending a key', async () => {
		const settings = normalizeSettings({
			preset: 'openai',
			apiKey: 'chat-key',
			model: 'gpt-4o',
		});
		const requests: HttpRequest[] = [];
		const outcome = await runSetupButton(
			settings,
			button('ollama-embeddings', `Download ${OLLAMA_EMBED_MODEL}`),
			record(requests, { status: 200, body: JSON.stringify({ status: 'success' }) }),
			'darwin',
		);
		expect(outcome.save).toBe(true);
		expect(outcome.message).toContain(`Downloaded ${OLLAMA_EMBED_MODEL}.`);
		expect(settings.preset).toBe('openai');
		expect(settings.features.embeddings.source).toBe('ollama');
		expect(requests).toHaveLength(1);
		expect(requests[0]?.url).toBe('http://127.0.0.1:11434/api/pull');
		expect(requests[0]?.body).toBe(
			JSON.stringify({ model: OLLAMA_EMBED_MODEL, stream: false }),
		);
		expect(requests[0]?.headers).toEqual({});
	});

	it('reports a failed Ollama download', async () => {
		const settings = normalizeSettings({});
		const missed = await runSetupButton(
			settings,
			button('ollama', `Download ${OLLAMA_CHAT_MODEL}`),
			async () => {
				throw new Error('offline');
			},
			'linux',
		);
		expect(missed.message).toContain('Could not reach Ollama');
		expect(settings.model).toBe(OLLAMA_CHAT_MODEL);

		const refused = await pullOllamaModel(
			async () => ({ status: 404, body: JSON.stringify({ error: 'model not found' }) }),
			'http://127.0.0.1:11434',
			OLLAMA_CHAT_MODEL,
		);
		expect(refused.ok).toBe(false);
		expect(refused.message).toContain('model not found');
	});

	it('uses a listed local model and skips a chat model for embeddings', async () => {
		expect(chooseChatModel(['llama3.2:latest', 'mistral'], OLLAMA_CHAT_MODEL)).toBe(
			'llama3.2:latest',
		);
		expect(chooseEmbeddingModel(['llama3.2', 'nomic-embed-text:latest'], OLLAMA_EMBED_MODEL)).toBe(
			'nomic-embed-text:latest',
		);
		expect(chooseEmbeddingModel(['llama3.2'], OLLAMA_EMBED_MODEL)).toBe('');
		expect(ollamaNativeOrigin('http://127.0.0.1:11434/v1/')).toBe('http://127.0.0.1:11434');
		expect(ollamaInstallCommand('darwin')).toBe('brew install ollama');
		expect(ollamaInstallCommand('linux')).toContain('install.sh');
		expect(ollamaInstallCommand('win32')).toBe('https://ollama.com/download');

		const settings = normalizeSettings({ preset: 'openai', model: 'gpt-4o' });
		const outcome = await runSetupButton(
			settings,
			button('lm-studio', 'Use the loaded model'),
			async () => ({
				status: 200,
				body: JSON.stringify({ data: [{ id: 'local-chat' }] }),
			}),
			'darwin',
		);
		expect(settings.preset).toBe('lm-studio');
		expect(settings.model).toBe('local-chat');
		expect(outcome.message).toContain('Using local-chat.');

		const embeddings = await runSetupButton(
			settings,
			button('lm-studio', 'Use LM Studio for embeddings'),
			async () => ({
				status: 200,
				body: JSON.stringify({ data: [{ id: 'local-chat' }, { id: 'bge-embed' }] }),
			}),
			'darwin',
		);
		expect(settings.preset).toBe('lm-studio');
		expect(settings.embeddings).toBe('provider');
		expect(settings.embeddingModel).toBe('bge-embed');
		expect(embeddings.message).toContain('Using bge-embed.');
	});
});

async function applyButton(
	settings: ReturnType<typeof normalizeSettings>,
	guideId: string,
	label: string,
): Promise<void> {
	const chosen = button(guideId, label);
	if (chosen.run.kind !== 'apply') throw new Error(label);
	await runSetupButton(settings, chosen, async () => ({ status: 200, body: '' }), 'darwin');
}

function button(guideId: string, label: string): SetupButton {
	const guide = SETUP_GUIDES.find((item) => item.id === guideId);
	const found = guide?.buttons.find((item) => item.label === label);
	if (!found) throw new Error(`${guideId} ${label}`);
	return found;
}

function changeOf(run: SetupRun): SetupChange | undefined {
	switch (run.kind) {
		case 'apply':
		case 'pull':
		case 'detect-chat':
		case 'detect-embedding':
			return run.change;
		default:
			return undefined;
	}
}

function record(
	requests: HttpRequest[],
	response: { status: number; body: string },
): HttpClient {
	return async (request) => {
		requests.push(request);
		return response;
	};
}
