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
	gemini: {
		label: 'Gemini',
		baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
		model: 'gemini-3.8-flash',
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

export function isProviderPreset(value: string): value is ProviderPreset {
	return Object.prototype.hasOwnProperty.call(PROVIDER_PRESETS, value);
}

export function applyPresetSelection(
	settings: { preset: ProviderPreset; baseUrl: string; model: string },
	preset: ProviderPreset,
): void {
	settings.preset = preset;
	const chosen = PROVIDER_PRESETS[preset];
	if (chosen.baseUrl) settings.baseUrl = chosen.baseUrl;
	if ('model' in chosen && chosen.model) settings.model = chosen.model;
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
