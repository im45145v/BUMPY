import { cancelled } from '../providers/abort';
import { ProviderError } from '../providers/types';
import type { DictatePhase } from './phase';
import type { SpeechInputEngine } from './engines';

export interface CaptureRequest {
	engine: SpeechInputEngine;
	signal: AbortSignal;
	stopped: Promise<void>;
	onPhase: (phase: DictatePhase) => void;
}

export type CaptureResult =
	| { ok: true; text: string }
	| { ok: false; message: string };

export async function captureTranscript(
	request: CaptureRequest,
): Promise<CaptureResult> {
	if (request.signal.aborted) {
		return { ok: false, message: 'The request was cancelled.' };
	}
	if (!request.engine.isSupported()) {
		return {
			ok: false,
			message: 'Speech recognition is not available in this app.',
		};
	}

	request.onPhase({ name: 'recording', partial: '' });
	try {
		const text = await request.engine.listen({
			signal: request.signal,
			stop: request.stopped,
			onPartial: (partial) => {
				request.onPhase({ name: 'recording', partial });
			},
			onTranscribing: () => {
				request.onPhase({ name: 'transcribing' });
			},
		});
		if (request.signal.aborted) {
			return { ok: false, message: 'The request was cancelled.' };
		}
		const transcript = text.trim();
		if (transcript === '') return { ok: false, message: 'No speech was heard.' };
		request.onPhase({ name: 'review', transcript });
		return { ok: true, text: transcript };
	} catch (error) {
		if (cancelled(error, request.signal)) {
			return { ok: false, message: 'The request was cancelled.' };
		}
		const message = publicSpeechError(error);
		request.onPhase({ name: 'error', message });
		return { ok: false, message };
	}
}

const KNOWN_SPEECH_ERRORS = new Set([
	'Speech recognition is not available in this app.',
	'This app cannot record audio.',
	'The microphone permission was denied.',
	'Speech recognition could not reach its service.',
	'No speech was heard.',
	'Set a transcription model in settings.',
	'This recording is too large to transcribe.',
	'Transcription failed.',
]);

function publicSpeechError(error: unknown): string {
	if (error instanceof ProviderError) return error.message;
	if (error instanceof Error && KNOWN_SPEECH_ERRORS.has(error.message)) {
		return error.message;
	}
	return 'Transcription failed.';
}
