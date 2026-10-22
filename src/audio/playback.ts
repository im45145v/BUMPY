import { RequestCancelledError } from '../providers/types';

export function playAudioBytes(
	bytes: ArrayBuffer,
	signal: AbortSignal,
	mime = 'audio/mpeg',
): Promise<void> {
	const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
	const audio = new Audio(url);
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			audio.pause();
			URL.revokeObjectURL(url);
			signal.removeEventListener('abort', onAbort);
			if (error) reject(error);
			else resolve();
		};
		const onAbort = () => finish(new RequestCancelledError());
		if (signal.aborted) {
			finish(new RequestCancelledError());
			return;
		}
		signal.addEventListener('abort', onAbort);
		audio.addEventListener('ended', () => finish(), { once: true });
		audio.addEventListener(
			'error',
			() => finish(new Error('Could not play the audio.')),
			{ once: true },
		);
		void audio.play().catch((error: unknown) => {
			finish(error instanceof Error ? error : new Error('Could not play the audio.'));
		});
	});
}
