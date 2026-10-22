import type { BumpySettings } from '../settings';
import { OpenAICompatibleProvider } from './openai-compatible';
import { obsidianHttp } from './obsidian-http';
import type { AIProvider } from './types';

export function createProvider(settings: BumpySettings): AIProvider {
	return new OpenAICompatibleProvider(
		obsidianHttp,
		settings.baseUrl,
		settings.apiKey,
	);
}
