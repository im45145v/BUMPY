import { resolveFeature } from '../providers/features';
import { checkProvider } from '../providers/models';
import type { HttpClient } from '../providers/types';
import type { BumpySettings } from '../settings';
import {
	applySetup,
	chooseChatModel,
	chooseEmbeddingModel,
	type SetupButton,
	type SetupChange,
} from './apply';
import { ollamaInstallCommand, ollamaNativeOrigin, pullOllamaModel } from './ollama';

export interface SetupOutcome {
	message: string;
	save: boolean;
	copy?: string;
	open?: string;
}

export async function runSetupButton(
	settings: BumpySettings,
	button: SetupButton,
	http: HttpClient,
	platform: string,
): Promise<SetupOutcome> {
	const run = button.run;
	switch (run.kind) {
		case 'apply':
			applySetup(settings, run.change);
			return { message: button.done, save: true };
		case 'copy':
			return { message: button.done, save: false, copy: run.text };
		case 'copy-install':
			return { message: button.done, save: false, copy: ollamaInstallCommand(platform) };
		case 'open':
			return { message: button.done, save: false, open: run.url };
		case 'pull':
			return pull(settings, button.done, http, run.model, run.change);
		case 'detect-chat':
			return detectChat(settings, button.done, http, run.prefer, run.change);
		case 'detect-embedding':
			return detectEmbedding(settings, button.done, http, run.prefer, run.change);
	}
}

async function pull(
	settings: BumpySettings,
	done: string,
	http: HttpClient,
	model: string,
	change: SetupChange,
): Promise<SetupOutcome> {
	applySetup(settings, change);
	const base = change.embeddingPreset
		? resolveFeature(settings, 'embeddings').baseUrl
		: settings.baseUrl;
	let origin: string;
	try {
		origin = ollamaNativeOrigin(base);
	} catch {
		return { message: joinMessage(done, 'The Ollama address is not valid.'), save: true };
	}
	const pulled = await pullOllamaModel(http, origin, model);
	return { message: joinMessage(done, pulled.message), save: true };
}

async function detectChat(
	settings: BumpySettings,
	done: string,
	http: HttpClient,
	prefer: string,
	change: SetupChange,
): Promise<SetupOutcome> {
	applySetup(settings, change);
	const check = await checkProvider(http, settings.baseUrl, settings.apiKey);
	if (!check.ok) return { message: joinMessage(done, check.message), save: true };
	const model = chooseChatModel(check.models, prefer);
	if (model === '') {
		return {
			message: joinMessage(done, 'The server did not list a model. Load one, then try again.'),
			save: true,
		};
	}
	settings.model = model;
	return { message: joinMessage(done, `Using ${model}.`), save: true };
}

async function detectEmbedding(
	settings: BumpySettings,
	done: string,
	http: HttpClient,
	prefer: string,
	change: SetupChange,
): Promise<SetupOutcome> {
	applySetup(settings, change);
	const endpoint = resolveFeature(settings, 'embeddings');
	const check = await checkProvider(http, endpoint.baseUrl, endpoint.apiKey);
	if (!check.ok) return { message: joinMessage(done, check.message), save: true };
	const model = chooseEmbeddingModel(check.models, prefer);
	if (model === '') {
		return {
			message: joinMessage(
				done,
				'No embedding model was listed. Load one, then try again.',
			),
			save: true,
		};
	}
	settings.embeddingModel = model;
	if (settings.features.embeddings.source !== 'shared') {
		settings.features.embeddings.model = model;
	}
	return { message: joinMessage(done, `Using ${model}.`), save: true };
}

function joinMessage(lead: string, rest: string): string {
	const left = lead.trim();
	const right = rest.trim();
	if (left === '') return right;
	if (right === '') return left;
	return `${left} ${right}`;
}
