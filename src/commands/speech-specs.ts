export const SPEECH_COMMANDS = [
	{ id: 'dictate', name: 'Dictate' },
	{ id: 'read-selection', name: 'Read selection aloud' },
	{ id: 'read-note', name: 'Read note aloud' },
] as const;

export const APP_SPEECH_LABEL = 'App speech service';

export const SPEECH_INPUT_DESC =
	'App speech service uses the recognizer built into the app. On desktop that recognizer can send microphone audio to its own service. OpenAI, Groq, Grok, and Gradium send the recording after you stop. Deepgram is for noisy recordings and shows words while you talk.';

export const SPEECH_OUTPUT_DESC =
	'App speech service uses the speech synthesis built into the app. OpenAI, Grok, and Gradium speak the text and play the audio they return. ElevenLabs is for more natural reading voices.';
