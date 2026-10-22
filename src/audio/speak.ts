import { cancelled } from '../providers/abort';
import { ProviderError } from '../providers/types';
import { speechTextError } from './limits';

export async function readAloud(options: {
	text: string;
	signal: AbortSignal;
	speak: (text: string, signal: AbortSignal) => Promise<void>;
}): Promise<{ ok: true } | { ok: false; message: string }> {
	const problem = speechTextError(options.text);
	if (problem) return { ok: false, message: problem };
	if (options.signal.aborted) {
		return { ok: false, message: 'The request was cancelled.' };
	}
	try {
		await options.speak(options.text, options.signal);
		if (options.signal.aborted) {
			return { ok: false, message: 'The request was cancelled.' };
		}
		return { ok: true };
	} catch (error) {
		if (cancelled(error, options.signal)) {
			return { ok: false, message: 'The request was cancelled.' };
		}
		if (error instanceof ProviderError) return { ok: false, message: error.message };
		if (
			error instanceof Error &&
			error.message === 'Speech synthesis is not available in this app.'
		) {
			return { ok: false, message: error.message };
		}
		return { ok: false, message: 'Could not read the text aloud.' };
	}
}
