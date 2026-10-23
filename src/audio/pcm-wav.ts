import { ProviderError } from '../providers/types';
import { gradiumContentType } from './gradium-audio';

export const GRADIUM_PCM_RATE = 24_000;

export interface DecodedRecording {
	sampleRate: number;
	channels: Float32Array[];
}

export function encodePcmWav(samples: Float32Array, sampleRate: number): Uint8Array {
	const dataBytes = samples.length * 2;
	const bytes = new Uint8Array(44 + dataBytes);
	const view = new DataView(bytes.buffer);
	writeAscii(bytes, 0, 'RIFF');
	view.setUint32(4, 36 + dataBytes, true);
	writeAscii(bytes, 8, 'WAVE');
	writeAscii(bytes, 12, 'fmt ');
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true);
	view.setUint16(22, 1, true);
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true);
	view.setUint16(32, 2, true);
	view.setUint16(34, 16, true);
	writeAscii(bytes, 36, 'data');
	view.setUint32(40, dataBytes, true);
	let offset = 44;
	for (let index = 0; index < samples.length; index++) {
		const sample = Math.max(-1, Math.min(1, samples[index] ?? 0));
		view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
		offset += 2;
	}
	return bytes;
}

export function mixAndResample(
	channels: Float32Array[],
	sourceRate: number,
	targetRate: number,
): Float32Array {
	const first = channels[0];
	const frames = first?.length ?? 0;
	if (!first || frames === 0 || channels.length === 0 || sourceRate <= 0 || targetRate <= 0) {
		return new Float32Array();
	}
	const mono = new Float32Array(frames);
	for (let index = 0; index < frames; index++) {
		let sum = 0;
		for (const channel of channels) sum += channel[index] ?? 0;
		mono[index] = sum / channels.length;
	}
	if (sourceRate === targetRate) return mono;
	const outLength = Math.max(1, Math.round((frames * targetRate) / sourceRate));
	const out = new Float32Array(outLength);
	const ratio = sourceRate / targetRate;
	for (let index = 0; index < outLength; index++) {
		const start = Math.min(frames - 1, Math.floor(index * ratio));
		const end = Math.min(frames, Math.max(start + 1, Math.floor((index + 1) * ratio)));
		let sum = 0;
		for (let sample = start; sample < end; sample++) sum += mono[sample] ?? 0;
		out[index] = sum / (end - start);
	}
	return out;
}

export async function audioForGradium(
	audio: Uint8Array,
	mime: string,
	decode: (audio: Uint8Array) => Promise<DecodedRecording>,
): Promise<{ bytes: Uint8Array; mime: string }> {
	if (gradiumContentType(mime)) return { bytes: audio, mime };
	if (audio.byteLength === 0) throw new Error('No speech was heard.');
	let decoded: DecodedRecording;
	try {
		decoded = await decode(audio);
	} catch (error) {
		if (error instanceof ProviderError) throw error;
		throw new ProviderError('Could not convert this recording for Gradium.');
	}
	const pcm = mixAndResample(decoded.channels, decoded.sampleRate, GRADIUM_PCM_RATE);
	if (pcm.length === 0) throw new Error('No speech was heard.');
	return { bytes: encodePcmWav(pcm, GRADIUM_PCM_RATE), mime: 'audio/wav' };
}

export async function decodeRecording(audio: Uint8Array): Promise<DecodedRecording> {
	const Ctor = audioContextConstructor();
	if (!Ctor) throw new ProviderError('This app cannot convert recordings for Gradium.');
	const context = new Ctor();
	try {
		const copy = new Uint8Array(audio).buffer;
		const buffer = await context.decodeAudioData(copy);
		const channels: Float32Array[] = [];
		for (let index = 0; index < buffer.numberOfChannels; index++) {
			channels.push(new Float32Array(buffer.getChannelData(index)));
		}
		return { sampleRate: buffer.sampleRate, channels };
	} finally {
		await context.close();
	}
}

function audioContextConstructor(): (typeof AudioContext) | null {
	if (typeof window === 'undefined') return null;
	if (typeof window.AudioContext === 'function') return window.AudioContext;
	const host = window as Window & { webkitAudioContext?: unknown };
	if (typeof host.webkitAudioContext === 'function') {
		return host.webkitAudioContext as typeof AudioContext;
	}
	return null;
}

function writeAscii(bytes: Uint8Array, offset: number, text: string): void {
	for (let index = 0; index < text.length; index++) {
		bytes[offset + index] = text.charCodeAt(index);
	}
}
