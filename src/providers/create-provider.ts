import type { BumpySettings } from '../settings';
import { BackboardProvider } from './backboard';
import { OpenAICompatibleProvider } from './openai-compatible';
import { obsidianHttp } from './obsidian-http';
import { usesBackboard } from './presets';
import type { AIProvider } from './types';

export function createProvider(settings: BumpySettings): AIProvider {
	if (usesBackboard(settings.preset, settings.baseUrl)) {
		return new BackboardProvider(obsidianHttp, settings.baseUrl, settings.apiKey);
	}
	return new OpenAICompatibleProvider(
		obsidianHttp,
		settings.baseUrl,
		settings.apiKey,
	);
}
