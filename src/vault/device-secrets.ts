import { emptySpeechKeys, type SpeechKeys } from '../audio/speech-catalog';
import { FEATURES, type FeatureId } from '../providers/features';
import type { BumpySettings } from '../settings';

export interface SecretStore {
	get(key: string): string | null;
	set(key: string, value: string): void;
}

export interface DeviceSecrets {
	apiKey: string;
	searchApiKey: string;
	googleAccessToken: string;
	googleClientSecret: string;
	googleRefreshToken: string;
	callBridgeToken: string;
	speechKeys: SpeechKeys;
	featureKeys: Record<FeatureId, string>;
}

const TEXT_FIELDS = [
	'apiKey',
	'searchApiKey',
	'googleAccessToken',
	'googleClientSecret',
	'googleRefreshToken',
	'callBridgeToken',
] as const;

export function vaultIdentity(app: { vault: { getName(): string } }): string {
	const named = app as { appId?: unknown };
	if (typeof named.appId === 'string' && named.appId.trim() !== '') return named.appId.trim();
	return app.vault.getName();
}

export function deviceVaultKey(identity: string): string {
	const name = identity.trim() || 'vault';
	return `bumpy.secrets.${name}`;
}

export function browserSecretStore(app: {
	loadLocalStorage?(key: string): unknown;
	saveLocalStorage?(key: string, data: unknown): void;
}): SecretStore {
	return {
		get(key) {
			if (typeof app.loadLocalStorage !== 'function') return null;
			const value: unknown = app.loadLocalStorage(key);
			return typeof value === 'string' ? value : null;
		},
		set(key, value) {
			if (typeof app.saveLocalStorage !== 'function') {
				throw new Error('This Obsidian version cannot keep keys on this device.');
			}
			app.saveLocalStorage(key, value);
		},
	};
}

/** Copies settings into plugin data. Keys stay in that copy until this device stored them. */
export function applySettingsToPluginData(
	data: Record<string, unknown>,
	settings: unknown,
	storedOnDevice: boolean,
): void {
	const snapshot = JSON.parse(JSON.stringify(settings ?? {})) as Record<string, unknown>;
	if (storedOnDevice) stripSecrets(snapshot);
	Object.assign(data, snapshot);
	if (storedOnDevice) stripSecrets(data);
}

export function emptyDeviceSecrets(): DeviceSecrets {
	const featureKeys = {} as Record<FeatureId, string>;
	for (const feature of FEATURES) featureKeys[feature.id] = '';
	return {
		apiKey: '',
		searchApiKey: '',
		googleAccessToken: '',
		googleClientSecret: '',
		googleRefreshToken: '',
		callBridgeToken: '',
		speechKeys: emptySpeechKeys(),
		featureKeys,
	};
}

export function secretsFromSettings(settings: BumpySettings): DeviceSecrets {
	const secrets = emptyDeviceSecrets();
	secrets.apiKey = settings.apiKey;
	secrets.searchApiKey = settings.searchApiKey;
	secrets.googleAccessToken = settings.googleAccessToken;
	secrets.googleClientSecret = settings.googleClientSecret;
	secrets.googleRefreshToken = settings.googleRefreshToken;
	secrets.callBridgeToken = settings.callBridgeToken;
	secrets.speechKeys = { ...settings.speechKeys };
	for (const feature of FEATURES) {
		secrets.featureKeys[feature.id] = settings.features[feature.id]?.apiKey ?? '';
	}
	return secrets;
}

function anyFilled(values: readonly string[]): boolean {
	return values.some((key) => key.trim() !== '');
}

export function hasDeviceSecrets(secrets: DeviceSecrets): boolean {
	if (TEXT_FIELDS.some((field) => secrets[field].trim() !== '')) return true;
	const speechValues = Object.values(secrets.speechKeys);
	const featureValues = Object.values(secrets.featureKeys);
	return anyFilled(speechValues) || anyFilled(featureValues);
}

export function extractSecrets(stored: unknown): DeviceSecrets | null {
	if (!stored || typeof stored !== 'object') return null;
	const record = stored as Record<string, unknown>;
	const secrets = emptyDeviceSecrets();
	for (const field of TEXT_FIELDS) {
		const value = record[field];
		if (typeof value === 'string') secrets[field] = value;
	}
	const speech = record.speechKeys;
	if (speech && typeof speech === 'object') {
		for (const key of Object.keys(secrets.speechKeys) as Array<keyof SpeechKeys>) {
			const value = (speech as Record<string, unknown>)[key];
			if (typeof value === 'string') secrets.speechKeys[key] = value;
		}
	}
	const features = record.features;
	if (features && typeof features === 'object') {
		for (const feature of FEATURES) {
			const item = (features as Record<string, unknown>)[feature.id];
			if (!item || typeof item !== 'object') continue;
			const apiKey = (item as { apiKey?: unknown }).apiKey;
			if (typeof apiKey === 'string') secrets.featureKeys[feature.id] = apiKey;
		}
	}
	return hasDeviceSecrets(secrets) ? secrets : null;
}

export function pluginDataHasSecrets(stored: unknown): boolean {
	return extractSecrets(stored) !== null;
}

export function mergeDeviceSecrets(stored: unknown, secrets: DeviceSecrets | null): unknown {
	if (!secrets) return stored;
	const record =
		stored && typeof stored === 'object'
			? { ...(stored as Record<string, unknown>) }
			: {};
	for (const field of TEXT_FIELDS) record[field] = secrets[field];
	record.speechKeys = { ...secrets.speechKeys };
	const features =
		record.features && typeof record.features === 'object'
			? { ...(record.features as Record<string, unknown>) }
			: {};
	for (const feature of FEATURES) {
		const current = features[feature.id];
		const base =
			current && typeof current === 'object'
				? { ...(current as Record<string, unknown>) }
				: {};
		base.apiKey = secrets.featureKeys[feature.id];
		features[feature.id] = base;
	}
	record.features = features;
	return record;
}

/** Removes keys from the object that is written with the vault. */
export function stripSecrets(data: Record<string, unknown>): void {
	for (const field of TEXT_FIELDS) delete data[field];
	delete data.speechKeys;
	const features = data.features;
	if (!features || typeof features !== 'object') return;
	for (const feature of Object.values(features as Record<string, unknown>)) {
		if (feature && typeof feature === 'object') {
			delete (feature as Record<string, unknown>).apiKey;
		}
	}
}

export function readDeviceSecrets(store: SecretStore, identity: string): DeviceSecrets | null {
	const raw = store.get(deviceVaultKey(identity));
	if (!raw) return null;
	try {
		return normalizeStored(JSON.parse(raw) as unknown);
	} catch {
		return null;
	}
}

export function writeDeviceSecrets(
	store: SecretStore,
	identity: string,
	secrets: DeviceSecrets,
): void {
	store.set(deviceVaultKey(identity), JSON.stringify(secrets));
}

function normalizeStored(value: unknown): DeviceSecrets | null {
	if (!value || typeof value !== 'object') return null;
	const secrets = emptyDeviceSecrets();
	const record = value as Record<string, unknown>;
	for (const field of TEXT_FIELDS) {
		const item = record[field];
		if (typeof item === 'string') secrets[field] = item;
	}
	const speech = record.speechKeys;
	if (speech && typeof speech === 'object') {
		for (const key of Object.keys(secrets.speechKeys) as Array<keyof SpeechKeys>) {
			const item = (speech as Record<string, unknown>)[key];
			if (typeof item === 'string') secrets.speechKeys[key] = item;
		}
	}
	const featureKeys = record.featureKeys;
	if (featureKeys && typeof featureKeys === 'object') {
		for (const feature of FEATURES) {
			const item = (featureKeys as Record<string, unknown>)[feature.id];
			if (typeof item === 'string') secrets.featureKeys[feature.id] = item;
		}
	}
	return secrets;
}
