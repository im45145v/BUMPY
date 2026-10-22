import {
	fillPreset,
	isProviderPreset,
	type ProviderPreset,
} from './presets';

export const FEATURES = [
	{
		id: 'cleanup',
		label: 'Cleanup',
		desc: 'Revises the selection or the note.',
		chat: true,
	},
	{
		id: 'ask',
		label: 'Vault answers',
		desc: 'Writes the answer after passages are retrieved.',
		chat: true,
	},
	{
		id: 'research',
		label: 'Research',
		desc: 'Writes the interpretation. Sources still come from web search.',
		chat: true,
	},
	{
		id: 'speech',
		label: 'Speech',
		desc: 'Transcription and reading aloud. App speech service ignores this. Backboard has no audio API.',
		chat: false,
	},
	{
		id: 'embeddings',
		label: 'Embeddings',
		desc: 'Used when embeddings are set to the provider. Backboard cannot embed notes.',
		chat: false,
	},
] as const;

export type FeatureId = (typeof FEATURES)[number]['id'];

export type FeatureSource = 'shared' | ProviderPreset;

export interface FeatureProvider {
	source: FeatureSource;
	baseUrl: string;
	model: string;
	apiKey: string;
}

export interface ResolvedProvider {
	preset: ProviderPreset;
	baseUrl: string;
	model: string;
	apiKey: string;
}

export function defaultFeatures(): Record<FeatureId, FeatureProvider> {
	const features = {} as Record<FeatureId, FeatureProvider>;
	for (const feature of FEATURES) features[feature.id] = emptyFeature();
	return features;
}

export function normalizeFeatures(value: unknown): Record<FeatureId, FeatureProvider> {
	const record =
		value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const features = defaultFeatures();
	for (const feature of FEATURES) {
		features[feature.id] = normalizeFeature(record[feature.id]);
	}
	return features;
}

export function isFeatureSource(value: string): value is FeatureSource {
	return value === 'shared' || isProviderPreset(value);
}

export function applyFeaturePreset(feature: FeatureProvider, source: FeatureSource): void {
	feature.source = source;
	if (source === 'shared') return;
	fillPreset(feature, source);
}

export function resolveFeature(
	settings: {
		preset: ProviderPreset;
		baseUrl: string;
		model: string;
		apiKey: string;
		features: Record<FeatureId, FeatureProvider>;
	},
	feature: FeatureId,
): ResolvedProvider {
	const chosen = settings.features[feature];
	if (!chosen || chosen.source === 'shared') {
		return {
			preset: settings.preset,
			baseUrl: settings.baseUrl,
			model: settings.model,
			apiKey: settings.apiKey,
		};
	}
	return {
		preset: chosen.source,
		baseUrl: chosen.baseUrl,
		model: chosen.model,
		apiKey: chosen.apiKey,
	};
}

/** Identity stored with the index so a different embeddings host is not reused. */
export function embeddingIndexModel(
	model: string,
	endpoint: { baseUrl: string },
): string {
	return `${model.trim()}\n${endpoint.baseUrl.trim()}`;
}

function emptyFeature(): FeatureProvider {
	return { source: 'shared', baseUrl: '', model: '', apiKey: '' };
}

function normalizeFeature(value: unknown): FeatureProvider {
	const record =
		value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
	const source = typeof record.source === 'string' ? record.source : 'shared';
	return {
		source: isFeatureSource(source) ? source : 'shared',
		baseUrl: typeof record.baseUrl === 'string' ? record.baseUrl : '',
		model: typeof record.model === 'string' ? record.model : '',
		apiKey: typeof record.apiKey === 'string' ? record.apiKey : '',
	};
}
