export const SPEECH_INPUTS = [
	{ id: 'web-speech', label: 'App speech service' },
	{ id: 'openai', label: 'OpenAI' },
	{ id: 'groq', label: 'Groq' },
	{ id: 'grok', label: 'Grok' },
	{ id: 'gradium', label: 'Gradium' },
] as const;

export const SPEECH_OUTPUTS = [
	{ id: 'web-speech', label: 'App speech service' },
	{ id: 'openai', label: 'OpenAI' },
	{ id: 'grok', label: 'Grok' },
	{ id: 'gradium', label: 'Gradium' },
] as const;

export type SpeechInput = (typeof SPEECH_INPUTS)[number]['id'];
export type SpeechOutput = (typeof SPEECH_OUTPUTS)[number]['id'];
export type SpeechCloud = 'openai' | 'groq' | 'grok' | 'gradium';

export interface SpeechKeys {
	openai: string;
	groq: string;
	grok: string;
	gradium: string;
}

const INPUT_IDS = new Set<string>(SPEECH_INPUTS.map((item) => item.id));
const OUTPUT_IDS = new Set<string>(SPEECH_OUTPUTS.map((item) => item.id));

export function emptySpeechKeys(): SpeechKeys {
	return { openai: '', groq: '', grok: '', gradium: '' };
}

export function isSpeechInput(value: string): value is SpeechInput {
	return INPUT_IDS.has(value);
}

export function isSpeechOutput(value: string): value is SpeechOutput {
	return OUTPUT_IDS.has(value);
}

export function speechCloud(route: SpeechInput | SpeechOutput): SpeechCloud | null {
	return route === 'web-speech' ? null : route;
}

export function keyLabel(provider: SpeechCloud): string {
	if (provider === 'openai') return 'OpenAI API key';
	if (provider === 'groq') return 'Groq API key';
	if (provider === 'grok') return 'Grok API key';
	return 'Gradium API key';
}

export function applySpeechDefaults(
	route: SpeechInput | SpeechOutput,
	target: { transcriptionModel: string; speechModel: string; speechVoice: string },
	side: 'input' | 'output',
): void {
	if (side === 'input') {
		if (route === 'openai') target.transcriptionModel = 'whisper-1';
		if (route === 'groq') target.transcriptionModel = 'whisper-large-v3-turbo';
		if (route === 'grok') target.transcriptionModel = 'grok-voice-transcribe-2.0';
		return;
	}
	if (route === 'openai') {
		target.speechModel = 'tts-1';
		target.speechVoice = 'alloy';
	}
	if (route === 'grok') target.speechVoice = 'eve';
	if (route === 'gradium') target.speechVoice = 'YTpq7expH9539ERJ';
}

export function normalizeSpeechSetup(
	input: unknown,
	output: unknown,
	keys: unknown,
	legacy: { preset: string; apiKey: string },
): { speechInput: SpeechInput; speechOutput: SpeechOutput; speechKeys: SpeechKeys } {
	const migrated = emptySpeechKeys();
	const legacyProvider = cloudForPreset(legacy.preset);
	const speechInput = normalizeInput(input, legacyProvider);
	const speechOutput = normalizeOutput(output, legacyProvider);
	if (input === 'openai-audio' && legacy.apiKey && speechCloud(speechInput)) {
		migrated[speechCloud(speechInput) as SpeechCloud] = legacy.apiKey;
	}
	if (output === 'openai-audio' && legacy.apiKey && speechCloud(speechOutput)) {
		migrated[speechCloud(speechOutput) as SpeechCloud] = legacy.apiKey;
	}
	return {
		speechInput,
		speechOutput,
		speechKeys: readSpeechKeys(keys, migrated),
	};
}

function normalizeInput(value: unknown, legacy: SpeechCloud | null): SpeechInput {
	if (value === 'openai-audio') {
		return legacy === 'groq' || legacy === 'grok' || legacy === 'openai' ? legacy : 'openai';
	}
	return typeof value === 'string' && isSpeechInput(value) ? value : 'web-speech';
}

function normalizeOutput(value: unknown, legacy: SpeechCloud | null): SpeechOutput {
	if (value === 'openai-audio') {
		return legacy === 'grok' || legacy === 'openai' ? legacy : 'openai';
	}
	return typeof value === 'string' && isSpeechOutput(value) ? value : 'web-speech';
}

function cloudForPreset(preset: string): SpeechCloud | null {
	if (preset === 'openai' || preset === 'groq') return preset;
	if (preset === 'xai') return 'grok';
	return null;
}

function readSpeechKeys(value: unknown, migrated: SpeechKeys): SpeechKeys {
	const record =
		value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const keys = emptySpeechKeys();
	for (const id of Object.keys(keys) as SpeechCloud[]) {
		keys[id] =
			typeof record[id] === 'string' && record[id] !== ''
				? record[id]
				: migrated[id];
	}
	return keys;
}
