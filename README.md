# Bumpy

Bumpy is a local-first AI sidekick for Obsidian. The vault stays the source of truth, and notes stay ordinary Markdown.

The first command cleans up the current selection or the current note. Bumpy shows a preview and writes only the reviewed text after you choose **Apply**.

## Provider

Bumpy talks to one OpenAI-compatible endpoint. That covers a local server such as Ollama and a hosted API.

In **Settings → Bumpy**:

- **Provider URL** is the base URL, for example `http://127.0.0.1:11434/v1`.
- **Model** is the name that server expects.
- **API key** is optional. It is stored in this vault’s plugin data on this device and is not written into notes. Leave it empty for a local server that does not require one.

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

Reload Obsidian, then enable **Bumpy** under **Settings → Community plugins**. Run **Clean up selection** or **Clean up note** from the command palette.

If the development vault is a Git repository, ignore `.obsidian/plugins/bumpy/data.json` so the API key is not committed.

## License

The original sample plugin is copyright (C) 2020-2026 Dynalist Inc. Bumpy keeps those [0BSD](LICENSE) terms.
