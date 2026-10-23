import { applySpeechDefaults, type SpeechInput, type SpeechOutput } from '../audio/speech-catalog';
import { applyFeaturePreset } from '../providers/features';
import { applyPresetSelection, type ProviderPreset } from '../providers/presets';
import type { BumpySettings } from '../settings';

export const SETUP_GROUPS = ['Local', 'Chat models', 'Speech', 'Search and calendar'] as const;

export type SetupGroup = (typeof SETUP_GROUPS)[number];

export interface SetupChange {
	preset?: ProviderPreset;
	model?: string;
	embeddings?: 'local' | 'provider';
	embeddingModel?: string;
	embeddingPreset?: ProviderPreset;
	searchProvider?: BumpySettings['searchProvider'];
	searchUrl?: string;
	speechInput?: SpeechInput;
	speechOutput?: SpeechOutput;
	googleCalendarId?: string;
}

export type SetupRun =
	| { kind: 'apply'; change: SetupChange }
	| { kind: 'copy'; text: string }
	| { kind: 'copy-install' }
	| { kind: 'open'; url: string }
	| { kind: 'pull'; model: string; change: SetupChange }
	| { kind: 'detect-chat'; prefer: string; change: SetupChange }
	| { kind: 'detect-embedding'; prefer: string; change: SetupChange };

export interface SetupButton {
	label: string;
	detail: string;
	done: string;
	run: SetupRun;
}

export interface SetupExample {
	language: string;
	text: string;
}

export interface SetupGuide {
	id: string;
	title: string;
	group: SetupGroup;
	summary: string;
	steps: readonly string[];
	example?: SetupExample;
	buttons: readonly SetupButton[];
}

/** Fills settings from a setup button. Keys already stored are left in place. */
export function applySetup(settings: BumpySettings, change: SetupChange): void {
	if (change.preset) applyPresetSelection(settings, change.preset);
	if (change.model !== undefined) settings.model = change.model;
	if (change.embeddingPreset) {
		applyFeaturePreset(settings.features.embeddings, change.embeddingPreset);
	}
	if (change.embeddings) settings.embeddings = change.embeddings;
	if (change.embeddingModel !== undefined) {
		settings.embeddingModel = change.embeddingModel;
		if (settings.features.embeddings.source !== 'shared') {
			settings.features.embeddings.model = change.embeddingModel;
		}
	}
	if (change.searchProvider) settings.searchProvider = change.searchProvider;
	if (change.searchUrl !== undefined) settings.searchUrl = change.searchUrl;
	if (change.speechInput) {
		settings.speechInput = change.speechInput;
		applySpeechDefaults(change.speechInput, settings, 'input');
	}
	if (change.speechOutput) {
		settings.speechOutput = change.speechOutput;
		applySpeechDefaults(change.speechOutput, settings, 'output');
	}
	if (change.googleCalendarId !== undefined) {
		settings.googleCalendarId = change.googleCalendarId;
	}
}

export function chooseChatModel(models: readonly string[], preferred: string): string {
	const names = cleanNames(models);
	return matchPreferred(names, preferred) ?? names[0] ?? '';
}

export function chooseEmbeddingModel(models: readonly string[], preferred: string): string {
	const names = cleanNames(models);
	return (
		matchPreferred(names, preferred) ??
		names.find((name) => name.toLowerCase().includes('embed')) ??
		''
	);
}

function cleanNames(models: readonly string[]): string[] {
	return models.map((model) => model.trim()).filter((model) => model !== '');
}

function matchPreferred(names: readonly string[], preferred: string): string | undefined {
	const want = preferred.trim().toLowerCase();
	if (want === '') return undefined;
	return names.find((name) => {
		const value = name.toLowerCase();
		return value === want || value.startsWith(`${want}:`) || value.endsWith(`/${want}`);
	});
}
