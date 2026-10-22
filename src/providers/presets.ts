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
	},
	anthropic: {
		label: 'Anthropic',
		baseUrl: 'https://api.anthropic.com/v1',
	},
	gemini: {
		label: 'Gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
		model: 'gemini-3.8-flash',
	},
	groq: {
		label: 'Groq',
		baseUrl: 'https://api.groq.com/openai/v1',
		model: 'llama-3.3-70b-versatile',
	},
	openrouter: {
		label: 'OpenRouter',
		baseUrl: 'https://openrouter.ai/api/v1',
	},
	mistral: {
		label: 'Mistral',
		baseUrl: 'https://api.mistral.ai/v1',
	},
	deepseek: {
		label: 'DeepSeek',
		baseUrl: 'https://api.deepseek.com/v1',
	},
	xai: {
		label: 'xAI',
		baseUrl: 'https://api.x.ai/v1',
	},
	backboard: {
		label: 'Backboard',
		baseUrl: 'https://app.backboard.io/api',
		model: 'gpt-4o',
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
	'openai',
	'custom',
]);

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
