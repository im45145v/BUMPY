import { RequestCancelledError } from '../providers/types';

export interface ListenOptions {
	signal: AbortSignal;
	stop: Promise<void>;
	onPartial: (text: string) => void;
	onTranscribing?: () => void;
}

export interface SpeechInputEngine {
	isSupported(): boolean;
	listen(options: ListenOptions): Promise<string>;
}

export interface RecognitionResult {
	isFinal: boolean;
	transcript: string;
}

export interface RecognitionEvent {
	resultIndex: number;
	results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface RecognitionLike {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	start(): void;
	stop(): void;
	abort(): void;
	onresult: ((event: RecognitionEvent) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
}

export function createWebSpeechInput(
	factory: () => RecognitionLike | null,
	language = 'en-US',
): SpeechInputEngine {
	return {
		isSupported: () => factory() !== null,
		listen: (options) => listenWithRecognition(factory, options, language),
	};
}

export function browserSpeechRecognition(): RecognitionLike | null {
	if (typeof window === 'undefined') return null;
	const host = window as Window & {
		SpeechRecognition?: new () => RecognitionLike;
		webkitSpeechRecognition?: new () => RecognitionLike;
	};
	const Ctor = host.SpeechRecognition ?? host.webkitSpeechRecognition;
	if (!Ctor) return null;
	return new Ctor();
}

async function listenWithRecognition(
	factory: () => RecognitionLike | null,
	options: ListenOptions,
	language: string,
): Promise<string> {
	const recognition = factory();
	if (!recognition) {
		throw new Error('Speech recognition is not available in this app.');
	}
	recognition.lang = language || 'en-US';
	recognition.continuous = true;
	recognition.interimResults = true;

	return new Promise((resolve, reject) => {
		let transcript = '';
		let settled = false;
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			if (error) reject(error);
			else resolve(transcript.trim());
		};
		const onAbort = () => {
			recognition.abort();
			finish(new RequestCancelledError());
		};
		if (options.signal.aborted) {
			finish(new RequestCancelledError());
			return;
		}
		options.signal.addEventListener('abort', onAbort, { once: true });
		void options.stop.then(() => {
			if (!settled) recognition.stop();
		});
		recognition.onresult = (event) => {
			transcript = transcriptFrom(event);
			options.onPartial(transcript);
		};
		recognition.onerror = (event) => {
			if (event.error === 'aborted' || event.error === 'no-speech') {
				finish();
				return;
			}
			finish(new Error(speechErrorMessage(event.error)));
		};
		recognition.onend = () => finish();
		try {
			recognition.start();
		} catch {
			options.signal.removeEventListener('abort', onAbort);
			finish(new Error('Speech recognition is not available in this app.'));
		}
	});
}

function transcriptFrom(event: RecognitionEvent): string {
	const parts: string[] = [];
	for (let i = 0; i < event.results.length; i++) {
		const result = event.results[i];
		const text = result?.[0]?.transcript ?? '';
		if (text) parts.push(text);
	}
	return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function speechErrorMessage(code: string): string {
	switch (code) {
		case 'not-allowed':
			return 'The microphone permission was denied.';
		case 'audio-capture':
			return 'This app cannot record audio.';
		case 'service-not-allowed':
		case 'language-not-supported':
			return 'Speech recognition is not available in this app.';
		case 'network':
			return 'Speech recognition could not reach its service.';
		default:
			return 'Transcription failed.';
	}
}

export interface AudioRecorder {
	isSupported(): boolean;
	start(): Promise<void>;
	stop(): Promise<{ bytes: Uint8Array; mime: string }>;
	cancel(): void;
}

export function createRecorderInput(
	recorder: AudioRecorder,
	transcribe: (audio: Uint8Array, mime: string, signal: AbortSignal) => Promise<string>,
): SpeechInputEngine {
	return {
		isSupported: () => recorder.isSupported(),
		listen: async (options) => {
			if (!recorder.isSupported()) {
				throw new Error('This app cannot record audio.');
			}
			await recorder.start();
			try {
				await Promise.race([options.stop, abortAsPromise(options.signal)]);
			} catch (error) {
				recorder.cancel();
				throw error;
			}
			if (options.signal.aborted) {
				recorder.cancel();
				throw new RequestCancelledError();
			}
			options.onTranscribing?.();
			const recording = await recorder.stop();
			return transcribe(recording.bytes, recording.mime, options.signal);
		},
	};
}

function abortAsPromise(signal: AbortSignal): Promise<never> {
	if (signal.aborted) return Promise.reject(new RequestCancelledError());
	return new Promise((_, reject) => {
		signal.addEventListener(
			'abort',
			() => reject(new RequestCancelledError()),
			{ once: true },
		);
	});
}

export function localSpeechSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		'speechSynthesis' in window &&
		typeof window.SpeechSynthesisUtterance === 'function'
	);
}

export function speakWithWebSpeech(text: string, signal: AbortSignal): Promise<void> {
	if (!localSpeechSupported()) {
		return Promise.reject(
			new Error('Speech synthesis is not available in this app.'),
		);
	}
	const synthesis = window.speechSynthesis;
	const utterance = new window.SpeechSynthesisUtterance(text);
	return new Promise((resolve, reject) => {
		let settled = false;
		const finish = (error?: Error) => {
			if (settled) return;
			settled = true;
			signal.removeEventListener('abort', onAbort);
			if (error) reject(error);
			else resolve();
		};
		const onAbort = () => {
			synthesis.cancel();
			finish(new RequestCancelledError());
		};
		if (signal.aborted) {
			finish(new RequestCancelledError());
			return;
		}
		signal.addEventListener('abort', onAbort);
		utterance.onend = () => finish();
		utterance.onerror = () => {
			finish(
				signal.aborted
					? new RequestCancelledError()
					: new Error('Could not read the text aloud.'),
			);
		};
		synthesis.speak(utterance);
	});
}

export class BrowserAudioRecorder implements AudioRecorder {
	private recorder: MediaRecorder | null = null;
	private chunks: Blob[] = [];
	private stream: MediaStream | null = null;

	constructor(private readonly mimeType = '') {}

	isSupported(): boolean {
		return (
			typeof MediaRecorder !== 'undefined' &&
			typeof navigator !== 'undefined' &&
			typeof navigator.mediaDevices?.getUserMedia === 'function'
		);
	}

	async start(): Promise<void> {
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			throw new Error('The microphone permission was denied.');
		}
		this.stream = stream;
		const mime =
			this.mimeType &&
			typeof MediaRecorder !== 'undefined' &&
			MediaRecorder.isTypeSupported(this.mimeType)
				? this.mimeType
				: '';
		const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
		this.chunks = [];
		recorder.addEventListener('dataavailable', (event) => {
			if (event.data.size > 0) this.chunks.push(event.data);
		});
		this.recorder = recorder;
		recorder.start();
	}

	async stop(): Promise<{ bytes: Uint8Array; mime: string }> {
		const recorder = this.recorder;
		if (!recorder) return { bytes: new Uint8Array(), mime: 'audio/webm' };
		if (recorder.state !== 'inactive') {
			await new Promise<void>((resolve) => {
				recorder.addEventListener('stop', () => resolve(), { once: true });
				recorder.stop();
			});
		}
		const mime = recorder.mimeType || 'audio/webm';
		const blob = new Blob(this.chunks, { type: mime });
		this.release();
		return { bytes: new Uint8Array(await blob.arrayBuffer()), mime };
	}

	cancel(): void {
		if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
		this.chunks = [];
		this.release();
	}

	private release(): void {
		this.stream?.getTracks().forEach((track) => track.stop());
		this.stream = null;
		this.recorder = null;
	}
}
