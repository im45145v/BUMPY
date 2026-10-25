# Set up Bumpy

These are the steps for each model Bumpy can use. In Obsidian, open the command palette and run **Open setup**, or select **Open setup** at the top of **Settings → Bumpy**. Buttons on that page fill the settings. When Ollama is already running, a button can ask it to download a model.

A local server has to be running on the same computer as this copy of Obsidian. Note text is sent only when you run a command, and only to the provider that command uses. Keys stay on this device. They are not written into notes or the synced vault.

The provider at the top of **Settings → Bumpy** is the default. Cleanup, vault answers, research, and embeddings can each use a different provider under **Feature providers**. Speech keeps its own keys.

## Local

Ollama and LM Studio run models on this computer. Local hashing answers from the vault without a model download. SearXNG searches the web from a server you run.

### Ollama

Ollama runs a chat model on this computer. Leave the API key empty.

1. Install [Ollama](https://ollama.com/download) and open the app. On macOS or Windows, use the download. On Linux, run `curl -fsSL https://ollama.com/install.sh | sh`. Homebrew on macOS is `brew install ollama`.
2. In **Settings → Bumpy**, select **Ollama**. The URL becomes `http://127.0.0.1:11434/v1`.
3. Download a chat model, about 2 GB: `ollama pull llama3.2`. Set **Model** to `llama3.2`.
4. Select **Check connection**. The list should include that model.
5. Run **Clean up** on a note. The note text goes to Ollama on this computer.

On the setup page:
- **Use Ollama.** Sets the provider to Ollama, the URL to `http://127.0.0.1:11434/v1`, and the model to `llama3.2`.
- **Download llama3.2.** Selects Ollama and asks the Ollama app on this computer to download `llama3.2`. Ollama then fetches the model from its own library. About 2 GB.
- **Use the installed model.** Selects Ollama and uses `llama3.2` when it is installed. Otherwise it uses the first model Ollama lists.
- **Copy install command.** Copies the Homebrew command on macOS, the Linux install script, or the download address on Windows and mobile.
- **Open download page.** Opens https://ollama.com/download.

### LM Studio

LM Studio serves a model you load in the app. Leave the API key empty. Start the local server before checking the connection.

1. Download [LM Studio](https://lmstudio.ai/) and open it.
2. Download a chat model in LM Studio and load it.
3. Open the developer page and start the local server. The usual address is `http://127.0.0.1:1234/v1`.
4. In **Settings → Bumpy**, select **LM Studio**. Leave **API key** empty.
5. Select **Use the loaded model** on the setup page, or type the model id LM Studio shows.
6. Select **Check connection**.
7. To embed notes, load an embedding model in LM Studio, keep the server running, and select **Use LM Studio for embeddings**.

On the setup page:
- **Use LM Studio.** Sets the provider to LM Studio and the URL to `http://127.0.0.1:1234/v1`. The model name stays as you typed it.
- **Use the loaded model.** Asks LM Studio for its loaded models and selects the first one.
- **Use LM Studio for embeddings.** Points embeddings at LM Studio and selects a loaded model whose name contains "embed". The chat provider stays as it is.
- **Open download page.** Opens https://lmstudio.ai/.

### Another local server

Any server that speaks the OpenAI chat format can be the provider. llama.cpp and vLLM are typical examples.

1. Start the server on this computer.
2. In **Settings → Bumpy**, select **Custom**. The URL and model you already typed stay in place.
3. Paste the base URL. Include `/v1` when the server uses that path.
4. Type the model name the server expects.
5. Leave **API key** empty unless that server requires one.
6. Select **Check connection**.

On the setup page:
- **Use Custom.** Sets the provider to Custom and keeps the URL and model already typed.

### Local hashing

Vault answers can stay on this computer with no model download. Matching uses shared words. Passages are stored next to the plugin, not in the note.

1. In **Settings → Bumpy**, set **Embeddings** to **Local hashing**.
2. Run **Update vault index**, then **Ask the vault**.
3. A written answer still uses the vault-answers chat model when one is set. The passages themselves are not sent anywhere in this mode.

On the setup page:
- **Use local hashing.** Sets embeddings to local hashing. The chat provider stays as it is.

### Ollama embeddings

`nomic-embed-text` is a small embedding model for Ollama, about 274 MB. Passages are sent to Ollama on this computer. The chat provider can stay on something else.

1. Install Ollama and open it, the same way as for chat.
2. Download the embedding model: `ollama pull nomic-embed-text`.
3. Set **Embeddings** to **Provider embeddings**.
4. Set the **Embeddings** feature provider to **Ollama**, and **Embedding model** to `nomic-embed-text`.
5. Run **Update vault index**. The next index rebuilds passages with that model.

On the setup page:
- **Use Ollama embeddings.** Points embeddings at Ollama and sets the model to `nomic-embed-text`. The chat provider stays as it is.
- **Download nomic-embed-text.** Selects Ollama for embeddings and asks the local Ollama app to download `nomic-embed-text`. The chat provider stays as it is.

### SearXNG

SearXNG is a search engine you run yourself. Research cites only URLs it returns. No search API key is required.

1. Install SearXNG and start it. The [Docker guide](https://docs.searxng.org/admin/installation-docker.html) is the usual path. A common address is `http://127.0.0.1:8080`.
2. Allow JSON results. In `settings.yml`, under `search.formats`, include `json` as well as `html`. Bumpy requests `format=json`.
3. In **Settings → Bumpy**, set **Web search** to **Searxng** and **Search URL** to that address.
4. Run **Research a topic**.

```yaml
search:
  formats:
    - html
    - json
```

On the setup page:
- **Use SearXNG.** Sets web search to Searxng and the search URL to `http://127.0.0.1:8080`.
- **Copy JSON format.** Copies the settings.yml block that allows JSON results.

## Chat models

Each cloud provider needs its own API key. Selecting the provider fills its usual URL and, when one is known, a starting model.

### OpenAI

Cleanup, vault answers, and research can use OpenAI. Note text is sent to OpenAI when a command uses this provider.

1. Create an API key on the [OpenAI key page](https://platform.openai.com/api-keys).
2. In **Settings → Bumpy**, select **OpenAI**. The URL is set to `https://api.openai.com/v1`. The starting model is `gpt-4o`.
3. Paste the key into **API key**.
4. Select **Check connection**.

On the setup page:
- **Use OpenAI.** Sets the provider to OpenAI, fills `https://api.openai.com/v1`, and sets the model to `gpt-4o`.
- **Open key page.** Opens https://platform.openai.com/api-keys.

### Anthropic

Cleanup, vault answers, and research can use Anthropic. Note text is sent to Anthropic when a command uses this provider.

1. Create an API key on the [Anthropic key page](https://console.anthropic.com/settings/keys).
2. In **Settings → Bumpy**, select **Anthropic**. The URL is set to `https://api.anthropic.com/v1`. The starting model is `claude-sonnet-4-5`.
3. Paste the key into **API key**.
4. Select **Check connection**.

On the setup page:
- **Use Anthropic.** Sets the provider to Anthropic, fills `https://api.anthropic.com/v1`, and sets the model to `claude-sonnet-4-5`.
- **Open key page.** Opens https://console.anthropic.com/settings/keys.

### Gemini

Cleanup, vault answers, and research can use Gemini. Note text is sent to Gemini when a command uses this provider.

1. Create an API key on the [Gemini key page](https://aistudio.google.com/apikey).
2. In **Settings → Bumpy**, select **Gemini**. The URL is set to `https://generativelanguage.googleapis.com/v1beta/openai`. The starting model is `gemini-3.8-flash`.
3. Paste the key into **API key**.
4. Select **Check connection**.

On the setup page:
- **Use Gemini.** Sets the provider to Gemini, fills `https://generativelanguage.googleapis.com/v1beta/openai`, and sets the model to `gemini-3.8-flash`.
- **Open key page.** Opens https://aistudio.google.com/apikey.

### Groq

Cleanup, vault answers, and research can use Groq. Note text is sent to Groq when a command uses this provider.

1. Create an API key on the [Groq key page](https://console.groq.com/keys).
2. In **Settings → Bumpy**, select **Groq**. The URL is set to `https://api.groq.com/openai/v1`. The starting model is `llama-3.3-70b-versatile`.
3. Paste the key into **API key**.
4. Select **Check connection**.

On the setup page:
- **Use Groq.** Sets the provider to Groq, fills `https://api.groq.com/openai/v1`, and sets the model to `llama-3.3-70b-versatile`.
- **Open key page.** Opens https://console.groq.com/keys.

### OpenRouter

Cleanup, vault answers, and research can use OpenRouter. Note text is sent to OpenRouter when a command uses this provider.

1. Create an API key on the [OpenRouter key page](https://openrouter.ai/keys).
2. In **Settings → Bumpy**, select **OpenRouter**. The URL is set to `https://openrouter.ai/api/v1`. Type the model name from your account.
3. Paste the key into **API key**.
4. Select **Check connection**.

On the setup page:
- **Use OpenRouter.** Sets the provider to OpenRouter, fills `https://openrouter.ai/api/v1`, and keeps the model name already typed.
- **Open key page.** Opens https://openrouter.ai/keys.

### Mistral

Cleanup, vault answers, and research can use Mistral. Note text is sent to Mistral when a command uses this provider.

1. Create an API key on the [Mistral key page](https://console.mistral.ai/api-keys).
2. In **Settings → Bumpy**, select **Mistral**. The URL is set to `https://api.mistral.ai/v1`. The starting model is `mistral-medium-latest`.
3. Paste the key into **API key**.
4. Select **Check connection**.

On the setup page:
- **Use Mistral.** Sets the provider to Mistral, fills `https://api.mistral.ai/v1`, and sets the model to `mistral-medium-latest`.
- **Open key page.** Opens https://console.mistral.ai/api-keys.

### DeepSeek

Cleanup, vault answers, and research can use DeepSeek. Note text is sent to DeepSeek when a command uses this provider.

1. Create an API key on the [DeepSeek key page](https://platform.deepseek.com/api_keys).
2. In **Settings → Bumpy**, select **DeepSeek**. The URL is set to `https://api.deepseek.com/v1`. The starting model is `deepseek-chat`.
3. Paste the key into **API key**.
4. Select **Check connection**.

On the setup page:
- **Use DeepSeek.** Sets the provider to DeepSeek, fills `https://api.deepseek.com/v1`, and sets the model to `deepseek-chat`.
- **Open key page.** Opens https://platform.deepseek.com/api_keys.

### xAI

Cleanup, vault answers, and research can use xAI. Note text is sent to xAI when a command uses this provider.

1. Create an API key on the [xAI key page](https://console.x.ai/).
2. In **Settings → Bumpy**, select **xAI**. The URL is set to `https://api.x.ai/v1`. The starting model is `grok-4`.
3. Paste the key into **API key**.
4. Select **Check connection**.

On the setup page:
- **Use xAI.** Sets the provider to xAI, fills `https://api.x.ai/v1`, and sets the model to `grok-4`.
- **Open key page.** Opens https://console.x.ai/.

### Ultramarine

Cleanup, vault answers, and research can use Ultramarine. Note text is sent to Ultramarine when a command uses this provider.

1. Create an API key on the [Ultramarine key page](https://platform.paperinstruments.com/keys).
2. In **Settings → Bumpy**, select **Ultramarine**. The URL is set to `https://api.paperinstruments.com/v1`. The starting model is `ultramarine-1-flash`.
3. Paste the key into **API key**.
4. Select **Check connection**.
5. Ultramarine does not provide embeddings. Leave embeddings on local hashing, or point Embeddings at a provider with an embeddings API.
6. Requests use reasoning effort max and omit sampling fields, so Ultramarine uses its recommended defaults. The interpretation prompt is separate from the prompt used for other models.
7. When Ultramarine reports token usage, the research note states the run cost. Uncached input is $0.15 per million tokens, cached input is $0.03 per million tokens, and output, including reasoning, is $0.50 per million tokens.
8. A durable run over a folder of notes lives in `agent/`. It calls Ultramarine with the OpenAI SDK inside a Temporal workflow. A failed model call is retried, and a stopped client can resume the same run. The worker writes a draft file and does not change the vault.

On the setup page:
- **Use Ultramarine.** Sets the provider to Ultramarine, fills `https://api.paperinstruments.com/v1`, and sets the model to `ultramarine-1-flash`.
- **Open key page.** Opens https://platform.paperinstruments.com/keys.

### Backboard

Cleanup, vault answers, and research can use Backboard. Note text is sent to Backboard when a command uses this provider.

1. Create an API key on the [Backboard key page](https://app.backboard.io).
2. In **Settings → Bumpy**, select **Backboard**. The URL is set to `https://app.backboard.io/api`. The starting model is `gpt-4o`.
3. Paste the key into **API key**.
4. Select **Check connection**.
5. Backboard does not keep the note in Backboard memory. For embeddings, use local hashing or a provider with an embeddings API.

On the setup page:
- **Use Backboard.** Sets the provider to Backboard, fills `https://app.backboard.io/api`, and sets the model to `gpt-4o`.
- **Open key page.** Opens https://app.backboard.io.

## Speech

Speech to text and text to speech start on the app speech service. Cloud speech uses the key in the Speech section, which is separate from the chat key.

### App speech service

Dictation and reading work without an API key. This is the starting choice.

1. In **Settings → Bumpy**, set **Speech to text** and **Text to speech** to **App speech service**.
2. On the desktop app, the recognizer can send microphone audio to the operating system's speech service. Reading uses the app's speech synthesis.
3. Run **Dictate**, or **Read note**.

On the setup page:
- **Use app speech.** Sets speech to text and text to speech to the app speech service.

### OpenAI speech

Dictation and reading through OpenAI. The speech key is separate from the chat key. The same key can be pasted into both.

1. Create an API key on the [OpenAI speech key page](https://platform.openai.com/api-keys).
2. In **Settings → Bumpy**, under **Speech**, set **Speech to text** and **Text to speech** to **OpenAI**.
3. Dictation uses `whisper-1`. Reading uses `tts-1` and the alloy voice.
4. Paste the key into the speech API key under **Speech**. That field is separate from the chat **API key**.
5. Run **Dictate** or **Read note**.

On the setup page:
- **Use OpenAI speech.** Dictation uses `whisper-1`. Reading uses `tts-1` and the alloy voice.
- **Open key page.** Opens https://platform.openai.com/api-keys.

### Groq speech

Speech to text through Groq. Reading stays on the text-to-speech choice you already have.

1. Create an API key on the [Groq speech key page](https://console.groq.com/keys).
2. In **Settings → Bumpy**, under **Speech**, set **Speech to text** to **Groq**.
3. Dictation uses `whisper-large-v3-turbo`.
4. Paste the key into the speech API key under **Speech**. That field is separate from the chat **API key**.
5. Run **Dictate**.

On the setup page:
- **Use Groq speech.** Dictation uses `whisper-large-v3-turbo`.
- **Open key page.** Opens https://console.groq.com/keys.

### Grok speech

Dictation and reading through xAI. The speech key is the xAI key, stored in the Speech section.

1. Create an API key on the [Grok speech key page](https://console.x.ai/).
2. In **Settings → Bumpy**, under **Speech**, set **Speech to text** and **Text to speech** to **Grok**.
3. Dictation uses `grok-voice-transcribe-2.0`. Reading starts on the eve voice until you select **List voices**. **Language** can replace automatic detection.
4. Paste the key into the speech API key under **Speech**. That field is separate from the chat **API key**.
5. Run **Dictate** or **Read note**.

On the setup page:
- **Use Grok speech.** Dictation uses `grok-voice-transcribe-2.0`. Reading starts on the eve voice until you select **List voices**. **Language** can replace automatic detection.
- **Open key page.** Opens https://console.x.ai/.

### Gradium

Dictation and reading through Gradium. Gradium transcribes English, French, German, Spanish, and Portuguese. A WebM recording is converted to WAV before it is sent. The key is sent as `x-api-key`.

1. Create an API key on the [Gradium key page](https://gradium.ai).
2. In **Settings → Bumpy**, under **Speech**, set **Speech to text** and **Text to speech** to **Gradium**.
3. A starting voice id is filled in. **Language** can replace automatic detection.
4. Paste the key into the speech API key under **Speech**. That field is separate from the chat **API key**.
5. Run **Dictate** or **Read note**.

On the setup page:
- **Use Gradium.** A starting voice id is filled in. **Language** can replace automatic detection.
- **Open key page.** Opens https://gradium.ai.

### Mistral speech

Dictation and reading through Mistral. Speech to text sends the key as `x-api-key`. Reading sends it as a bearer token.

1. Create an API key on the [Mistral speech key page](https://console.mistral.ai/api-keys).
2. In **Settings → Bumpy**, under **Speech**, set **Speech to text** and **Text to speech** to **Mistral**.
3. Dictation uses `voxtral-mini-latest`. Reading uses `voxtral-mini-tts-2603`. Select **List voices** before reading a note.
4. Paste the key into the speech API key under **Speech**. That field is separate from the chat **API key**.
5. Run **Dictate** or **Read note**.

On the setup page:
- **Use Mistral speech.** Dictation uses `voxtral-mini-latest`. Reading uses `voxtral-mini-tts-2603`. Select **List voices** before reading a note.
- **Open key page.** Opens https://console.mistral.ai/api-keys.

### Deepgram

Speech to text for a noisy recording, or when you want the words while you talk. The key is a bearer token. The live connection sends it as a WebSocket protocol and opts out of Deepgram's model improvement program.

1. Create an API key on the [Deepgram key page](https://console.deepgram.com/).
2. In **Settings → Bumpy**, under **Speech**, set **Speech to text** to **Deepgram**.
3. Dictation uses `nova-3` and shows a live transcript.
4. Paste the key into the speech API key under **Speech**. That field is separate from the chat **API key**.
5. Run **Dictate**.

On the setup page:
- **Use Deepgram.** Dictation uses `nova-3` and shows a live transcript.
- **Open key page.** Opens https://console.deepgram.com/.

### ElevenLabs

Reading through ElevenLabs. The key is sent as `xi-api-key`. Dictation stays on the speech-to-text choice you already have.

1. Create an API key on the [ElevenLabs key page](https://elevenlabs.io/app/settings/api-keys).
2. In **Settings → Bumpy**, under **Speech**, set **Text to speech** to **ElevenLabs**.
3. Reading uses `eleven_v3` until you pick another model. Select **List voices** to choose a voice.
4. Paste the key into the speech API key under **Speech**. That field is separate from the chat **API key**.
5. Run **Read note**.

On the setup page:
- **Use ElevenLabs.** Reading uses `eleven_v3` until you pick another model. Select **List voices** to choose a voice.
- **Open key page.** Opens https://elevenlabs.io/app/settings/api-keys.

## Search and calendar

Web search stays off until you choose a provider. SearXNG is under Local. Calendar sync waits for a calendar ID and an access token.

### Brave search

Brave Search API. The key stays on this device and is sent as a header. Research cites only URLs Brave returns.

1. Create an API key on the [Brave key page](https://api.search.brave.com/app/keys).
2. In **Settings → Bumpy**, set **Web search** to **Brave**.
3. Paste the key into **Search API key**.
4. Run **Research a topic**.

On the setup page:
- **Use Brave.** Sets web search to Brave. Paste the search API key after this.
- **Open key page.** Opens https://api.search.brave.com/app/keys.

### Tavily

Tavily search. The key stays on this device and is sent as a bearer token. The topic is the query, and each search is a basic search.

1. Create an API key at [Tavily](https://app.tavily.com).
2. In **Settings → Bumpy**, set **Web search** to **Tavily**.
3. Paste the key into **Search API key**.
4. Run **Research a topic**.

On the setup page:
- **Use Tavily.** Sets web search to Tavily. Paste the search API key after this.
- **Open key page.** Opens https://app.tavily.com.

### SerpAPI

SerpAPI Google results. The key stays on this device. SerpAPI requires it as the api_key query parameter, and a failed search does not repeat that URL. The topic is the query. Research cites only links in the organic results. The request asks SerpAPI for those results only.

1. Create an API key on the [SerpAPI key page](https://serpapi.com/manage-api-key).
2. In **Settings → Bumpy**, set **Web search** to **SerpAPI**.
3. Paste the key into **Search API key**.
4. Run **Research a topic**.

On the setup page:
- **Use SerpAPI.** Sets web search to SerpAPI. Paste the search API key after this.
- **Open key page.** Opens https://serpapi.com/manage-api-key.

### Google Calendar

Sync compares dated tasks with a Google calendar. Nothing is synced until a calendar ID and an access token are set. Bumpy does not refresh the token.

1. In Google Cloud, enable the Google Calendar API and create an OAuth client.
2. Open the [OAuth playground](https://developers.google.com/oauthplayground/) and authorize the scope `https://www.googleapis.com/auth/calendar`.
3. Paste the access token into **Google access token**. It stays on this device and is not written into notes. Add a client ID, client secret, and refresh token if you want sync to renew it.
4. Set **Google calendar ID**. The usual id is `primary`.
5. Run **Sync calendar**. When the token expires, paste a new one.
6. A task with a time becomes a 30-minute event in the local time zone. A task with only a date stays an all-day event. Events Bumpy did not create are left alone.

On the setup page:
- **Use primary calendar.** Sets the Google calendar ID to primary. Paste an access token before syncing.
- **Open OAuth playground.** Opens https://developers.google.com/oauthplayground/.
