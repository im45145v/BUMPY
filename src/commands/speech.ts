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
import { synthesizeSpeech, transcribeAudio } from '../audio/openai-audio';
import { playAudioBytes } from '../audio/playback';
import { readAloud } from '../audio/speak';
import { selectionRange, type CleanupEditor } from '../notes/editor-apply';
import { resolveFeature } from '../providers/features';
import { obsidianHttp } from '../providers/obsidian-http';
import { usesBackboard } from '../providers/presets';
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
	const endpoint = resolveFeature(host.settings, 'speech');
	if (usesBackboard(endpoint.preset, endpoint.baseUrl)) {
		throw new ProviderError(
			'Backboard does not provide the audio API. Choose another speech provider, or use App speech service.',
		);
	}
	const bytes = await synthesizeSpeech(obsidianHttp, text, host.settings.speechVoice, {
		baseUrl: endpoint.baseUrl,
		apiKey: endpoint.apiKey,
		model: host.settings.speechModel,
		signal,
	});
	await playAudioBytes(bytes, signal);
}

function speechInput(host: CleanupHost): SpeechInputEngine {
	if (host.settings.speechInput === 'openai-audio') {
		const endpoint = resolveFeature(host.settings, 'speech');
		if (usesBackboard(endpoint.preset, endpoint.baseUrl)) {
			return {
				isSupported: () => true,
				listen: () =>
					Promise.reject(
						new ProviderError(
							'Backboard does not provide the audio API. Choose another speech provider, or use App speech service.',
						),
					),
			};
		}
		return createRecorderInput(new BrowserAudioRecorder(), (audio, mime, requestSignal) =>
			transcribeAudio(obsidianHttp, audio, mime, {
				baseUrl: endpoint.baseUrl,
				apiKey: endpoint.apiKey,
				model: host.settings.transcriptionModel,
				signal: requestSignal,
			}),
		);
	}
	return createWebSpeechInput(browserSpeechRecognition);
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
