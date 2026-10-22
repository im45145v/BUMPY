import { ProviderError } from '../providers/types';

export const SPEECH_LANGUAGES = [
	{ id: 'auto', label: 'Automatic' },
	{ id: 'en', label: 'English' },
	{ id: 'ar-EG', label: 'Arabic (Egypt)' },
	{ id: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
	{ id: 'ar-AE', label: 'Arabic (United Arab Emirates)' },
	{ id: 'bn', label: 'Bengali' },
	{ id: 'zh', label: 'Chinese' },
	{ id: 'fr', label: 'French' },
	{ id: 'de', label: 'German' },
	{ id: 'hi', label: 'Hindi' },
	{ id: 'id', label: 'Indonesian' },
	{ id: 'it', label: 'Italian' },
	{ id: 'ja', label: 'Japanese' },
	{ id: 'ko', label: 'Korean' },
	{ id: 'pt-BR', label: 'Portuguese (Brazil)' },
	{ id: 'pt-PT', label: 'Portuguese (Portugal)' },
	{ id: 'ru', label: 'Russian' },
	{ id: 'es-MX', label: 'Spanish (Mexico)' },
	{ id: 'es-ES', label: 'Spanish (Spain)' },
	{ id: 'tr', label: 'Turkish' },
	{ id: 'vi', label: 'Vietnamese' },
] as const;

export type SpeechLanguage = (typeof SPEECH_LANGUAGES)[number]['id'];

const LANGUAGE_IDS = new Set<string>(SPEECH_LANGUAGES.map((item) => item.id));
const GRADIUM = new Set(['en', 'fr', 'de', 'es', 'pt']);
const WEB_SPEECH: Record<string, string> = {
	en: 'en-US',
	fr: 'fr-FR',
	de: 'de-DE',
	hi: 'hi-IN',
	ja: 'ja-JP',
	ko: 'ko-KR',
	zh: 'zh-CN',
	it: 'it-IT',
	ru: 'ru-RU',
	id: 'id-ID',
	bn: 'bn-IN',
	tr: 'tr-TR',
	vi: 'vi-VN',
};

const ELEVEN_LANGUAGE_MODELS = new Set([
	'eleven_v3',
	'eleven_flash_v2_5',
	'eleven_turbo_v2_5',
]);

export function isSpeechLanguage(value: string): value is SpeechLanguage {
	return LANGUAGE_IDS.has(value);
}

export function grokLanguage(code: string): string {
	return isSpeechLanguage(code) ? code : 'auto';
}

/** Gradium accepts en, fr, de, es, pt, or any. Other choices are rejected. */
export function gradiumLanguage(code: string): string {
	if (code === 'auto' || code === '') return 'any';
	const base = primary(code);
	if (GRADIUM.has(base)) return base;
	throw new ProviderError(
		'Gradium transcribes English, French, German, Spanish, and Portuguese. Choose one of those, or Automatic.',
	);
}

/** Rewrite rules for Gradium reading. Unsupported languages keep the voice default. */
export function gradiumRewrite(code: string): string | null {
	if (code === 'auto' || code === '') return null;
	const base = primary(code);
	return GRADIUM.has(base) ? base : null;
}

export function deepgramLanguage(code: string): string {
	if (!isSpeechLanguage(code) || code === 'auto') return 'multi';
	return code;
}

export function webSpeechLanguage(code: string, automatic = 'en-US'): string {
	if (!isSpeechLanguage(code) || code === 'auto') return automatic || 'en-US';
	return WEB_SPEECH[code] ?? code;
}

/**
 * ElevenLabs language_code is ISO 639-1.
 * eleven_multilingual_v2 ignores it, so only models that honor it receive one.
 */
export function elevenLanguage(model: string, code: string): string | undefined {
	if (!ELEVEN_LANGUAGE_MODELS.has(model.trim())) return undefined;
	if (!isSpeechLanguage(code) || code === 'auto') return undefined;
	const base = primary(code);
	return /^[a-z]{2}$/.test(base) ? base : undefined;
}

function primary(code: string): string {
	return code.toLowerCase().split('-')[0] ?? '';
}
