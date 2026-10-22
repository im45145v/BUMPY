import { revealsSensitiveText } from '../providers/redact';
import { ProviderError, RequestCancelledError } from '../providers/types';
import type { ListenOptions, SpeechInputEngine } from './engines';

const LISTEN_URL = 'wss://api.deepgram.com/v1/listen';
const CLOSE_WAIT_MS = 8_000;

export interface DeepgramState {
	finals: string[];
	interim: string;
}

export type DeepgramMessage =
	| { kind: 'transcript'; text: string; isFinal: boolean }
	| { kind: 'done' }
	| { kind: 'error'; message: string }
	| { kind: 'ignore' };

export interface LiveSocket {
	send(data: string | ArrayBuffer): void;
	close(): void;
	onopen: (() => void) | null;
	onmessage: ((event: { data: unknown }) => void) | null;
	onerror: (() => void) | null;
	onclose: (() => void) | null;
}

export interface LiveMic {
	isSupported(): boolean;
	start(onChunk: (bytes: ArrayBuffer) => void): Promise<void>;
	stop(): Promise<void>;
	cancel(): void;
}

export function deepgramListenUrl(model: string, language: string): string {
	const url = new URL(LISTEN_URL);
	url.searchParams.set('model', model.trim() || 'nova-3');
	url.searchParams.set('language', language.trim() || 'multi');
	url.searchParams.set('interim_results', 'true');
	url.searchParams.set('punctuate', 'true');
	url.searchParams.set('smart_format', 'true');
	url.searchParams.set('mip_opt_out', 'true');
	return url.toString();
}

export function readDeepgramMessage(data: string): DeepgramMessage {
	let parsed: unknown;
	try {
		parsed = JSON.parse(data);
	} catch {
		return { kind: 'ignore' };
	}
	if (!parsed || typeof parsed !== 'object') return { kind: 'ignore' };
	const record = parsed as Record<string, unknown>;
	const type = typeof record.type === 'string' ? record.type : '';
	if (type === 'Metadata') return { kind: 'done' };
	if (type === 'Error' || type === 'error') {
		return { kind: 'error', message: firstText(record.message, record.description, record.err_msg) };
	}
	const text = transcriptOf(record);
	if (type === 'Results' || Object.prototype.hasOwnProperty.call(record, 'is_final')) {
		return { kind: 'transcript', text, isFinal: record.is_final === true };
	}
	return { kind: 'ignore' };
}

export function foldDeepgram(
	state: DeepgramState,
	message: { text: string; isFinal: boolean },
): void {
	if (message.isFinal) {
		if (message.text) state.finals.push(message.text);
		state.interim = '';
		return;
	}
	state.interim = message.text;
}

export function deepgramText(state: DeepgramState): string {
	return [...state.finals, state.interim]
		.filter((part) => part !== '')
		.join(' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function createDeepgramInput(options: {
	apiKey: string;
	model: string;
	language: string;
	openSocket: (url: string, protocols: string[]) => LiveSocket;
	mic: LiveMic;
	armCloseTimer?: (done: () => void) => () => void;
}): SpeechInputEngine {
	return {
		isSupported: () => options.mic.isSupported(),
		listen: (request) => listenDeepgram(options, request),
	};
}

export function browserDeepgramInput(
	apiKey: string,
	model: string,
	language: string,
): SpeechInputEngine {
	return createDeepgramInput({
		apiKey,
		model,
		language,
		openSocket: openBrowserSocket,
		mic: new BrowserLiveMic(),
	});
}

async function listenDeepgram(
	options: {
		apiKey: string;
		model: string;
		language: string;
		openSocket: (url: string, protocols: string[]) => LiveSocket;
		mic: LiveMic;
		armCloseTimer?: (done: () => void) => () => void;
	},
	request: ListenOptions,
): Promise<string> {
	const key = options.apiKey.trim();
	if (key === '') throw new ProviderError('Add a Deepgram API key in speech settings.');
	if (!options.mic.isSupported()) throw new Error('This app cannot record audio.');
	if (request.signal.aborted) throw new RequestCancelledError();

	let socket: LiveSocket;
	try {
		socket = options.openSocket(deepgramListenUrl(options.model, options.language), [
			'token',
			key,
		]);
	} catch {
		throw new ProviderError('Could not reach Deepgram.');
	}

	const state: DeepgramState = { finals: [], interim: '' };
	let failed: Error | null = null;
	let opened = false;
	let ended = false;
	let endStream: () => void = () => {};
	const streamEnded = new Promise<void>((resolve) => {
		endStream = () => {
			if (ended) return;
			ended = true;
			resolve();
		};
	});
	const openedGate = gate();
	socket.onopen = () => {
		opened = true;
		openedGate.resolve();
	};
	socket.onerror = () => {
		failed = new ProviderError('Could not reach Deepgram.');
		openedGate.reject(failed);
		endStream();
	};
	socket.onclose = () => {
		if (!opened) openedGate.reject(new ProviderError('Could not reach Deepgram.'));
		endStream();
	};
	socket.onmessage = (event) => {
		const data = typeof event.data === 'string' ? event.data : '';
		const message = readDeepgramMessage(data);
		if (message.kind === 'error') {
			failed = new ProviderError(publicDeepgramError(message.message, key));
			endStream();
			return;
		}
		if (message.kind === 'transcript') {
			foldDeepgram(state, message);
			request.onPartial(deepgramText(state));
		}
		if (message.kind === 'done') endStream();
	};

	try {
		await openedGate.promise;
		if (request.signal.aborted) throw new RequestCancelledError();
		await options.mic.start((bytes) => {
			try {
				socket.send(bytes);
			} catch {
				failed = new ProviderError('Could not reach Deepgram.');
			}
		});
		await Promise.race([request.stop, abortAsPromise(request.signal), streamEnded]);
		if (request.signal.aborted) throw new RequestCancelledError();
		rethrow(failed);
		request.onTranscribing?.();
		await options.mic.stop();
		try {
			socket.send(JSON.stringify({ type: 'CloseStream' }));
		} catch {
			failed = new ProviderError('Could not reach Deepgram.');
		}
		const cancelTimer = (options.armCloseTimer ?? armCloseTimer)(endStream);
		try {
			await Promise.race([streamEnded, abortAsPromise(request.signal)]);
		} finally {
			cancelTimer();
		}
		if (request.signal.aborted) throw new RequestCancelledError();
		rethrow(failed);
		return deepgramText(state);
	} catch (error) {
		options.mic.cancel();
		if (error instanceof Error) throw error;
		throw new ProviderError('Could not reach Deepgram.');
	} finally {
		socket.close();
	}
}

function rethrow(error: Error | null): void {
	if (!(error instanceof Error)) return;
	throw new ProviderError(error.message);
}

function armCloseTimer(done: () => void): () => void {
	const timer = window.setTimeout(done, CLOSE_WAIT_MS);
	return () => window.clearTimeout(timer);
}

function publicDeepgramError(detail: string, apiKey: string): string {
	const text = detail.replace(/\s+/g, ' ').trim().slice(0, 180);
	if (text === '' || revealsSensitiveText(text, [apiKey])) {
		return 'Deepgram could not transcribe the audio.';
	}
	return `Deepgram could not transcribe the audio. ${text}`;
}

function transcriptOf(record: Record<string, unknown>): string {
	const channel = record.channel;
	if (!channel || typeof channel !== 'object') return '';
	const alternatives = (channel as { alternatives?: unknown }).alternatives;
	if (!Array.isArray(alternatives)) return '';
	const list = alternatives as unknown[];
	const first = list[0];
	if (!first || typeof first !== 'object') return '';
	const text = (first as { transcript?: unknown }).transcript;
	return typeof text === 'string' ? text.trim() : '';
}

function firstText(...values: unknown[]): string {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) return value;
	}
	return '';
}

function gate(): { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	let settled = false;
	const promise = new Promise<void>((res, rej) => {
		resolve = () => {
			if (settled) return;
			settled = true;
			res();
		};
		reject = (error: Error) => {
			if (settled) return;
			settled = true;
			rej(error);
		};
	});
	return { promise, resolve, reject };
}

function abortAsPromise(signal: AbortSignal): Promise<never> {
	if (signal.aborted) return Promise.reject(new RequestCancelledError());
	return new Promise((_, reject) => {
		signal.addEventListener('abort', () => reject(new RequestCancelledError()), { once: true });
	});
}

function openBrowserSocket(url: string, protocols: string[]): LiveSocket {
	return new BrowserSocket(new WebSocket(url, protocols));
}

class BrowserSocket implements LiveSocket {
	onopen: (() => void) | null = null;
	onmessage: ((event: { data: unknown }) => void) | null = null;
	onerror: (() => void) | null = null;
	onclose: (() => void) | null = null;

	constructor(private readonly socket: WebSocket) {
		socket.onopen = () => this.onopen?.();
		socket.onmessage = (event) => this.onmessage?.({ data: event.data });
		socket.onerror = () => this.onerror?.();
		socket.onclose = () => this.onclose?.();
	}

	send(data: string | ArrayBuffer): void {
		this.socket.send(data);
	}

	close(): void {
		this.socket.close();
	}
}

class BrowserLiveMic implements LiveMic {
	private recorder: MediaRecorder | null = null;
	private stream: MediaStream | null = null;

	isSupported(): boolean {
		return (
			typeof WebSocket !== 'undefined' &&
			typeof MediaRecorder !== 'undefined' &&
			typeof navigator !== 'undefined' &&
			typeof navigator.mediaDevices?.getUserMedia === 'function'
		);
	}

	async start(onChunk: (bytes: ArrayBuffer) => void): Promise<void> {
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch {
			throw new Error('The microphone permission was denied.');
		}
		this.stream = stream;
		const recorder = new MediaRecorder(stream);
		recorder.addEventListener('dataavailable', (event) => {
			if (event.data.size === 0) return;
			void event.data.arrayBuffer().then(onChunk);
		});
		this.recorder = recorder;
		recorder.start(250);
	}

	async stop(): Promise<void> {
		const recorder = this.recorder;
		if (recorder && recorder.state !== 'inactive') {
			await new Promise<void>((resolve) => {
				recorder.addEventListener('stop', () => resolve(), { once: true });
				recorder.stop();
			});
		}
		this.release();
	}

	cancel(): void {
		if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
		this.release();
	}

	private release(): void {
		this.stream?.getTracks().forEach((track) => track.stop());
		this.stream = null;
		this.recorder = null;
	}
}
