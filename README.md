# Bumpy

Bumpy is a local-first sidekick for Obsidian. The vault stays the source of truth, and notes stay ordinary Markdown. Proposed edits are shown first. Nothing is written until you apply or create the reviewed result.

These commands are available from the command palette:

| Command | What it does |
|---|---|
| **Clean up selection** / **Clean up note** | Asks the model to revise the selection or the note, then previews the change |
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

Bumpy talks to one OpenAI-compatible endpoint. That covers a local server such as Ollama and a hosted API.

In **Settings → Bumpy**:

- **Provider** fills the usual URL for Ollama, LM Studio, or OpenAI. **Custom** leaves the URL as you typed it.
- **Provider URL** is the base URL, for example `http://127.0.0.1:11434/v1`.
- **Model** is the name that server expects.
- **API key** is optional. It is stored in this vault’s plugin data on this device and is not written into notes. Leave it empty for a local server that does not require one.
- **Check connection** asks the provider for its model list. The key is sent only in the request header.

Cleanup, answers, and research interpretation use that chat endpoint. Note text is sent only when you run one of those commands. Provider errors are redacted so they do not echo note text or the API key. Cancelling stops Bumpy from using the response. Obsidian’s request API cannot abort the underlying socket, so a cancelled request may still finish at the server.

## Vault instructions

`BUMPY.md` holds preferences for tone and formatting. Bumpy reads the vault-root file first, then each `BUMPY.md` from the vault root down to the note’s folder. A later file is more specific. Built-in safety rules stay first and cannot be replaced. The note body is treated as data, not as instructions.

An instruction file is skipped when it is empty, contains a null character, or is longer than 8,000 characters. The skipped text is not shown.

## Speech

**Speech to text** and **Text to speech** default to **On this device**, which uses the browser speech APIs and does not send audio or text to a provider.

**Provider audio API** sends audio to `{Provider URL}/audio/transcriptions` and text to `{Provider URL}/audio/speech`. The API key is sent as a header. Set the transcription model, speech model, and voice for that route. Dictation can be cancelled, and the transcript can be edited before it is inserted or cleaned up.

## Links, tasks, and calendar

**Excluded folders** are skipped for links, tasks, the index, and briefings. The default is `.trash`.

Suggested links skip existing links, code, and generic titles such as `readme`. Applying a link or a task checks that the note has not changed since the preview opened.

Tasks are ordinary Markdown lines, for example `- [ ] Pay rent 📅 2026-10-23`. Phrases such as “next week” or “soon” ask you to pick a date.

Reminders are in-app notices. They start about a minute after Obsidian loads, use the reminder hour when a task has no time, and fire once per session for tasks due within the last 36 hours. Bumpy does not use the operating system’s notification API.

**Sync calendar** does nothing until **Google calendar ID** and **Google access token** are set. The token is stored in plugin data and is not written into notes. Bumpy does not refresh the token. Events that Bumpy did not create are left alone. When a linked task and its event have both changed, the review lists **Keep the note** and **Use the calendar**. A conflict with no choice is skipped.

## Vault questions

**Update vault index** stores passage vectors in plugin data, not in the vault. Notes in excluded folders, notes longer than 200,000 characters, and notes with `bumpy-index: false` in frontmatter are left out. The index keeps up to 2,000 passages and updates a note only when its text or the embedding setting changes. Indexing does not run at startup.

**Embeddings** defaults to **Local hashing**. That mode stays on device and matches shared words. It is not a neural embedding model. **Provider embeddings** send passages to `{Provider URL}/embeddings` with the embedding model you set.

**Ask the vault** retrieves matching passages and, when a chat model is set, asks that model to answer only from those passages. Passages are treated as untrusted data. The answer lists source notes, and **Open note** jumps to one. **Insert** writes the answer only at the cursor you still have, and only if the note has not changed.

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
