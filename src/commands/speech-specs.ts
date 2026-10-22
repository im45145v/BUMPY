export const SPEECH_COMMANDS = [
	{ id: 'dictate', name: 'Dictate' },
	{ id: 'read-selection', name: 'Read selection aloud' },
	{ id: 'read-note', name: 'Read note aloud' },
] as const;

export const APP_SPEECH_LABEL = 'App speech service';

export const SPEECH_INPUT_DESC =
	'App speech service uses the recognizer built into the app. On desktop that recognizer can send microphone audio to its own service. It does not use the provider URL. Provider audio API records audio and sends it to the provider URL.';

export const SPEECH_OUTPUT_DESC =
	"App speech service uses the speech synthesis built into the app. Provider audio API sends the text to the provider and plays the audio it returns.";
