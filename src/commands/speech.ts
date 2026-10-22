import { Notice, type Plugin } from 'obsidian';
import { captureTranscript } from '../audio/capture';
import {
	BrowserAudioRecorder,
	browserSpeechRecognition,
	createRecorderInput,
	createWebSpeechInput,
	localSpeechSupported,
	speakWithWebSpeech,
	type SpeechInputEngine,
} from '../audio/engines';
import { synthesizeCloud, transcribeCloud } from '../audio/cloud-speech';
import { browserDeepgramInput } from '../audio/deepgram-audio';
import { GRADIUM_RECORDING_TYPES } from '../audio/gradium-audio';
import { deepgramLanguage, webSpeechLanguage } from '../audio/languages';
import { playAudioBytes } from '../audio/playback';
import { readAloud } from '../audio/speak';
import { selectionRange, type CleanupEditor } from '../notes/editor-apply';
import { obsidianHttp } from '../providers/obsidian-http';
import { ProviderError } from '../providers/types';
import { cancelOnClick } from '../requests/dismiss';
import { DictateModal } from '../ui/dictate-modal';
import type { CleanupHost } from './cleanup';
import { SPEECH_COMMANDS } from './speech-specs';

export function registerSpeechCommands(
	plugin: CleanupHost & Pick<Plugin, 'addCommand'>,
): void {
	plugin.addCommand({
		id: SPEECH_COMMANDS[0].id,
		name: SPEECH_COMMANDS[0].name,
		editorCallback: (editor: CleanupEditor) => {
			const controller = plugin.requests.start();
			const modal = new DictateModal(
				plugin.app,
				plugin,
				editor,
				(request) =>
					captureTranscript({
						...request,
						engine: speechInput(plugin),
					}),
				controller,
				() => plugin.requests.finish(controller),
			);
			modal.open();
		},
	});

	plugin.addCommand({
		id: SPEECH_COMMANDS[1].id,
		name: SPEECH_COMMANDS[1].name,
		editorCheckCallback: (checking: boolean, editor: CleanupEditor) => {
			if (!selectionRange(editor)) return false;
			if (!checking) void runRead(plugin, editor, 'selection');
			return true;
		},
	});

	plugin.addCommand({
		id: SPEECH_COMMANDS[2].id,
		name: SPEECH_COMMANDS[2].name,
		editorCheckCallback: (checking: boolean, editor: CleanupEditor) => {
			if (editor.getValue().trim() === '') return false;
			if (!checking) void runRead(plugin, editor, 'note');
			return true;
		},
	});
}

async function runRead(
	host: CleanupHost,
	editor: CleanupEditor,
	mode: 'selection' | 'note',
): Promise<void> {
	const text =
		mode === 'note'
			? editor.getValue()
			: editor.getRange(
					selectionRange(editor)?.from ?? { line: 0, ch: 0 },
					selectionRange(editor)?.to ?? { line: 0, ch: 0 },
				);
	const controller = host.requests.start();
	const pending = readingNotice(controller);
	const notice = new Notice(pending.fragment, 0);
	const surface =
		pending.button.parentElement?.parentElement ??
		pending.button.parentElement ??
		pending.button;
	const release = cancelOnClick(surface, controller);
	try {
		const outcome = await readAloud({
			text,
			signal: controller.signal,
			speak: (value, signal) => speakText(host, value, signal),
		});
		if (!outcome.ok && !controller.signal.aborted) new Notice(outcome.message);
	} finally {
		release();
		notice.hide();
		host.requests.finish(controller);
	}
}

async function speakText(
	host: CleanupHost,
	text: string,
	signal: AbortSignal,
): Promise<void> {
	if (host.settings.speechOutput === 'web-speech') {
		if (!localSpeechSupported()) {
			throw new Error('Speech synthesis is not available in this app.');
		}
		await speakWithWebSpeech(text, signal);
		return;
	}
	const spoken = await synthesizeCloud(host.settings, text, signal, obsidianHttp);
	await playAudioBytes(spoken.bytes, signal, spoken.mime);
}

function speechInput(host: CleanupHost): SpeechInputEngine {
	if (host.settings.speechInput === 'web-speech') {
		const automatic =
			typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';
		return createWebSpeechInput(
			browserSpeechRecognition,
			webSpeechLanguage(host.settings.speechLanguage, automatic),
		);
	}
	if (host.settings.speechInput === 'deepgram') {
		return browserDeepgramInput(
			host.settings.speechKeys.deepgram,
			host.settings.transcriptionModel,
			deepgramLanguage(host.settings.speechLanguage),
		);
	}
	const mime = host.settings.speechInput === 'gradium' ? gradiumRecordingMime() : '';
	if (host.settings.speechInput === 'gradium' && mime === '') {
		return {
			isSupported: () => true,
			listen: () =>
				Promise.reject(
					new ProviderError(
						'Gradium cannot transcribe the recording format from this app. Choose OpenAI, Groq, Grok, or Deepgram for speech to text.',
					),
				),
		};
	}
	return createRecorderInput(new BrowserAudioRecorder(mime), (audio, recordedMime, requestSignal) =>
		transcribeCloud(host.settings, audio, recordedMime, requestSignal, obsidianHttp),
	);
}

function gradiumRecordingMime(): string {
	if (typeof MediaRecorder === 'undefined') return '';
	return GRADIUM_RECORDING_TYPES.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? '';
}

function readingNotice(controller: AbortController): {
	fragment: DocumentFragment;
	button: HTMLButtonElement;
} {
	const fragment = createFragment();
	fragment.createSpan({ text: 'Reading aloud… ' });
	const button = fragment.createEl('button', {
		text: 'Cancel',
		cls: 'bumpy-notice-cancel',
	});
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		controller.abort();
	});
	return { fragment, button };
}
