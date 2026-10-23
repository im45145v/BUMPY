import { SETUP_GROUPS, type SetupGroup, type SetupGuide } from './apply';
import { LOCAL_GUIDES } from './local-guides';
import { CHAT_GUIDES, SEARCH_GUIDES, SPEECH_GUIDES } from './service-guides';

const SHARED_INTRO = `A local server has to be running on the same computer as this copy of Obsidian. Note text is sent only when you run a command, and only to the provider that command uses. Keys stay in this vault's plugin data on this device and are not written into notes.

The provider at the top of **Settings → Bumpy** is the default. Cleanup, vault answers, research, and embeddings can each use a different provider under **Feature providers**. Speech keeps its own keys.`;

/** Shown on the setup page inside Obsidian. */
export const SETUP_INTRO = `# Set up Bumpy

Buttons on this page fill the settings. When Ollama is already running, a button can ask it to download a model.

${SHARED_INTRO}`;

/** Repo copy: docs/setup.md. The steps match the setup page. */
const REPO_INTRO = `# Set up Bumpy

These are the steps for each model Bumpy can use. In Obsidian, open the command palette and run **Open setup**, or select **Open setup** at the top of **Settings → Bumpy**. Buttons on that page fill the settings. When Ollama is already running, a button can ask it to download a model.

${SHARED_INTRO}`;

const GROUP_INTRO: Record<SetupGroup, string> = {
	Local:
		'Ollama and LM Studio run models on this computer. Local hashing answers from the vault without a model download. SearXNG searches the web from a server you run.',
	'Chat models':
		'Each cloud provider needs its own API key. Selecting the provider fills its usual URL and, when one is known, a starting model.',
	Speech:
		'Speech to text and text to speech start on the app speech service. Cloud speech uses the key in the Speech section, which is separate from the chat key.',
	'Search and calendar':
		'Web search stays off until you choose a provider. SearXNG is under Local. Calendar sync waits for a calendar ID and an access token.',
};

export const SETUP_GUIDES: readonly SetupGuide[] = [
	...LOCAL_GUIDES,
	...CHAT_GUIDES,
	...SPEECH_GUIDES,
	...SEARCH_GUIDES,
];

export function guidesIn(group: SetupGroup): SetupGuide[] {
	return SETUP_GUIDES.filter((guide) => guide.group === group);
}

export function renderSetupMarkdown(): string {
	const parts = [REPO_INTRO.trim(), ''];
	for (const group of SETUP_GROUPS) {
		parts.push(`## ${group}`, '', GROUP_INTRO[group], '');
		for (const guide of guidesIn(group)) {
			parts.push(guideMarkdown(guide, true).trimEnd(), '');
		}
	}
	return `${parts.join('\n').trimEnd()}\n`;
}

export function guideBody(guide: SetupGuide): string {
	return guideMarkdown(guide, false);
}

export function groupIntro(group: SetupGroup): string {
	return `## ${group}\n\n${GROUP_INTRO[group]}`;
}

function guideMarkdown(guide: SetupGuide, withButtons: boolean): string {
	const lines = [`### ${guide.title}`, '', guide.summary, ''];
	guide.steps.forEach((step, index) => {
		lines.push(`${index + 1}. ${step}`);
	});
	if (guide.example) {
		lines.push('', `\`\`\`${guide.example.language}`, guide.example.text.trimEnd(), '```');
	}
	if (withButtons && guide.buttons.length > 0) {
		lines.push('', 'On the setup page:');
		for (const button of guide.buttons) {
			lines.push(`- **${button.label}.** ${button.detail}`);
		}
	}
	return lines.join('\n');
}
