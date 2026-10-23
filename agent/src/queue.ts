export const TASK_QUEUE = 'bumpy-research';

export function temporalAddress(): string {
	const address = process.env.TEMPORAL_ADDRESS?.trim();
	return address && address.length > 0 ? address : 'localhost:7233';
}

export function temporalNamespace(): string {
	const namespace = process.env.TEMPORAL_NAMESPACE?.trim();
	return namespace && namespace.length > 0 ? namespace : 'default';
}
