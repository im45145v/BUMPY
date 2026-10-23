import {
	ButtonComponent,
	ItemView,
	MarkdownRenderer,
	Notice,
	Platform,
	Setting,
	type App,
	type WorkspaceLeaf,
} from 'obsidian';
import type { SettingsOwner } from '../settings';
import { obsidianHttp } from '../providers/obsidian-http';
import { SETUP_GROUPS, type SetupButton } from '../setup/apply';
import { SETUP_INTRO, groupIntro, guideBody, guidesIn } from '../setup/guides';
import { runSetupButton } from '../setup/run';

export const SETUP_VIEW = 'bumpy-setup';

export class SetupView extends ItemView {
	private busy = false;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly host: SettingsOwner,
	) {
		super(leaf);
	}

	getViewType(): string {
		return SETUP_VIEW;
	}

	getDisplayText(): string {
		return 'Setup';
	}

	getIcon(): string {
		return 'book-open';
	}

	async onOpen(): Promise<void> {
		await this.draw();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	private async draw(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bumpy-setup-view');
		const intro = contentEl.createDiv();
		await MarkdownRenderer.render(this.app, SETUP_INTRO, intro, '', this);
		for (const group of SETUP_GROUPS) {
			const heading = contentEl.createDiv();
			await MarkdownRenderer.render(this.app, groupIntro(group), heading, '', this);
			for (const guide of guidesIn(group)) {
				const block = contentEl.createDiv({ cls: 'bumpy-setup-guide' });
				const body = block.createDiv();
				await MarkdownRenderer.render(this.app, guideBody(guide), body, '', this);
				this.addButtons(block, guide.buttons);
			}
		}
	}

	private addButtons(block: HTMLElement, buttons: readonly SetupButton[]): void {
		if (buttons.length === 0) return;
		const actions = new Setting(block);
		actions.settingEl.addClass('bumpy-setup-actions');
		for (const button of buttons) {
			actions.addButton((control) => {
				control
					.setButtonText(button.label)
					.setTooltip(button.detail)
					.onClick(() => {
						void this.press(button, control);
					});
			});
		}
	}

	private async press(button: SetupButton, control: ButtonComponent): Promise<void> {
		if (this.busy) {
			new Notice('A setup action is still running.');
			return;
		}
		this.busy = true;
		control.setDisabled(true);
		const pending =
			button.run.kind === 'pull'
				? new Notice(
						`Downloading ${button.run.model}. This can take several minutes.`,
						0,
					)
				: undefined;
		try {
			const outcome = await runSetupButton(
				this.host.settings,
				button,
				obsidianHttp,
				setupPlatform(),
			);
			if (outcome.save) await this.host.saveSettings();
			if (outcome.copy) {
				await copyText(outcome.copy, outcome.message);
				return;
			}
			if (outcome.open) {
				const opened = window.open(outcome.open);
				new Notice(
					opened ? outcome.message : 'Allow pop-ups for Obsidian if the page did not open.',
				);
				return;
			}
			new Notice(outcome.message);
		} catch {
			new Notice('The setup action did not finish.');
		} finally {
			pending?.hide();
			this.busy = false;
			control.setDisabled(false);
		}
	}
}

export async function openSetup(app: App): Promise<void> {
	const existing = app.workspace.getLeavesOfType(SETUP_VIEW)[0];
	if (existing) {
		app.workspace.setActiveLeaf(existing, { focus: true });
		return;
	}
	await app.workspace.getLeaf('tab').setViewState({
		type: SETUP_VIEW,
		active: true,
	});
}

/** Settings is not part of the public app type. Close it so the setup page is visible. */
export function closeSettings(app: App): void {
	const host = app as App & { setting?: { close?: () => void } };
	host.setting?.close?.();
}

function setupPlatform(): string {
	if (Platform.isIosApp || Platform.isAndroidApp) return 'mobile';
	if (Platform.isMacOS) return 'darwin';
	if (Platform.isWin) return 'win32';
	return 'linux';
}

async function copyText(text: string, message: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		new Notice(message);
	} catch {
		new Notice('Could not copy. The command is in the steps above.');
	}
}
