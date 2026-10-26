# Bumpy

Bumpy is a local-first sidekick for Obsidian. The vault stays the source of truth, and notes stay ordinary Markdown. Proposed edits are shown first. Nothing is written until you apply or create the reviewed result.

These commands are available from the command palette:

| Command | What it does |
|---|---|
| **Open setup** | Opens setup steps for each provider. Buttons there fill settings, and Ollama can download a model |
| **Clean up** | Cleans the selection when text is selected, and the whole note when it is not. Previews the change before writing |
| **Clean up selection** / **Clean up note** | Cleans only the selection, or the whole note even when text is selected |
| **Dictate** | Records speech, lets you edit the transcript, then inserts it or sends it through cleanup |
| **Read selection** / **Read note** | Speaks the selection or the note |
| **Suggest links** / **Show related notes** | Suggests wikilinks and lists related notes and backlinks |
| **Capture task** | Turns a sentence into a Markdown task and asks when the date is ambiguous |
| **Show calendar** | Opens a month view of open tasks |
| **Sync calendar** | Compares dated tasks with Google Calendar after you supply a token |
| **Update vault index** / **Ask the vault** | Indexes notes, then answers from retrieved passages |
| **Research a topic** | Builds a research note from a search provider, with a preview before the note is created |
| **Daily briefing** / **Summarize journal** / **Trace thoughts** | Drafts a local briefing, journal digest, or timeline for you to create |
| **Find knowledge gaps** | Points at short sections, questions, and follow-up lines |
| **Suggest tasks** | Finds task phrases in the current note and adds only the ones you select |

## Setup

Step-by-step setup for every provider is in [docs/setup.md](docs/setup.md). The same page is inside Obsidian: run **Open setup**, or select **Open setup** at the top of **Settings → Bumpy**.

That page can select Ollama, LM Studio, local hashing, the app speech service, or SearXNG, and open the key page for a cloud provider. When Ollama is already running on this computer, **Download llama3.2** and **Download nomic-embed-text** ask Ollama to fetch those models. Bumpy only talks to the local Ollama app. Ollama then downloads the model from its own library.

## Provider

The provider at the top of **Settings → Bumpy** is the default. Cleanup, vault answers, research, and embeddings can each keep that default or use a provider of their own. Speech to text and text to speech choose their own provider in the Speech section.

| Provider | Usual URL |
|---|---|
| Ollama | `http://127.0.0.1:11434/v1` |
| LM Studio | `http://127.0.0.1:1234/v1` |
| OpenAI | `https://api.openai.com/v1` |
| Anthropic | `https://api.anthropic.com/v1` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Groq | `https://api.groq.com/openai/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Mistral | `https://api.mistral.ai/v1` |
| DeepSeek | `https://api.deepseek.com/v1` |
| xAI | `https://api.x.ai/v1` |
| Ultramarine | `https://api.paperinstruments.com/v1` |
| Backboard | `https://app.backboard.io/api` |

OpenAI, Anthropic, Gemini, Groq, OpenRouter, Mistral, DeepSeek, xAI, and Ultramarine use the OpenAI chat format. Backboard uses its own message API. Choosing a provider fills its usual URL and, when a list is known, a starting model from that list. A saved model that is not on the list stays available. Ollama, LM Studio, OpenRouter, and **Custom** keep the model name you type.

Ultramarine calls omit sampling fields and send reasoning effort `max`, which is that model’s recommended default. Its interpretation prompt is separate from the prompt used for other models. When a research response includes token usage, the note states the cost at the published rates: $0.15 per million uncached input tokens, $0.03 per million cached input tokens, and $0.50 per million output tokens, including reasoning. Ultramarine does not provide embeddings.

In **Settings → Bumpy**:

- **Provider**, **Provider URL**, **Model**, and **API key** are the default used by every feature set to **Same as default**.
- **Feature providers** gives Cleanup, Vault answers, Research, or Embeddings its own URL, model, and key. A feature uses its own key and does not reuse the default key.
- **API key** is optional for a local server. Cloud providers need their own keys. Keys stay on this device. They are not written into notes, and they are not part of the vault copy that syncs. OpenAI-compatible providers receive the key as a bearer token. Backboard receives it as `X-API-Key`.
- **Check connection** asks the default provider for its model list. **Check** on a feature does the same for that feature’s provider. The key is sent only in the request header.

Backboard does not store the note in Backboard memory, and it does not provide embeddings. Leave embeddings on **Local hashing**, or point **Embeddings** at a provider with an embeddings API. Note text is sent to the provider for that feature when you run cleanup, ask, or research.

Provider errors are redacted so they do not echo note text or an API key. Cancelling stops Bumpy from using the response. Obsidian’s request API cannot abort the underlying socket, so a cancelled request may still finish at the server.

## Vault instructions

`BUMPY.md` holds preferences for tone and formatting. Bumpy reads the vault-root file first, then each `BUMPY.md` from the vault root down to the note’s folder. A later file is more specific. Built-in safety rules stay first and cannot be replaced. The note body is treated as data, not as instructions.

An instruction file is skipped when it is empty, contains a null character, or is longer than 8,000 characters. The skipped text is not shown.

## Speech

**Speech to text** and **Text to speech** default to **App speech service**. Speech to text uses the recognizer built into the app. On desktop that recognizer can send microphone audio to its own service. Text to speech uses the app's speech synthesis.

The other choices are **OpenAI**, **Groq** (speech to text), **Grok**, **Gradium**, **Mistral**, **Deepgram** (speech to text), and **ElevenLabs** (text to speech). Each uses its own API key, stored on this device and not written into notes or the synced vault. OpenAI, Groq, Grok, and Deepgram receive the key as a bearer token. Deepgram’s live connection sends the key as a WebSocket protocol, not in the recording URL, and opts out of Deepgram’s model improvement program. Gradium uses `x-api-key`. Mistral speech to text also uses `x-api-key`, and Mistral reading uses a bearer token. ElevenLabs uses `xi-api-key`. Dictation can be cancelled, and the transcript can be edited before it is inserted or cleaned up. Cleaning a transcript uses the cleanup provider.

**Deepgram** is the choice for a noisy recording, or when you want the words to appear while you talk. It streams the microphone audio and shows a live transcript. The other cloud speech-to-text providers wait until you stop, then send the recording.

**Mistral** dictation uses `voxtral-mini-latest`. Mistral reading uses `voxtral-mini-tts-2603`. **List voices** loads the voices on that key before a note can be read aloud.

**ElevenLabs** is the choice for more natural reading. It uses the `eleven_v3` model and the George voice until you choose another. **List voices** asks Grok, Mistral, or ElevenLabs for the voices on that key and lets you pick one. Grok no longer has to stay on `eve`.

**Language** replaces automatic detection for Grok and Gradium. Automatic leaves Grok on `auto` and Gradium on `any`. A chosen language is also sent to Deepgram, ElevenLabs models that accept it (`eleven_v3`, Flash v2.5, Turbo v2.5), and the app recognizer. Gradium transcribes English, French, German, Spanish, and Portuguese. `eleven_multilingual_v2` does not take the language setting.

Gradium speech to text accepts Ogg or WAV. When this app records WebM, Bumpy converts it to 24 kHz mono WAV before sending it. Gradium can also read notes aloud.

## Call

The call board is a separate program in `voice/`. Obsidian does not open a call by itself. Turn on **Call bridge** and set a board address such as `https://127.0.0.1:8444`, plus the same token the board was started with. The address has to be localhost or a numeric address on the local network. Trust the board certificate on this computer before the bridge will connect. The board listens with HTTPS on both the call page and the bridge. It listens on this computer unless `VOICE_HOST` is set, for example to `0.0.0.0`, to open it to the local network.

Obsidian polls the board. The board does not connect in. A vault question, task list, or note read sends that text to the board, and the board sends it to the voice model configured there. That model may be a cloud service. File and script tools stay off until the board is given a file folder. A script receives the caller’s extra text as the `BUMPY_ARGUMENT` environment variable, not as another command word.

A spoken change opens one preview in Obsidian and replaces the whole note only after you apply it there, or say **apply** on the call. **Apply please** counts. If the preview has warnings, say **apply anyway**. Saying yes or ok does not write the note. Say **discard** to cancel, or close the preview. Other speech leaves the preview open. A note longer than 20,000 characters can be discussed from an excerpt and cannot be replaced on the call. The preview opens only when the board still has it, so saying apply and clicking **Apply** agree.

## Links, tasks, and calendar

**Excluded folders** are skipped for links, tasks, the index, and briefings. The default is `.trash`.

Suggested links skip existing links, code, and generic titles such as `readme`. Applying a link or a task checks that the note has not changed since the preview opened.

Tasks are ordinary Markdown lines, for example `- [ ] Pay rent 📅 2026-10-23`. Phrases such as “next week” or “soon” ask you to pick a date.

Reminders are in-app notices. They are checked when Obsidian loads and about once a minute after that. A task with a time is reminded at that time. A task with only a date uses the reminder hour. Each reminder fires once, including after a reload, while the task is still due within the last 36 hours. A note that could not be read does not clear that memory, so the same reminder is not sent again on the next scan. The fired list is stored on this device and is not written into notes.

**Computer notifications** is on by default. On the desktop app, the same reminder is also sent to Notification Center while Obsidian is open. It is shown by Obsidian, so the system permission belongs to Obsidian. Allow notifications for Obsidian if asked. The task title is the notification text. Nothing is sent while Obsidian is closed, and the mobile app keeps the in-app notice only.

**Show calendar** lists open tasks that are due today or earlier, then a month grid. Today is outlined. A task with a time shows that time. Select a task to open its note.

**Sync calendar** does nothing until **Google calendar ID** and **Google access token** are set. The token stays on this device and is not written into notes. An access token expires quickly. Add a **Google client ID**, **Google client secret**, and **Google refresh token** and sync renews it. Without those, an expired token asks you to paste a new one. If a step fails after you apply, the review stays open and a step that already finished is not repeated. A task with a time becomes a 30-minute event in the local time zone. A task with only a date stays an all-day event. Updating an event changes its title and time and leaves the rest of the event in place. Events that Bumpy did not create are left alone. A task that already has a linked event is not given a second event when that event is outside the checked range. When a linked task and its event have both changed, the review lists **Keep the note** and **Use the calendar**. A conflict with no choice is skipped.

## Vault questions

**Update vault index** stores passage vectors in `rag-index.json` next to the plugin, not in notes and not in the settings file. Changing a setting does not rewrite the index. Notes in excluded folders, notes longer than 200,000 characters, and notes with `bumpy-index: false` in frontmatter are left out of the index. Task lists, the calendar, and reminders still read those long notes. The index keeps up to 2,000 passages, prefers notes you changed more recently, and updates a note only when its text or the embedding setting changes. A note that does not fit is left out entirely. An unchanged note that did not fit is not embedded again until a seat opens. **Ask the vault** and the call ask you to update the index when the embedding model or URL no longer matches. Indexing does not run at startup. A note that opens with a horizontal rule is still indexed. Only a YAML block between the opening fences is treated as frontmatter.

**Embeddings** defaults to **Local hashing**. That mode stays on device and matches shared words. It is not a neural embedding model. **Provider embeddings** send passages to the embeddings provider’s `/embeddings` route with the embedding model you set. The list includes `nomic-embed-text`, OpenAI’s embedding models, and Mistral’s `mistral-embed`. Choosing Mistral for embeddings selects `mistral-embed`. When **Embeddings** is **Same as default**, that is the default provider URL. Changing the embeddings provider rebuilds passages the next time you update the index.

**Ask the vault** retrieves matching passages and, when the vault-answers model is set, asks that model to answer only from those passages. Passages from excluded folders or from notes that are no longer in the vault are skipped, even when an older index still contains them. Passages are treated as untrusted data. The answer lists source notes, and **Open note** jumps to one. **Insert** writes the answer only at the cursor you still have, and only if the note has not changed.

## Research

**Web search** stays **Off** until you choose a provider.

- **Searxng** uses the **Search URL**, for example `http://127.0.0.1:8080`.
- **Brave** uses `https://api.search.brave.com` and the **Search API key**. The key stays on this device and is sent as a header.
- **Tavily** uses `https://api.tavily.com/search` and the **Search API key**. The key stays on this device and is sent as a bearer token. The topic is sent as the search query. Each search is a basic search.
- **SerpAPI** uses `https://serpapi.com/search.json` and the **Search API key**. The key stays on this device. SerpAPI requires it as the `api_key` query parameter, so a failed search does not repeat the request URL. The topic is the query. Research cites only the organic results, and the request asks for those results only.

The research note cites only URLs returned by that search. A model may add an interpretation, which is labeled as AI-generated. URLs that were not in the search results are removed. If no model is set, the interpretation section says so. An existing note at the same path is left unchanged. When the research provider is Ultramarine and the response includes token usage, the note includes a **Run cost** section.

### Durable research

`agent/` researches a folder of Markdown notes with the OpenAI SDK and Ultramarine, inside a Temporal workflow. The folder read runs once. The model call is retried when the request fails in a way a later attempt can fix. If the client stops, the same workflow id resumes the run. The worker writes a draft file. It does not change a vault.

The key stays in the worker’s environment. It is not an argument to the workflow.

```bash
npm install --prefix agent
temporal server start-dev
```

In a second terminal, from this repository:

```bash
PAPERINSTRUMENTS_API_KEY=your-key npm run agent:worker
```

In a third:

```bash
npm run agent:research -- --dir "/path/to/notes" --topic "What should I follow up?"
```

The command prints the workflow id immediately. To wait for a run that was already started:

```bash
npm run agent:research -- --resume bumpy-research-topic-id
```

`TEMPORAL_ADDRESS` defaults to `localhost:7233`. The draft is written to `agent/out/latest.md` unless `--out` names another file.

## Briefings

**Daily briefing**, **Summarize journal**, and **Trace thoughts** are built on this device from tasks and note text. The journal uses **Journal folder** and **Journal days**. Thought traces connect notes that share words. Knowledge gaps are headings with little text, question lines, and lines that say to look something up. None of these write a note until you choose **Create note**. **Suggest tasks** adds only the selected lines, and asks you to pick a date when the phrase is ambiguous.

**Research this** on a gap uses the same research command. If web search is off, it asks you to turn search on and does not invent sources.

## Develop

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Rebuild `main.js` while you edit |
| `npm run build` | Typecheck and write a production `main.js` |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |

## Try it in a development vault

Create a separate vault in Obsidian and enable community plugins there. Do not install Bumpy into a vault that holds notes you cannot afford to change.

After `npm run dev` has produced `main.js`, link this repository into that vault. The folder name must match the plugin id `bumpy`:

```bash
mkdir -p "/path/to/dev-vault/.obsidian/plugins"
ln -s "$(pwd)" "/path/to/dev-vault/.obsidian/plugins/bumpy"
```

Reload Obsidian, then enable **Bumpy** under **Settings → Community plugins**.

If the development vault is a Git repository, ignore `.obsidian/plugins/bumpy/data.json` so API keys and the vault index are not committed.

Automated tests cover the note logic and the provider clients with stand-in HTTP. They do not open Obsidian, use a microphone, or call a live model, calendar, or search service.

## Site

The public page lives in `site/`. It is a static site styled like Obsidian's dark workspace. The pane beside the story plays the latest story film from `video/out`, and the other rendered films play from the Videos section when that folder is present.

```bash
npm install --prefix site
npm run site
```

`render.yaml` publishes that site on Render. Create a Blueprint from this repository. The build runs in `site/`, publishes `dist`, and Render serves the files from its CDN. Rendered videos are copied into the build only when `video/out` is available. There is no server to keep awake.

## License

The original sample plugin is copyright (C) 2020-2026 Dynalist Inc. Bumpy keeps those [0BSD](LICENSE) terms.
