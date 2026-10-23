export const PROVIDER_PRESETS = {
	ollama: {
		label: 'Ollama',
		baseUrl: 'http://127.0.0.1:11434/v1',
	},
	'lm-studio': {
		label: 'LM Studio',
		baseUrl: 'http://127.0.0.1:1234/v1',
	},
	openai: {
		label: 'OpenAI',
		baseUrl: 'https://api.openai.com/v1',
		model: 'gpt-4o',
		models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini'],
	},
	anthropic: {
		label: 'Anthropic',
		baseUrl: 'https://api.anthropic.com/v1',
		model: 'claude-sonnet-4-5',
		models: ['claude-sonnet-4-5', 'claude-opus-4-5', 'claude-haiku-4-5'],
	},
	gemini: {
		label: 'Gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
		model: 'gemini-3.8-flash',
		models: ['gemini-3.8-flash'],
	},
	groq: {
		label: 'Groq',
		baseUrl: 'https://api.groq.com/openai/v1',
		model: 'llama-3.3-70b-versatile',
		models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
	},
	openrouter: {
		label: 'OpenRouter',
		baseUrl: 'https://openrouter.ai/api/v1',
	},
	mistral: {
		label: 'Mistral',
		baseUrl: 'https://api.mistral.ai/v1',
		model: 'mistral-medium-latest',
		models: [
			'mistral-medium-latest',
			'mistral-large-latest',
			'mistral-small-latest',
			'codestral-latest',
			'ministral-14b-latest',
			'ministral-8b-latest',
		],
	},
	deepseek: {
		label: 'DeepSeek',
		baseUrl: 'https://api.deepseek.com/v1',
		model: 'deepseek-chat',
		models: ['deepseek-chat', 'deepseek-reasoner'],
	},
	xai: {
		label: 'xAI',
		baseUrl: 'https://api.x.ai/v1',
		model: 'grok-4',
		models: ['grok-4', 'grok-3', 'grok-3-mini'],
	},
	ultramarine: {
		label: 'Ultramarine',
		baseUrl: 'https://api.paperinstruments.com/v1',
		model: 'ultramarine-1-flash',
		models: ['ultramarine-1-flash'],
	},
	backboard: {
		label: 'Backboard',
		baseUrl: 'https://app.backboard.io/api',
		model: 'gpt-4o',
		models: ['gpt-4o'],
	},
	custom: {
		label: 'Custom',
		baseUrl: '',
	},
} as const;

export type ProviderPreset = keyof typeof PROVIDER_PRESETS;

export const PRESET_IDS = Object.keys(PROVIDER_PRESETS) as ProviderPreset[];

const KEEPS_CURRENT_MODEL = new Set<ProviderPreset>([
	'ollama',
	'lm-studio',
	'openrouter',
	'custom',
]);

export const EMBEDDING_MODEL_CHOICES = [
	'nomic-embed-text',
	'text-embedding-3-small',
	'text-embedding-3-large',
	'mistral-embed',
] as const;

export function presetModelList(preset: ProviderPreset): readonly string[] {
	const chosen = PROVIDER_PRESETS[preset];
	if ('models' in chosen) return chosen.models;
	return [];
}

export function withCurrentModel(models: readonly string[], current: string): string[] {
	const value = current.trim();
	if (value !== '' && !models.includes(value)) return [value, ...models];
	return [...models];
}

export function defaultEmbeddingModel(preset: ProviderPreset): string {
	switch (preset) {
		case 'mistral':
			return 'mistral-embed';
		case 'openai':
			return 'text-embedding-3-small';
		case 'ollama':
		case 'lm-studio':
			return 'nomic-embed-text';
		default:
			return '';
	}
}

export function isProviderPreset(value: string): value is ProviderPreset {
	return Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, value);
}

export function applyPresetSelection(
	settings: { preset: ProviderPreset; baseUrl: string; model: string },
	preset: ProviderPreset,
): void {
	settings.preset = preset;
	fillPreset(settings, preset);
}

/** Fills the URL and model for a chosen preset. Custom leaves both as they are. */
export function fillPreset(
	target: { baseUrl: string; model: string },
	preset: ProviderPreset,
): void {
	if (preset !== 'custom') {
		const chosen = PROVIDER_PRESETS[preset];
		if (chosen.baseUrl) target.baseUrl = chosen.baseUrl;
	}
	target.model = modelForPreset(preset, target.model);
}

export function modelForPreset(preset: ProviderPreset, current: string): string {
	const chosen = PROVIDER_PRESETS[preset];
	if ('model' in chosen && chosen.model) return chosen.model;
	if (KEEPS_CURRENT_MODEL.has(preset)) return current;
	return '';
}

export function usesBackboard(preset: string, baseUrl: string): boolean {
	if (preset === 'backboard') return true;
	try {
		return new URL(baseUrl.trim()).hostname === 'app.backboard.io';
	} catch {
		return false;
	}
}

export function inferPreset(baseUrl: string): ProviderPreset {
	const trimmed = baseUrl.trim().replace(/\/+$/, '');
	for (const id of PRESET_IDS) {
		if (id === 'custom') continue;
		if (PROVIDER_PRESETS[id].baseUrl === trimmed) return id;
	}
	return 'custom';
}
