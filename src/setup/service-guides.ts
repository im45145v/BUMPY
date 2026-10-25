import {
	SPEECH_MODELS,
	TRANSCRIPTION_MODELS,
} from '../audio/speech-catalog';
import { PROVIDER_PRESETS, type ProviderPreset } from '../providers/presets';
import type { SetupButton, SetupGuide } from './apply';

const CLOUD: ReadonlyArray<{
	preset: ProviderPreset;
	keyUrl: string;
	extra?: readonly string[];
}> = [
	{ preset: 'openai', keyUrl: 'https://platform.openai.com/api-keys' },
	{ preset: 'anthropic', keyUrl: 'https://console.anthropic.com/settings/keys' },
	{ preset: 'gemini', keyUrl: 'https://aistudio.google.com/apikey' },
	{ preset: 'groq', keyUrl: 'https://console.groq.com/keys' },
	{ preset: 'openrouter', keyUrl: 'https://openrouter.ai/keys' },
	{ preset: 'mistral', keyUrl: 'https://console.mistral.ai/api-keys' },
	{ preset: 'deepseek', keyUrl: 'https://platform.deepseek.com/api_keys' },
	{ preset: 'xai', keyUrl: 'https://console.x.ai/' },
	{
		preset: 'ultramarine',
		keyUrl: 'https://platform.paperinstruments.com/keys',
		extra: [
			'Ultramarine does not provide embeddings. Leave embeddings on local hashing, or point Embeddings at a provider with an embeddings API.',
			'Requests use reasoning effort max and omit sampling fields, so Ultramarine uses its recommended defaults. The interpretation prompt is separate from the prompt used for other models.',
			'When Ultramarine reports token usage, the research note states the run cost. Uncached input is $0.15 per million tokens, cached input is $0.03 per million tokens, and output, including reasoning, is $0.50 per million tokens.',
			'A durable run over a folder of notes lives in `agent/`. It calls Ultramarine with the OpenAI SDK inside a Temporal workflow. A failed model call is retried, and a stopped client can resume the same run. The worker writes a draft file and does not change the vault.',
		],
	},
	{
		preset: 'backboard',
		keyUrl: 'https://app.backboard.io',
		extra: [
			'Backboard does not keep the note in Backboard memory. For embeddings, use local hashing or a provider with an embeddings API.',
		],
	},
];

export const CHAT_GUIDES: readonly SetupGuide[] = CLOUD.map((entry) => chatGuide(entry));

export const SPEECH_GUIDES: readonly SetupGuide[] = [
	{
		id: 'app-speech',
		title: 'App speech service',
		group: 'Speech',
		summary:
			'Dictation and reading work without an API key. This is the starting choice.',
		steps: [
			'In **Settings → Bumpy**, set **Speech to text** and **Text to speech** to **App speech service**.',
			"On the desktop app, the recognizer can send microphone audio to the operating system's speech service. Reading uses the app's speech synthesis.",
			'Run **Dictate**, or **Read note**.',
		],
		buttons: [
			{
				label: 'Use app speech',
				detail: 'Sets speech to text and text to speech to the app speech service.',
				done: 'Speech is set to the app speech service.',
				run: {
					kind: 'apply',
					change: { speechInput: 'web-speech', speechOutput: 'web-speech' },
				},
			},
		],
	},
	speechGuide({
		id: 'openai-speech',
		title: 'OpenAI speech',
		keyUrl: 'https://platform.openai.com/api-keys',
		input: 'openai',
		output: 'openai',
		summary: 'Dictation and reading through OpenAI. The speech key is separate from the chat key. The same key can be pasted into both.',
		detail: `Dictation uses \`${modelName(TRANSCRIPTION_MODELS.openai, 'whisper-1')}\`. Reading uses \`${modelName(SPEECH_MODELS.openai, 'tts-1')}\` and the alloy voice.`,
	}),
	speechGuide({
		id: 'groq-speech',
		title: 'Groq speech',
		keyUrl: 'https://console.groq.com/keys',
		input: 'groq',
		summary: 'Speech to text through Groq. Reading stays on the text-to-speech choice you already have.',
		detail: `Dictation uses \`${modelName(TRANSCRIPTION_MODELS.groq, 'whisper-large-v3-turbo')}\`.`,
	}),
	speechGuide({
		id: 'grok-speech',
		title: 'Grok speech',
		keyUrl: 'https://console.x.ai/',
		input: 'grok',
		output: 'grok',
		summary: 'Dictation and reading through xAI. The speech key is the xAI key, stored in the Speech section.',
		detail: `Dictation uses \`${modelName(TRANSCRIPTION_MODELS.grok, 'grok-voice-transcribe-2.0')}\`. Reading starts on the eve voice until you select **List voices**. **Language** can replace automatic detection.`,
	}),
	speechGuide({
		id: 'gradium',
		title: 'Gradium',
		keyUrl: 'https://gradium.ai',
		input: 'gradium',
		output: 'gradium',
		summary:
			'Dictation and reading through Gradium. Gradium transcribes English, French, German, Spanish, and Portuguese. A WebM recording is converted to WAV before it is sent. The key is sent as `x-api-key`.',
		detail: 'A starting voice id is filled in. **Language** can replace automatic detection.',
	}),
	speechGuide({
		id: 'mistral-speech',
		title: 'Mistral speech',
		keyUrl: 'https://console.mistral.ai/api-keys',
		input: 'mistral',
		output: 'mistral',
		summary:
			'Dictation and reading through Mistral. Speech to text sends the key as `x-api-key`. Reading sends it as a bearer token.',
		detail: `Dictation uses \`${modelName(TRANSCRIPTION_MODELS.mistral, 'voxtral-mini-latest')}\`. Reading uses \`${modelName(SPEECH_MODELS.mistral, 'voxtral-mini-tts-2603')}\`. Select **List voices** before reading a note.`,
	}),
	speechGuide({
		id: 'deepgram',
		title: 'Deepgram',
		keyUrl: 'https://console.deepgram.com/',
		input: 'deepgram',
		summary:
			"Speech to text for a noisy recording, or when you want the words while you talk. The key is a bearer token. The live connection sends it as a WebSocket protocol and opts out of Deepgram's model improvement program.",
		detail: `Dictation uses \`${modelName(TRANSCRIPTION_MODELS.deepgram, 'nova-3')}\` and shows a live transcript.`,
	}),
	speechGuide({
		id: 'elevenlabs',
		title: 'ElevenLabs',
		keyUrl: 'https://elevenlabs.io/app/settings/api-keys',
		output: 'elevenlabs',
		summary: 'Reading through ElevenLabs. The key is sent as `xi-api-key`. Dictation stays on the speech-to-text choice you already have.',
		detail: `Reading uses \`${modelName(SPEECH_MODELS.elevenlabs, 'eleven_v3')}\` until you pick another model. Select **List voices** to choose a voice.`,
	}),
];

export const SEARCH_GUIDES: readonly SetupGuide[] = [
	{
		id: 'brave',
		title: 'Brave search',
		group: 'Search and calendar',
		summary: 'Brave Search API. The key stays on this device and is sent as a header. Research cites only URLs Brave returns.',
		steps: [
			'Create an API key on the [Brave key page](https://api.search.brave.com/app/keys).',
			'In **Settings → Bumpy**, set **Web search** to **Brave**.',
			'Paste the key into **Search API key**.',
			'Run **Research a topic**.',
		],
		buttons: [
			{
				label: 'Use Brave',
				detail: 'Sets web search to Brave. Paste the search API key after this.',
				done: 'Web search is set to Brave.',
				run: { kind: 'apply', change: { searchProvider: 'brave' } },
			},
			{
				label: 'Open key page',
				detail: 'Opens https://api.search.brave.com/app/keys.',
				done: 'Opened the Brave key page.',
				run: { kind: 'open', url: 'https://api.search.brave.com/app/keys' },
			},
		],
	},
	{
		id: 'tavily',
		title: 'Tavily',
		group: 'Search and calendar',
		summary:
			'Tavily search. The key stays on this device and is sent as a bearer token. The topic is the query, and each search is a basic search.',
		steps: [
			'Create an API key at [Tavily](https://app.tavily.com).',
			'In **Settings → Bumpy**, set **Web search** to **Tavily**.',
			'Paste the key into **Search API key**.',
			'Run **Research a topic**.',
		],
		buttons: [
			{
				label: 'Use Tavily',
				detail: 'Sets web search to Tavily. Paste the search API key after this.',
				done: 'Web search is set to Tavily.',
				run: { kind: 'apply', change: { searchProvider: 'tavily' } },
			},
			{
				label: 'Open key page',
				detail: 'Opens https://app.tavily.com.',
				done: 'Opened the Tavily key page.',
				run: { kind: 'open', url: 'https://app.tavily.com' },
			},
		],
	},
	{
		id: 'serpapi',
		title: 'SerpAPI',
		group: 'Search and calendar',
		summary:
			'SerpAPI Google results. The key stays on this device. SerpAPI requires it as the api_key query parameter, and a failed search does not repeat that URL. The topic is the query. Research cites only links in the organic results. The request asks SerpAPI for those results only.',
		steps: [
			'Create an API key on the [SerpAPI key page](https://serpapi.com/manage-api-key).',
			'In **Settings → Bumpy**, set **Web search** to **SerpAPI**.',
			'Paste the key into **Search API key**.',
			'Run **Research a topic**.',
		],
		buttons: [
			{
				label: 'Use SerpAPI',
				detail: 'Sets web search to SerpAPI. Paste the search API key after this.',
				done: 'Web search is set to SerpAPI.',
				run: { kind: 'apply', change: { searchProvider: 'serpapi' } },
			},
			{
				label: 'Open key page',
				detail: 'Opens https://serpapi.com/manage-api-key.',
				done: 'Opened the SerpAPI key page.',
				run: { kind: 'open', url: 'https://serpapi.com/manage-api-key' },
			},
		],
	},
	{
		id: 'google-calendar',
		title: 'Google Calendar',
		group: 'Search and calendar',
		summary:
			'Sync compares dated tasks with a Google calendar. Nothing is synced until a calendar ID and an access token are set. Bumpy does not refresh the token.',
		steps: [
			'In Google Cloud, enable the Google Calendar API and create an OAuth client.',
			'Open the [OAuth playground](https://developers.google.com/oauthplayground/) and authorize the scope `https://www.googleapis.com/auth/calendar`.',
			'Paste the access token into **Google access token**. It stays on this device and is not written into notes. Add a client ID, client secret, and refresh token if you want sync to renew it.',
			'Set **Google calendar ID**. The usual id is `primary`.',
			'Run **Sync calendar**. When the token expires, paste a new one.',
			'A task with a time becomes a 30-minute event in the local time zone. A task with only a date stays an all-day event. Events Bumpy did not create are left alone.',
		],
		buttons: [
			{
				label: 'Use primary calendar',
				detail: 'Sets the Google calendar ID to primary. Paste an access token before syncing.',
				done: 'Google calendar ID is primary.',
				run: { kind: 'apply', change: { googleCalendarId: 'primary' } },
			},
			{
				label: 'Open OAuth playground',
				detail: 'Opens https://developers.google.com/oauthplayground/.',
				done: 'Opened the OAuth playground.',
				run: { kind: 'open', url: 'https://developers.google.com/oauthplayground/' },
			},
		],
	},
];

function chatGuide(entry: (typeof CLOUD)[number]): SetupGuide {
	const chosen = PROVIDER_PRESETS[entry.preset];
	const label = chosen.label;
	const model = 'model' in chosen ? chosen.model : '';
	const modelSentence = model
		? `The starting model is \`${model}\`.`
		: 'Type the model name from your account.';
	return {
		id: entry.preset,
		title: label,
		group: 'Chat models',
		summary: `Cleanup, vault answers, and research can use ${label}. Note text is sent to ${label} when a command uses this provider.`,
		steps: [
			`Create an API key on the [${label} key page](${entry.keyUrl}).`,
			`In **Settings → Bumpy**, select **${label}**. The URL is set to \`${chosen.baseUrl}\`. ${modelSentence}`,
			'Paste the key into **API key**.',
			'Select **Check connection**.',
			...(entry.extra ?? []),
		],
		buttons: [
			{
				label: `Use ${label}`,
				detail: model
					? `Sets the provider to ${label}, fills \`${chosen.baseUrl}\`, and sets the model to \`${model}\`.`
					: `Sets the provider to ${label}, fills \`${chosen.baseUrl}\`, and keeps the model name already typed.`,
				done: `${label} is selected.`,
				run: { kind: 'apply', change: { preset: entry.preset } },
			},
			{
				label: 'Open key page',
				detail: `Opens ${entry.keyUrl}.`,
				done: `Opened the ${label} key page.`,
				run: { kind: 'open', url: entry.keyUrl },
			},
		],
	};
}

function speechGuide(entry: {
	id: string;
	title: string;
	keyUrl: string;
	summary: string;
	detail: string;
	input?: 'openai' | 'groq' | 'grok' | 'gradium' | 'mistral' | 'deepgram';
	output?: 'openai' | 'grok' | 'gradium' | 'mistral' | 'elevenlabs';
}): SetupGuide {
	const which =
		entry.input && entry.output
			? '**Speech to text** and **Text to speech**'
			: entry.input
				? '**Speech to text**'
				: '**Text to speech**';
	const tryCommand =
		entry.input && entry.output
			? 'Run **Dictate** or **Read note**.'
			: entry.input
				? 'Run **Dictate**.'
				: 'Run **Read note**.';
	const buttons: SetupButton[] = [
		{
			label: `Use ${entry.title}`,
			detail: entry.detail,
			done: `${entry.title} is selected.`,
			run: {
				kind: 'apply',
				change: {
					...(entry.input ? { speechInput: entry.input } : {}),
					...(entry.output ? { speechOutput: entry.output } : {}),
				},
			},
		},
		{
			label: 'Open key page',
			detail: `Opens ${entry.keyUrl}.`,
			done: `Opened the ${entry.title} key page.`,
			run: { kind: 'open', url: entry.keyUrl },
		},
	];
	return {
		id: entry.id,
		title: entry.title,
		group: 'Speech',
		summary: entry.summary,
		steps: [
			`Create an API key on the [${entry.title} key page](${entry.keyUrl}).`,
			`In **Settings → Bumpy**, under **Speech**, set ${which} to **${entry.title.replace(/ speech$/, '')}**.`,
			entry.detail,
			'Paste the key into the speech API key under **Speech**. That field is separate from the chat **API key**.',
			tryCommand,
		],
		buttons,
	};
}

function modelName(models: readonly string[] | undefined, fallback: string): string {
	return models?.[0] ?? fallback;
}
