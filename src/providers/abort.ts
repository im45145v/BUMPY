import { RequestCancelledError } from './types';

/**
 * Obsidian's requestUrl cannot abort the socket. This still stops Bumpy from
 * waiting on or using the response after the user cancels.
 */
export function untilAbort<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
	if (!signal) return work;
	if (signal.aborted) return Promise.reject(new RequestCancelledError());

	return new Promise((resolve, reject) => {
		const onAbort = () => {
			reject(new RequestCancelledError());
		};
		signal.addEventListener('abort', onAbort, { once: true });
		work.then(resolve, reject).finally(() => {
			signal.removeEventListener('abort', onAbort);
		});
	});
}

export function cancelled(error: unknown, signal?: AbortSignal): boolean {
	if (signal?.aborted) return true;
	if (error instanceof RequestCancelledError) return true;
	return error instanceof Error && error.name === 'AbortError';
}
