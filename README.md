# Bumpy

Bumpy is a local-first sidekick for Obsidian. The vault stays the source of truth, and notes stay ordinary Markdown. Proposed edits are shown first. Nothing is written until you apply or create the reviewed result.

These commands are available from the command palette:

| Command | What it does |
|---|---|
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
| Backboard | `https://app.backboard.io/api` |

OpenAI, Anthropic, Gemini, Groq, OpenRouter, Mistral, DeepSeek, and xAI use the OpenAI chat format. Backboard uses its own message API. Choosing a provider fills its usual URL. Gemini, Groq, and Backboard also fill a starting model. **Custom** leaves the URL as you typed it. Set the model name the provider expects when no starting model is filled.

In **Settings → Bumpy**:

- **Provider**, **Provider URL**, **Model**, and **API key** are the default used by every feature set to **Same as default**.
- **Feature providers** gives Cleanup, Vault answers, Research, or Embeddings its own URL, model, and key. A feature uses its own key and does not reuse the default key.
- **API key** is optional for a local server. Cloud providers need their own keys. Keys are stored in this vault’s plugin data on this device and are not written into notes. OpenAI-compatible providers receive the key as a bearer token. Backboard receives it as `X-API-Key`.
- **Check connection** asks the default provider for its model list. **Check** on a feature does the same for that feature’s provider. The key is sent only in the request header.

Backboard does not store the note in Backboard memory, and it does not provide embeddings. Leave embeddings on **Local hashing**, or point **Embeddings** at a provider with an embeddings API. Note text is sent to the provider for that feature when you run cleanup, ask, or research.

Provider errors are redacted so they do not echo note text or an API key. Cancelling stops Bumpy from using the response. Obsidian’s request API cannot abort the underlying socket, so a cancelled request may still finish at the server.

## Vault instructions

`BUMPY.md` holds preferences for tone and formatting. Bumpy reads the vault-root file first, then each `BUMPY.md` from the vault root down to the note’s folder. A later file is more specific. Built-in safety rules stay first and cannot be replaced. The note body is treated as data, not as instructions.

An instruction file is skipped when it is empty, contains a null character, or is longer than 8,000 characters. The skipped text is not shown.

## Speech

**Speech to text** and **Text to speech** default to **App speech service**. Speech to text uses the recognizer built into the app. On desktop that recognizer can send microphone audio to its own service. Text to speech uses the app's speech synthesis.

The other choices are **OpenAI**, **Groq** (speech to text), **Grok**, **Gradium**, **Deepgram** (speech to text), and **ElevenLabs** (text to speech). Each uses its own API key, stored in plugin data on this device and not written into notes. OpenAI, Groq, Grok, and Deepgram receive the key as a bearer token. Deepgram’s live connection sends the key as a WebSocket protocol, not in the recording URL, and opts out of Deepgram’s model improvement program. Gradium uses `x-api-key`. ElevenLabs uses `xi-api-key`. Dictation can be cancelled, and the transcript can be edited before it is inserted or cleaned up. Cleaning a transcript uses the cleanup provider.

**Deepgram** is the choice for a noisy recording, or when you want the words to appear while you talk. It streams the microphone audio and shows a live transcript. The other cloud speech-to-text providers wait until you stop, then send the recording.

**ElevenLabs** is the choice for more natural reading. It uses the `eleven_v3` model and the George voice until you choose another. **List voices** asks Grok or ElevenLabs for the voices on that key and lets you pick one. Grok no longer has to stay on `eve`.

**Language** replaces automatic detection for Grok and Gradium. Automatic leaves Grok on `auto` and Gradium on `any`. A chosen language is also sent to Deepgram, ElevenLabs models that accept it (`eleven_v3`, Flash v2.5, Turbo v2.5), and the app recognizer. Gradium transcribes English, French, German, Spanish, and Portuguese. `eleven_multilingual_v2` does not take the language setting.

Gradium speech to text needs an Ogg recording. When this app can only record WebM, choose OpenAI, Groq, Grok, or Deepgram for dictation. Gradium can still read notes aloud.

## Links, tasks, and calendar

**Excluded folders** are skipped for links, tasks, the index, and briefings. The default is `.trash`.

Suggested links skip existing links, code, and generic titles such as `readme`. Applying a link or a task checks that the note has not changed since the preview opened.

Tasks are ordinary Markdown lines, for example `- [ ] Pay rent 📅 2026-10-23`. Phrases such as “next week” or “soon” ask you to pick a date.

Reminders are in-app notices. They are checked when Obsidian loads and about once a minute after that. A task with a time is reminded at that time. A task with only a date uses the reminder hour. Each reminder fires once, including after a reload, while the task is still due within the last 36 hours. The fired list is stored in plugin data on this device and is not written into notes. Bumpy does not use the operating system’s notification API.

**Show calendar** lists open tasks that are due today or earlier, then a month grid. Today is outlined. A task with a time shows that time. Select a task to open its note.

**Sync calendar** does nothing until **Google calendar ID** and **Google access token** are set. The token is stored in plugin data and is not written into notes. Bumpy does not refresh the token. A task with a time becomes a 30-minute event in the local time zone. A task with only a date stays an all-day event. Events that Bumpy did not create are left alone. A task that already has a linked event is not given a second event when that event is outside the checked range. When a linked task and its event have both changed, the review lists **Keep the note** and **Use the calendar**. A conflict with no choice is skipped.

## Vault questions

**Update vault index** stores passage vectors in plugin data, not in the vault. Notes in excluded folders, notes longer than 200,000 characters, and notes with `bumpy-index: false` in frontmatter are left out. The index keeps up to 2,000 passages and updates a note only when its text or the embedding setting changes. Indexing does not run at startup.

**Embeddings** defaults to **Local hashing**. That mode stays on device and matches shared words. It is not a neural embedding model. **Provider embeddings** send passages to the embeddings provider’s `/embeddings` route with the embedding model you set. When **Embeddings** is **Same as default**, that is the default provider URL. Changing the embeddings provider rebuilds passages the next time you update the index.

**Ask the vault** retrieves matching passages and, when the vault-answers model is set, asks that model to answer only from those passages. Passages from excluded folders or from notes that are no longer in the vault are skipped, even when an older index still contains them. Passages are treated as untrusted data. The answer lists source notes, and **Open note** jumps to one. **Insert** writes the answer only at the cursor you still have, and only if the note has not changed.

## Research

**Web search** stays **Off** until you choose a provider.

- **Searxng** uses the **Search URL**, for example `http://127.0.0.1:8080`.
- **Brave** uses `https://api.search.brave.com` and the **Search API key**. The key is stored in plugin data and sent as a header.

The research note cites only URLs returned by that search. A model may add an interpretation, which is labeled as AI-generated. URLs that were not in the search results are removed. If no model is set, the interpretation section says so. An existing note at the same path is left unchanged.

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

## License

The original sample plugin is copyright (C) 2020-2026 Dynalist Inc. Bumpy keeps those [0BSD](LICENSE) terms.
