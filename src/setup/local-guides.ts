import { PROVIDER_PRESETS } from '../providers/presets';
import type { SetupGuide } from './apply';
import {
	OLLAMA_CHAT_MODEL,
	OLLAMA_DOWNLOAD_URL,
	OLLAMA_EMBED_MODEL,
} from './ollama';

const OLLAMA_URL = PROVIDER_PRESETS.ollama.baseUrl;
const LM_STUDIO_URL = PROVIDER_PRESETS['lm-studio'].baseUrl;
const LM_STUDIO_DOWNLOAD = 'https://lmstudio.ai/';
export const SEARXNG_URL = 'http://127.0.0.1:8080';
export const SEARXNG_FORMATS = `search:
  formats:
    - html
    - json`;

const ollamaChat = {
	preset: 'ollama' as const,
	model: OLLAMA_CHAT_MODEL,
};

const ollamaEmbeddings = {
	embeddings: 'provider' as const,
	embeddingPreset: 'ollama' as const,
	embeddingModel: OLLAMA_EMBED_MODEL,
};

export const LOCAL_GUIDES: readonly SetupGuide[] = [
	{
		id: 'ollama',
		title: 'Ollama',
		group: 'Local',
		summary: 'Ollama runs a chat model on this computer. Leave the API key empty.',
		steps: [
			`Install [Ollama](${OLLAMA_DOWNLOAD_URL}) and open the app. On macOS or Windows, use the download. On Linux, run \`curl -fsSL https://ollama.com/install.sh | sh\`. Homebrew on macOS is \`brew install ollama\`.`,
			`In **Settings → Bumpy**, select **Ollama**. The URL becomes \`${OLLAMA_URL}\`.`,
			`Download a chat model, about 2 GB: \`ollama pull ${OLLAMA_CHAT_MODEL}\`. Set **Model** to \`${OLLAMA_CHAT_MODEL}\`.`,
			'Select **Check connection**. The list should include that model.',
			'Run **Clean up** on a note. The note text goes to Ollama on this computer.',
		],
		buttons: [
			{
				label: 'Use Ollama',
				detail: `Sets the provider to Ollama, the URL to \`${OLLAMA_URL}\`, and the model to \`${OLLAMA_CHAT_MODEL}\`.`,
				done: 'Ollama is selected.',
				run: { kind: 'apply', change: ollamaChat },
			},
			{
				label: `Download ${OLLAMA_CHAT_MODEL}`,
				detail: `Selects Ollama and asks the Ollama app on this computer to download \`${OLLAMA_CHAT_MODEL}\`. Ollama then fetches the model from its own library. About 2 GB.`,
				done: 'Ollama is selected.',
				run: { kind: 'pull', model: OLLAMA_CHAT_MODEL, change: ollamaChat },
			},
			{
				label: 'Use the installed model',
				detail: `Selects Ollama and uses \`${OLLAMA_CHAT_MODEL}\` when it is installed. Otherwise it uses the first model Ollama lists.`,
				done: 'Ollama is selected.',
				run: { kind: 'detect-chat', prefer: OLLAMA_CHAT_MODEL, change: { preset: 'ollama' } },
			},
			{
				label: 'Copy install command',
				detail:
					'Copies the Homebrew command on macOS, the Linux install script, or the download address on Windows and mobile.',
				done: 'Copied the install command.',
				run: { kind: 'copy-install' },
			},
			{
				label: 'Open download page',
				detail: `Opens ${OLLAMA_DOWNLOAD_URL}.`,
				done: 'Opened the Ollama download page.',
				run: { kind: 'open', url: OLLAMA_DOWNLOAD_URL },
			},
		],
	},
	{
		id: 'lm-studio',
		title: 'LM Studio',
		group: 'Local',
		summary:
			'LM Studio serves a model you load in the app. Leave the API key empty. Start the local server before checking the connection.',
		steps: [
			`Download [LM Studio](${LM_STUDIO_DOWNLOAD}) and open it.`,
			'Download a chat model in LM Studio and load it.',
			`Open the developer page and start the local server. The usual address is \`${LM_STUDIO_URL}\`.`,
			'In **Settings → Bumpy**, select **LM Studio**. Leave **API key** empty.',
			'Select **Use the loaded model** on the setup page, or type the model id LM Studio shows.',
			'Select **Check connection**.',
			'To embed notes, load an embedding model in LM Studio, keep the server running, and select **Use LM Studio for embeddings**.',
		],
		buttons: [
			{
				label: 'Use LM Studio',
				detail: `Sets the provider to LM Studio and the URL to \`${LM_STUDIO_URL}\`. The model name stays as you typed it.`,
				done: 'LM Studio is selected.',
				run: { kind: 'apply', change: { preset: 'lm-studio' } },
			},
			{
				label: 'Use the loaded model',
				detail: 'Asks LM Studio for its loaded models and selects the first one.',
				done: 'LM Studio is selected.',
				run: { kind: 'detect-chat', prefer: '', change: { preset: 'lm-studio' } },
			},
			{
				label: 'Use LM Studio for embeddings',
				detail:
					'Points embeddings at LM Studio and selects a loaded model whose name contains "embed". The chat provider stays as it is.',
				done: 'Embeddings will use LM Studio.',
				run: {
					kind: 'detect-embedding',
					prefer: OLLAMA_EMBED_MODEL,
					change: { embeddings: 'provider', embeddingPreset: 'lm-studio' },
				},
			},
			{
				label: 'Open download page',
				detail: `Opens ${LM_STUDIO_DOWNLOAD}.`,
				done: 'Opened the LM Studio download page.',
				run: { kind: 'open', url: LM_STUDIO_DOWNLOAD },
			},
		],
	},
	{
		id: 'local-server',
		title: 'Another local server',
		group: 'Local',
		summary:
			'Any server that speaks the OpenAI chat format can be the provider. llama.cpp and vLLM are typical examples.',
		steps: [
			'Start the server on this computer.',
			'In **Settings → Bumpy**, select **Custom**. The URL and model you already typed stay in place.',
			'Paste the base URL. Include `/v1` when the server uses that path.',
			'Type the model name the server expects.',
			'Leave **API key** empty unless that server requires one.',
			'Select **Check connection**.',
		],
		buttons: [
			{
				label: 'Use Custom',
				detail: 'Sets the provider to Custom and keeps the URL and model already typed.',
				done: 'Custom is selected.',
				run: { kind: 'apply', change: { preset: 'custom' } },
			},
		],
	},
	{
		id: 'local-embeddings',
		title: 'Local hashing',
		group: 'Local',
		summary:
			'Vault answers can stay on this computer with no model download. Matching uses shared words. Passages are stored next to the plugin, not in the note.',
		steps: [
			'In **Settings → Bumpy**, set **Embeddings** to **Local hashing**.',
			'Run **Update vault index**, then **Ask the vault**.',
			'A written answer still uses the vault-answers chat model when one is set. The passages themselves are not sent anywhere in this mode.',
		],
		buttons: [
			{
				label: 'Use local hashing',
				detail: 'Sets embeddings to local hashing. The chat provider stays as it is.',
				done: 'Embeddings are set to local hashing.',
				run: { kind: 'apply', change: { embeddings: 'local' } },
			},
		],
	},
	{
		id: 'ollama-embeddings',
		title: 'Ollama embeddings',
		group: 'Local',
		summary: `\`nomic-embed-text\` is a small embedding model for Ollama, about 274 MB. Passages are sent to Ollama on this computer. The chat provider can stay on something else.`,
		steps: [
			`Install Ollama and open it, the same way as for chat.`,
			`Download the embedding model: \`ollama pull ${OLLAMA_EMBED_MODEL}\`.`,
			'Set **Embeddings** to **Provider embeddings**.',
			`Set the **Embeddings** feature provider to **Ollama**, and **Embedding model** to \`${OLLAMA_EMBED_MODEL}\`.`,
			'Run **Update vault index**. The next index rebuilds passages with that model.',
		],
		buttons: [
			{
				label: 'Use Ollama embeddings',
				detail: `Points embeddings at Ollama and sets the model to \`${OLLAMA_EMBED_MODEL}\`. The chat provider stays as it is.`,
				done: 'Embeddings will use Ollama.',
				run: { kind: 'apply', change: ollamaEmbeddings },
			},
			{
				label: `Download ${OLLAMA_EMBED_MODEL}`,
				detail: `Selects Ollama for embeddings and asks the local Ollama app to download \`${OLLAMA_EMBED_MODEL}\`. The chat provider stays as it is.`,
				done: 'Embeddings will use Ollama.',
				run: { kind: 'pull', model: OLLAMA_EMBED_MODEL, change: ollamaEmbeddings },
			},
		],
	},
	{
		id: 'searxng',
		title: 'SearXNG',
		group: 'Local',
		summary:
			'SearXNG is a search engine you run yourself. Research cites only URLs it returns. No search API key is required.',
		steps: [
			`Install SearXNG and start it. The [Docker guide](https://docs.searxng.org/admin/installation-docker.html) is the usual path. A common address is \`${SEARXNG_URL}\`.`,
			'Allow JSON results. In `settings.yml`, under `search.formats`, include `json` as well as `html`. Bumpy requests `format=json`.',
			`In **Settings → Bumpy**, set **Web search** to **Searxng** and **Search URL** to that address.`,
			'Run **Research a topic**.',
		],
		example: { language: 'yaml', text: SEARXNG_FORMATS },
		buttons: [
			{
				label: 'Use SearXNG',
				detail: `Sets web search to Searxng and the search URL to \`${SEARXNG_URL}\`.`,
				done: `Web search is set to Searxng at ${SEARXNG_URL}.`,
				run: {
					kind: 'apply',
					change: { searchProvider: 'searxng', searchUrl: SEARXNG_URL },
				},
			},
			{
				label: 'Copy JSON format',
				detail: 'Copies the settings.yml block that allows JSON results.',
				done: 'Copied the SearXNG formats.',
				run: { kind: 'copy', text: SEARXNG_FORMATS },
			},
		],
	},
];
