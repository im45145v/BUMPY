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

export function inferPreset(baseUrl: string): ProviderPreset {
	const trimmed = baseUrl.trim().replace(/\/+$/, '');
	for (const id of PRESET_IDS) {
		if (id === 'custom') continue;
		if (PROVIDER_PRESETS[id].baseUrl === trimmed) return id;
	}
	return 'custom';
}
