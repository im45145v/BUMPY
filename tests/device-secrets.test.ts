import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/settings';
import {
	applySettingsToPluginData,
	browserSecretStore,
	extractSecrets,
	mergeDeviceSecrets,
	pluginDataHasSecrets,
	readDeviceSecrets,
	stripSecrets,
	writeDeviceSecrets,
	type SecretStore,
} from '../src/vault/device-secrets';

function memoryStore(): SecretStore & { values: Map<string, string> } {
	const values = new Map<string, string>();
	return {
		values,
		get: (key) => values.get(key) ?? null,
		set: (key, value) => {
			values.set(key, value);
		},
	};
}

describe('device secrets', () => {
	it('moves keys out of the vault copy and reads them back on this device', () => {
		const stored = {
			apiKey: 'chat-key',
			model: 'local',
			speechKeys: { openai: 'speech-key' },
			features: { cleanup: { source: 'openai', apiKey: 'feature-key' } },
			ragIndex: { chunks: [1] },
		};
		expect(pluginDataHasSecrets(stored)).toBe(true);
		const secrets = extractSecrets(stored);
		const store = memoryStore();
		writeDeviceSecrets(store, 'vault-a', secrets!);
		const data = { ...stored, features: { cleanup: { ...stored.features.cleanup } } };
		stripSecrets(data);
		expect(data.apiKey).toBeUndefined();
		expect(data.speechKeys).toBeUndefined();
		expect((data.features.cleanup as { apiKey?: string }).apiKey).toBeUndefined();
		expect(data.model).toBe('local');
		expect(data.ragIndex).toEqual({ chunks: [1] });

		const merged = mergeDeviceSecrets(data, readDeviceSecrets(store, 'vault-a'));
		const settings = normalizeSettings(merged as Partial<ReturnType<typeof normalizeSettings>>);
		expect(settings.apiKey).toBe('chat-key');
		expect(settings.speechKeys.openai).toBe('speech-key');
		expect(settings.features.cleanup.apiKey).toBe('feature-key');
		expect(settings.model).toBe('local');
		expect(readDeviceSecrets(store, 'vault-b')).toBeNull();
	});

	it('leaves keys in plugin data when this device cannot store them', () => {
		const data = { apiKey: 'chat-key', model: 'local', calendarLinks: [{ taskKey: 'rent' }] };
		applySettingsToPluginData(data, { apiKey: 'chat-key', model: 'local' }, false);
		expect(data.apiKey).toBe('chat-key');
		expect(data.calendarLinks).toEqual([{ taskKey: 'rent' }]);
		applySettingsToPluginData(data, { apiKey: 'chat-key', model: 'local' }, true);
		expect(data.apiKey).toBeUndefined();
		expect(data.model).toBe('local');
		expect(data.calendarLinks).toEqual([{ taskKey: 'rent' }]);
		expect(() => browserSecretStore({}).set('bumpy.secrets.vault', '{}')).toThrow(/cannot keep keys/);
	});
});
