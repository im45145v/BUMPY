import { isSpeechLanguage } from './audio/languages';
import {
	emptySpeechKeys,
	normalizeSpeechSetup,
	type SpeechInput,
	type SpeechKeys,
	type SpeechOutput,
} from './audio/speech-catalog';
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

export interface BumpySettings {
	preset: ProviderPreset;
	baseUrl: string;
	model: string;
	apiKey: string;
	speechInput: SpeechInput;
	speechOutput: SpeechOutput;
	speechKeys: SpeechKeys;
	transcriptionModel: string;
	speechModel: string;
	speechVoice: string;
	speechLanguage: string;
	excludedFolders: string;
	calendarConflict: 'ask' | 'vault-wins' | 'calendar-wins';
	googleAccessToken: string;
	googleClientId: string;
	googleClientSecret: string;
	googleRefreshToken: string;
	googleCalendarId: string;
	reminderHour: number;
	systemReminders: boolean;
	embeddings: 'local' | 'provider';
	embeddingModel: string;
	searchProvider: 'off' | 'searxng' | 'brave' | 'tavily' | 'serpapi';
	searchUrl: string;
	searchApiKey: string;
	journalFolder: string;
	journalDays: number;
	features: Record<FeatureId, FeatureProvider>;
	callBridge: boolean;
	callBridgeUrl: string;
	callBridgeToken: string;
}

export const DEFAULT_SETTINGS: BumpySettings = {
	preset: 'ollama',
	baseUrl: PROVIDER_PRESETS.ollama.baseUrl,
	model: '',
	apiKey: '',
	speechInput: 'web-speech',
	speechOutput: 'web-speech',
	speechKeys: emptySpeechKeys(),
	transcriptionModel: 'whisper-1',
	speechModel: 'tts-1',
	speechVoice: 'alloy',
	speechLanguage: 'auto',
	excludedFolders: '.trash',
	calendarConflict: 'ask',
	googleAccessToken: '',
	googleClientId: '',
	googleClientSecret: '',
	googleRefreshToken: '',
	googleCalendarId: '',
	reminderHour: 9,
	systemReminders: true,
	embeddings: 'local',
	embeddingModel: 'nomic-embed-text',
	searchProvider: 'off',
	searchUrl: '',
	searchApiKey: '',
	journalFolder: 'Journal',
	journalDays: 7,
	features: defaultFeatures(),
	callBridge: false,
	callBridgeUrl: '',
	callBridgeToken: '',
};

export function normalizeSettings(
	partial:
		| (Partial<Omit<BumpySettings, 'features'>> & { features?: unknown })
		| null
		| undefined,
): BumpySettings {
	const source = partial ?? {};
	const speech = normalizeSpeechSetup(
		source.speechInput,
		source.speechOutput,
		source.speechKeys,
		legacySpeechAccount(source),
	);
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
		speechInput: speech.speechInput,
		speechOutput: speech.speechOutput,
		speechKeys: speech.speechKeys,
		transcriptionModel: textSetting(
			source.transcriptionModel,
			DEFAULT_SETTINGS.transcriptionModel,
		),
		speechModel: textSetting(source.speechModel, DEFAULT_SETTINGS.speechModel),
		speechVoice: textSetting(source.speechVoice, DEFAULT_SETTINGS.speechVoice),
		speechLanguage: languageSetting(source.speechLanguage),
		excludedFolders: textSetting(
			source.excludedFolders,
			DEFAULT_SETTINGS.excludedFolders,
		),
		calendarConflict: conflictSetting(source.calendarConflict),
		googleAccessToken: textSetting(source.googleAccessToken, ''),
		googleClientId: textSetting(source.googleClientId, ''),
		googleClientSecret: textSetting(source.googleClientSecret, ''),
		googleRefreshToken: textSetting(source.googleRefreshToken, ''),
		googleCalendarId: textSetting(source.googleCalendarId, ''),
		reminderHour: hourSetting(source.reminderHour),
		systemReminders: source.systemReminders !== false,
		embeddings: source.embeddings === 'provider' ? 'provider' : 'local',
		embeddingModel: textSetting(source.embeddingModel, DEFAULT_SETTINGS.embeddingModel),
		searchProvider: searchSetting(source.searchProvider),
		searchUrl: textSetting(source.searchUrl, ''),
		searchApiKey: textSetting(source.searchApiKey, ''),
		journalFolder: textSetting(source.journalFolder, DEFAULT_SETTINGS.journalFolder),
		journalDays: daySetting(source.journalDays),
		features: normalizeFeatures(source.features),
		callBridge: source.callBridge === true,
		callBridgeUrl: textSetting(source.callBridgeUrl, ''),
		callBridgeToken: textSetting(source.callBridgeToken, ''),
	};
}

function languageSetting(value: unknown): string {
	return typeof value === 'string' && isSpeechLanguage(value) ? value : 'auto';
}

function searchSetting(value: unknown): BumpySettings['searchProvider'] {
	return value === 'searxng' ||
		value === 'brave' ||
		value === 'tavily' ||
		value === 'serpapi' ||
		value === 'off'
		? value
		: 'off';
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

function legacySpeechAccount(source: {
	preset?: unknown;
	apiKey?: unknown;
	features?: unknown;
}): { preset: string; apiKey: string } {
	const features =
		source.features && typeof source.features === 'object'
			? (source.features as { speech?: unknown }).speech
			: undefined;
	const speech =
		features && typeof features === 'object'
			? (features as { source?: unknown; apiKey?: unknown })
			: undefined;
	const featureKey = typeof speech?.apiKey === 'string' ? speech.apiKey : '';
	const featurePreset = typeof speech?.source === 'string' ? speech.source : '';
	if (featurePreset !== '' && featurePreset !== 'shared') {
		return { preset: featurePreset, apiKey: featureKey };
	}
	return {
		preset: typeof source.preset === 'string' ? source.preset : '',
		apiKey: typeof source.apiKey === 'string' ? source.apiKey : '',
	};
}

function textSetting(value: unknown, fallback: string): string {
	return typeof value === 'string' ? value : fallback;
}

export interface SettingsOwner {
	settings: BumpySettings;
	saveSettings(): Promise<void>;
	requests: RequestScope;
	scheduleSave(): void;
}
