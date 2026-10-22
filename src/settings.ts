import {
	defaultFeatures,
	normalizeFeatures,
	type FeatureId,
	type FeatureProvider,
} from './providers/features';
import {
	PROVIDER_PRESETS,
	inferPreset,
	isProviderPreset,
	type ProviderPreset,
} from './providers/presets';
import type { RequestScope } from './requests/scope';

export type SpeechRoute = 'web-speech' | 'openai-audio';

export interface BumpySettings {
	preset: ProviderPreset;
	baseUrl: string;
	model: string;
	apiKey: string;
	speechInput: SpeechRoute;
	speechOutput: SpeechRoute;
	transcriptionModel: string;
	speechModel: string;
	speechVoice: string;
	excludedFolders: string;
	calendarConflict: 'ask' | 'vault-wins' | 'calendar-wins';
	googleAccessToken: string;
	googleCalendarId: string;
	reminderHour: number;
	embeddings: 'local' | 'provider';
	embeddingModel: string;
	searchProvider: 'off' | 'searxng' | 'brave';
	searchUrl: string;
	searchApiKey: string;
	journalFolder: string;
	journalDays: number;
	features: Record<FeatureId, FeatureProvider>;
}

export const DEFAULT_SETTINGS: BumpySettings = {
	preset: 'ollama',
	baseUrl: PROVIDER_PRESETS.ollama.baseUrl,
	model: '',
	apiKey: '',
	speechInput: 'web-speech',
	speechOutput: 'web-speech',
	transcriptionModel: 'whisper-1',
	speechModel: 'tts-1',
	speechVoice: 'alloy',
	excludedFolders: '.trash',
	calendarConflict: 'ask',
	googleAccessToken: '',
	googleCalendarId: '',
	reminderHour: 9,
	embeddings: 'local',
	embeddingModel: 'nomic-embed-text',
	searchProvider: 'off',
	searchUrl: '',
	searchApiKey: '',
	journalFolder: 'Journal',
	journalDays: 7,
	features: defaultFeatures(),
};

export function normalizeSettings(
	partial:
		| (Partial<Omit<BumpySettings, 'features'>> & { features?: unknown })
		| null
		| undefined,
): BumpySettings {
	const source = partial ?? {};
	const baseUrl = textSetting(source.baseUrl, DEFAULT_SETTINGS.baseUrl);
	const preset =
		typeof source.preset === 'string' && isProviderPreset(source.preset)
			? source.preset
			: inferPreset(baseUrl);
	return {
		preset,
		baseUrl,
		model: textSetting(source.model, ''),
		apiKey: textSetting(source.apiKey, ''),
		speechInput: speechRoute(source.speechInput, 'web-speech'),
		speechOutput: speechRoute(source.speechOutput, 'web-speech'),
		transcriptionModel: textSetting(
			source.transcriptionModel,
			DEFAULT_SETTINGS.transcriptionModel,
		),
		speechModel: textSetting(source.speechModel, DEFAULT_SETTINGS.speechModel),
		speechVoice: textSetting(source.speechVoice, DEFAULT_SETTINGS.speechVoice),
		excludedFolders: textSetting(
			source.excludedFolders,
			DEFAULT_SETTINGS.excludedFolders,
		),
		calendarConflict: conflictSetting(source.calendarConflict),
		googleAccessToken: textSetting(source.googleAccessToken, ''),
		googleCalendarId: textSetting(source.googleCalendarId, ''),
		reminderHour: hourSetting(source.reminderHour),
		embeddings: source.embeddings === 'provider' ? 'provider' : 'local',
		embeddingModel: textSetting(source.embeddingModel, DEFAULT_SETTINGS.embeddingModel),
		searchProvider: searchSetting(source.searchProvider),
		searchUrl: textSetting(source.searchUrl, ''),
		searchApiKey: textSetting(source.searchApiKey, ''),
		journalFolder: textSetting(source.journalFolder, DEFAULT_SETTINGS.journalFolder),
		journalDays: daySetting(source.journalDays),
		features: normalizeFeatures(source.features),
	};
}

function searchSetting(value: unknown): BumpySettings['searchProvider'] {
	return value === 'searxng' || value === 'brave' || value === 'off' ? value : 'off';
}

function daySetting(value: unknown): number {
	const number = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(number) || number < 1 || number > 365) return 7;
	return number;
}

function conflictSetting(
	value: unknown,
): BumpySettings['calendarConflict'] {
	return value === 'vault-wins' || value === 'calendar-wins' || value === 'ask'
		? value
		: 'ask';
}

function hourSetting(value: unknown): number {
	const number = typeof value === 'number' ? value : Number(value);
	if (!Number.isInteger(number) || number < 0 || number > 23) return 9;
	return number;
}

function speechRoute(value: unknown, fallback: SpeechRoute): SpeechRoute {
	return value === 'web-speech' || value === 'openai-audio' ? value : fallback;
}

function textSetting(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

export interface SettingsOwner {
	settings: BumpySettings;
	saveSettings(): Promise<void>;
	requests: RequestScope;
}
