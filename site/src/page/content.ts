import type { ChapterId } from "../film/chapters";

export const hero = {
	eyebrow: "Obsidian plugin",
	titleLead: "Notes stay",
	titleEm: "notes.",
	lede: "Bumpy is a local-first sidekick for Obsidian. The vault stays the source of truth, and notes stay ordinary Markdown. Proposed edits are shown first. Nothing is written until you apply or create the reviewed result.",
	filmNote:
		"The pane on the right plays the BUMPY launch video from YouTube. The product demo is under Videos.",
};

export const principles = [
	{
		title: "Preview first",
		text: "A change is shown before it is written.",
	},
	{
		title: "Ordinary Markdown",
		text: "Tasks, links, and answers stay notes.",
	},
	{
		title: "Local when you want",
		text: "Ollama, LM Studio, or hashing can stay on this computer.",
	},
];

export const story: Record<
	ChapterId,
	{ title: string; paragraphs: readonly string[] }
> = {
	opening: {
		title: "Notes stay notes.",
		paragraphs: [
			"The launch video plays in the pane beside this note.",
			"Commands live in the command palette. Setup can fill the provider, the URL, and a starting model. When Ollama is already running, it can download a model.",
		],
	},
	preview: {
		title: "A preview, then the pen.",
		paragraphs: [
			"Clean up revises the selection when text is selected, and the whole note when it is not. Clean up selection and Clean up note each do one of those on purpose.",
			"The preview opens before anything is written. Apply changes only the reviewed range in the active editor.",
		],
	},
	speech: {
		title: "Say it, then keep the words you want.",
		paragraphs: [
			"Dictate records, lets you edit the transcript, then inserts it or sends it through cleanup. Read selection and Read note speak the selection or the note.",
			"Speech starts on the app speech service, with no key. Deepgram shows words while you talk. ElevenLabs is there for a more natural reading voice.",
		],
	},
	links: {
		title: "The notes already know each other.",
		paragraphs: [
			"Suggest links proposes wikilinks. Show related notes lists related notes and backlinks. Suggestions skip links you already have, code, and generic titles such as readme.",
			"Applying a link checks that the note has not changed since the preview opened.",
		],
	},
	tasks: {
		title: "A sentence becomes a date.",
		paragraphs: [
			"Capture task turns a sentence into a Markdown task. Phrases such as “next week” or “soon” ask you to pick a date. The line is an ordinary task, for example - [ ] Pay rent 📅 2026-10-23.",
			"Show calendar opens a month of open tasks. Reminders are in-app notices, and on the desktop app they can also reach Notification Center while Obsidian is open. Sync calendar compares dated tasks with Google Calendar after you supply a token.",
		],
	},
	ask: {
		title: "Ask what the vault already wrote.",
		paragraphs: [
			"Update vault index stores passage vectors next to the plugin, not in the vault. Indexing does not run at startup. Ask the vault retrieves matching passages and, when a model is set, answers only from those passages.",
			"Embeddings default to local hashing. That mode stays on the device and matches shared words. It is not a neural model. The answer lists its source notes.",
		],
	},
	research: {
		title: "Outside sources stay cited.",
		paragraphs: [
			"Web search stays off until you choose SearXNG, Brave, Tavily, or SerpAPI. The research note cites only URLs that search returned. A model may add an interpretation, and that part is labeled AI-generated. When that model is Ultramarine, the note also records what the run cost.",
			"Daily briefing, Summarize journal, and Trace thoughts are built on this device. Find knowledge gaps points at short sections, questions, and follow-up lines. Nothing here writes a note until you choose Create note.",
		],
	},
	local: {
		title: "The model can live on this computer.",
		paragraphs: [
			"Ollama and LM Studio run here. Local hashing needs no download. SearXNG searches from a server you run. A local server can leave the API key empty.",
			"OpenAI, Anthropic, Gemini, Groq, OpenRouter, Mistral, DeepSeek, xAI, Ultramarine, and Backboard are available when you choose them. Each cloud provider needs its own key. Cleanup, vault answers, research, and embeddings can each use a different provider, and a feature uses its own key.",
		],
	},
	close: {
		title: "Then you decide.",
		paragraphs: [
			"BUMPY.md holds tone and formatting. Bumpy reads the vault-root file first, then each BUMPY.md down to the note's folder. A later file is more specific. Built-in safety rules stay first. The note body is treated as data, not as instructions.",
			"Cancelling stops Bumpy from using the response. Provider errors are redacted so they do not echo a note or a key.",
		],
	},
};

export const commandGroups = [
	{
		title: "Setup",
		commands: [
			{
				name: "Open setup",
				detail:
					"Opens setup steps for each provider. Buttons there fill settings, and Ollama can download a model.",
			},
		],
	},
	{
		title: "Writing",
		commands: [
			{
				name: "Clean up",
				detail:
					"Cleans the selection when text is selected, and the whole note when it is not. Previews the change before writing.",
			},
			{
				name: "Clean up selection",
				detail: "Cleans only the selection.",
			},
			{
				name: "Clean up note",
				detail: "Cleans the whole note, even when text is selected.",
			},
		],
	},
	{
		title: "Speech",
		commands: [
			{
				name: "Dictate",
				detail:
					"Records speech, lets you edit the transcript, then inserts it or sends it through cleanup.",
			},
			{
				name: "Read selection",
				detail: "Speaks the selection.",
			},
			{
				name: "Read note",
				detail: "Speaks the note.",
			},
		],
	},
	{
		title: "Links",
		commands: [
			{
				name: "Suggest links",
				detail: "Suggests wikilinks.",
			},
			{
				name: "Show related notes",
				detail: "Lists related notes and backlinks.",
			},
		],
	},
	{
		title: "Tasks and calendar",
		commands: [
			{
				name: "Capture task",
				detail:
					"Turns a sentence into a Markdown task and asks when the date is ambiguous.",
			},
			{
				name: "Show calendar",
				detail: "Opens a month view of open tasks.",
			},
			{
				name: "Sync calendar",
				detail:
					"Compares dated tasks with Google Calendar after you supply a token.",
			},
			{
				name: "Suggest tasks",
				detail:
					"Finds task phrases in the current note and adds only the ones you select.",
			},
		],
	},
	{
		title: "Vault",
		commands: [
			{
				name: "Update vault index",
				detail: "Indexes notes beside the plugin.",
			},
			{
				name: "Ask the vault",
				detail: "Answers from retrieved passages.",
			},
		],
	},
	{
		title: "Research and briefings",
		commands: [
			{
				name: "Research a topic",
				detail:
					"Builds a research note from a search provider, with a preview before the note is created.",
			},
			{
				name: "Daily briefing",
				detail: "Drafts a local briefing for you to create.",
			},
			{
				name: "Summarize journal",
				detail: "Drafts a journal digest from the journal folder and the journal days.",
			},
			{
				name: "Trace thoughts",
				detail: "Drafts a timeline of notes that share words.",
			},
			{
				name: "Find knowledge gaps",
				detail: "Points at short sections, questions, and follow-up lines.",
			},
		],
	},
] as const;

export const chatProviders = [
	{
		name: "Ollama",
		url: "http://127.0.0.1:11434/v1",
		model: "llama3.2",
		note: "Runs on this computer. Leave the key empty.",
	},
	{
		name: "LM Studio",
		url: "http://127.0.0.1:1234/v1",
		model: "The model you load",
		note: "Start the local server before checking the connection.",
	},
	{
		name: "Custom",
		url: "The base URL you paste",
		model: "The name you type",
		note: "Any server that speaks the OpenAI chat format, such as llama.cpp or vLLM.",
	},
	{
		name: "OpenAI",
		url: "https://api.openai.com/v1",
		model: "gpt-4o",
		note: "Bearer token.",
	},
	{
		name: "Anthropic",
		url: "https://api.anthropic.com/v1",
		model: "claude-sonnet-4-5",
		note: "OpenAI chat format.",
	},
	{
		name: "Gemini",
		url: "https://generativelanguage.googleapis.com/v1beta/openai",
		model: "gemini-3.8-flash",
		note: "OpenAI chat format.",
	},
	{
		name: "Groq",
		url: "https://api.groq.com/openai/v1",
		model: "llama-3.3-70b-versatile",
		note: "OpenAI chat format.",
	},
	{
		name: "OpenRouter",
		url: "https://openrouter.ai/api/v1",
		model: "The name you type",
		note: "A saved model that is not on the list stays available.",
	},
	{
		name: "Mistral",
		url: "https://api.mistral.ai/v1",
		model: "mistral-medium-latest",
		note: "Choosing Mistral for embeddings selects mistral-embed.",
	},
	{
		name: "DeepSeek",
		url: "https://api.deepseek.com/v1",
		model: "deepseek-chat",
		note: "OpenAI chat format.",
	},
	{
		name: "xAI",
		url: "https://api.x.ai/v1",
		model: "grok-4",
		note: "OpenAI chat format.",
	},
	{
		name: "Ultramarine",
		url: "https://api.paperinstruments.com/v1",
		model: "ultramarine-1-flash",
		note: "OpenAI chat format. Research notes record the token cost. It does not provide embeddings.",
	},
	{
		name: "Backboard",
		url: "https://app.backboard.io/api",
		model: "gpt-4o",
		note: "Uses its own message API and the X-API-Key header. It does not keep the note in Backboard memory, and it does not provide embeddings.",
	},
] as const;

export const speechChoices = [
	{
		name: "App speech service",
		detail:
			"The starting choice. Dictation uses the recognizer built into the app. On desktop, that recognizer can send microphone audio to its own service. Reading uses the app's speech synthesis.",
	},
	{
		name: "OpenAI",
		detail:
			"Dictation uses whisper-1. Reading uses tts-1 and the alloy voice. The speech key is separate from the chat key.",
	},
	{
		name: "Groq",
		detail:
			"Speech to text uses whisper-large-v3-turbo. Reading stays on the text-to-speech choice you already have.",
	},
	{
		name: "Grok",
		detail:
			"Dictation uses grok-voice-transcribe-2.0. Reading starts on the eve voice until you select List voices. Language can replace automatic detection.",
	},
	{
		name: "Gradium",
		detail:
			"Transcribes English, French, German, Spanish, and Portuguese. A WebM recording is converted to 24 kHz mono WAV. The key is sent as x-api-key. Gradium can also read notes aloud.",
	},
	{
		name: "Mistral",
		detail:
			"Dictation uses voxtral-mini-latest and sends the key as x-api-key. Reading uses voxtral-mini-tts-2603 and a bearer token. Select List voices before reading a note.",
	},
	{
		name: "Deepgram",
		detail:
			"The choice for a noisy recording, or when you want the words while you talk. Dictation uses nova-3 and shows a live transcript. The live connection sends the key as a WebSocket protocol and opts out of Deepgram's model improvement program.",
	},
	{
		name: "ElevenLabs",
		detail:
			"Reading uses eleven_v3 and the George voice until you choose another. The key is sent as xi-api-key. Dictation stays on the speech-to-text choice you already have. eleven_multilingual_v2 does not take the language setting.",
	},
] as const;

export const searchChoices = [
	{
		name: "Off",
		detail: "Web search stays off until you choose a provider. Research this on a gap then asks you to turn search on.",
	},
	{
		name: "SearXNG",
		detail:
			"Uses the search URL, for example http://127.0.0.1:8080. Allow JSON results. No search API key.",
	},
	{
		name: "Brave",
		detail:
			"Uses https://api.search.brave.com. The key stays on this device and is sent as a header.",
	},
	{
		name: "Tavily",
		detail:
			"Uses https://api.tavily.com/search. The key is sent as a bearer token. The topic is the query, and each search is a basic search.",
	},
	{
		name: "SerpAPI",
		detail:
			"Uses https://serpapi.com/search.json. The key is sent as the api_key query parameter. The topic is the query. Research cites only the organic results.",
	},
] as const;

export const specGroups = [
	{
		title: "How a change lands",
		items: [
			"Apply writes only the reviewed range in the active editor.",
			"Applying a link or a task checks that the note has not changed since the preview opened.",
			"Suggest tasks adds only the lines you select, and asks for a date when the phrase is ambiguous.",
			"An existing research note at the same path is left unchanged.",
			"Briefings, journal summaries, and thought traces write nothing until you choose Create note.",
			"Insert, on a vault answer, writes only at the cursor you still have, and only if the note has not changed.",
			"Cancelling stops Bumpy from using the response. Obsidian's request API cannot abort the underlying socket, so a cancelled request may still finish at the server.",
			"Provider errors are redacted so they do not echo note text or an API key.",
		],
	},
	{
		title: "Vault index",
		items: [
			"Passages are stored next to the plugin, not in the note.",
			"Excluded folders are skipped. The default is .trash. The same folders are skipped for links, tasks, and briefings.",
			"Notes longer than 200,000 characters are left out.",
			"A note with bumpy-index: false in frontmatter is left out.",
			"The index keeps up to 2,000 passages and updates a note only when its text or the embedding setting changes.",
			"Indexing does not run at startup.",
			"Passages from excluded folders, or from notes that are no longer in the vault, are skipped even when an older index still contains them.",
			"Passages are treated as untrusted data.",
			"Provider embeddings send passages to that provider's /embeddings route. The list includes nomic-embed-text, OpenAI embedding models, and Mistral's mistral-embed.",
			"Changing the embeddings provider rebuilds passages the next time you update the index.",
		],
	},
	{
		title: "Reminders",
		items: [
			"Reminders are checked when Obsidian loads and about once a minute after that.",
			"A task with a time is reminded at that time. A task with only a date uses the reminder hour.",
			"Each reminder fires once, including after a reload, while the task is still due within the last 36 hours.",
			"The fired list is stored in plugin data on this device and is not written into notes.",
			"Computer notifications are on by default. On the desktop app, the same reminder is also sent to Notification Center while Obsidian is open. It is shown by Obsidian, so the system permission belongs to Obsidian.",
			"The task title is the notification text. Nothing is sent while Obsidian is closed.",
			"The mobile app keeps the in-app notice only.",
		],
	},
	{
		title: "Google Calendar",
		items: [
			"Sync does nothing until a Google calendar ID and a Google access token are set.",
			"The token stays on this device and is not written into notes. A refresh token renews it when you sync.",
			"The usual calendar id is primary.",
			"A task with a time becomes a 30-minute event in the local time zone. A task with only a date stays an all-day event.",
			"Events that Bumpy did not create are left alone.",
			"A task that already has a linked event is not given a second event when that event is outside the checked range.",
			"When a linked task and its event have both changed, the review lists Keep the note and Use the calendar. A conflict with no choice is skipped.",
		],
	},
	{
		title: "Instructions",
		items: [
			"BUMPY.md holds preferences for tone and formatting.",
			"Bumpy reads the vault-root file first, then each BUMPY.md from the vault root down to the note's folder. A later file is more specific.",
			"Built-in safety rules stay first and cannot be replaced.",
			"The note body is treated as data, not as instructions.",
			"An instruction file is skipped when it is empty, contains a null character, or is longer than 8,000 characters. The skipped text is not shown.",
		],
	},
	{
		title: "Research rules",
		items: [
			"The research note cites only URLs returned by that search.",
			"URLs that were not in the search results are removed.",
			"A model may add an interpretation, which is labeled as AI-generated.",
			"If no model is set, the interpretation section says so.",
			"If web search is off, Research this on a gap asks you to turn search on and does not invent sources.",
			"Knowledge gaps are headings with little text, question lines, and lines that say to look something up.",
			"Thought traces connect notes that share words.",
			"The journal uses the Journal folder and Journal days settings.",
		],
	},
] as const;

export const setupSteps = [
	{
		title: "Enable Bumpy",
		text: "Install the plugin, reload Obsidian, and enable Bumpy under Settings → Community plugins. Use a vault you can afford to experiment in.",
	},
	{
		title: "Open setup",
		text: "Run Open setup, or select Open setup at the top of Settings → Bumpy. The same steps are written in docs/setup.md in the repository.",
	},
	{
		title: "Pick a provider",
		text: "Use Ollama, LM Studio, or local hashing to stay on this computer. Or open the key page for a cloud provider and paste the key. Check connection asks that provider for its model list. The key is sent only in the request header.",
	},
	{
		title: "Run one command",
		text: "Run Clean up on a note and read the preview. Apply when the reviewed range is the change you want.",
	},
] as const;

export const develop = [
	["npm run dev", "Rebuild main.js while you edit."],
	["npm run build", "Typecheck and write a production main.js."],
	["npm run lint", "Run ESLint."],
	["npm test", "Run unit tests. They use stand-in HTTP and do not open Obsidian or call a live service."],
] as const;

export const repoUrl = "https://github.com/im45145v/BUMPY";
