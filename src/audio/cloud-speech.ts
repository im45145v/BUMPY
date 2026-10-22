import type { BumpySettings } from '../settings';
import { ProviderError, type HttpClient } from '../providers/types';
import { transcribeWithGradium, synthesizeWithGradium } from './gradium-audio';
import { synthesizeWithGrok, transcribeWithGrok } from './grok-audio';
import { synthesizeSpeech, transcribeAudio } from './openai-audio';
import { speechCloud, type SpeechCloud } from './speech-catalog';

const OPENAI_AUDIO = 'https://api.openai.com/v1';
const GROQ_AUDIO = 'https://api.groq.com/openai/v1';

export interface SpokenAudio {
	bytes: ArrayBuffer;
	mime: string;
}

export async function transcribeCloud(
	settings: BumpySettings,
	audio: Uint8Array,
	mime: string,
	signal: AbortSignal,
	http: HttpClient,
): Promise<string> {
	const route = speechCloud(settings.speechInput);
	if (!route) throw new ProviderError('Choose a speech to text provider.');
	const key = settings.speechKeys[route];
	if (route === 'openai' || route === 'groq') {
		return transcribeAudio(http, audio, mime, {
			baseUrl: route === 'openai' ? OPENAI_AUDIO : GROQ_AUDIO,
			apiKey: key,
			model: settings.transcriptionModel,
			signal,
		});
	}
	if (route === 'grok') {
		return transcribeWithGrok(
			http,
			audio,
			mime,
			key,
			settings.transcriptionModel,
			signal,
		);
	}
	return transcribeWithGradium(http, audio, mime, key, signal);
}

export async function synthesizeCloud(
	settings: BumpySettings,
	text: string,
	signal: AbortSignal,
	http: HttpClient,
): Promise<SpokenAudio> {
	const route = speechCloud(settings.speechOutput);
	if (!route || route === 'groq') {
		throw new ProviderError('Choose a text to speech provider.');
	}
	const key = settings.speechKeys[route];
	if (route === 'openai') {
		return {
			mime: 'audio/mpeg',
			bytes: await synthesizeSpeech(http, text, settings.speechVoice, {
				baseUrl: OPENAI_AUDIO,
				apiKey: key,
				model: settings.speechModel,
				signal,
			}),
		};
	}
	if (route === 'grok') {
		return {
			mime: 'audio/mpeg',
			bytes: await synthesizeWithGrok(http, text, settings.speechVoice, key, signal),
		};
	}
	return {
		mime: 'audio/wav',
		bytes: await synthesizeWithGradium(http, text, settings.speechVoice, key, signal),
	};
}

export function sameSpeechKey(input: SpeechCloud | null, output: SpeechCloud | null): boolean {
	return input !== null && input === output;
}
