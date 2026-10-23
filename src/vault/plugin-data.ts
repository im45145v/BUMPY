export interface PluginDataHost {
	loadData(): Promise<unknown>;
	saveData(data: unknown): Promise<void>;
}

const chains = new WeakMap<object, Promise<void>>();

/**
 * Serializes read-modify-write of plugin data for one host.
 * Overlapping savers wait, so a settings write cannot drop the index or the reminder list.
 */
export function updatePluginData(
	host: PluginDataHost,
	mutate: (data: Record<string, unknown>) => void,
): Promise<void> {
	const previous = chains.get(host) ?? Promise.resolve();
	const run = previous.then(async () => {
		const stored = ((await host.loadData()) ?? {}) as Record<string, unknown>;
		const next = { ...stored };
		mutate(next);
		await host.saveData(next);
	});
	chains.set(
		host,
		run.then(
			() => undefined,
			() => undefined,
		),
	);
	return run;
}
