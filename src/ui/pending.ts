import { Notice } from 'obsidian';
import { cancelOnClick } from '../requests/dismiss';

export function pendingNotice(
	label: string,
	controller: AbortController,
): { notice: Notice; release: () => void } {
	const fragment = createFragment();
	fragment.createSpan({ text: `${label} ` });
	const button = fragment.createEl('button', {
		text: 'Cancel',
		cls: 'bumpy-notice-cancel',
	});
	button.addEventListener('click', (event) => {
		event.preventDefault();
		event.stopPropagation();
		controller.abort();
	});
	const notice = new Notice(fragment, 0);
	const surface =
		button.parentElement?.parentElement ?? button.parentElement ?? button;
	const releaseClick = cancelOnClick(surface, controller);
	return {
		notice,
		release: () => {
			releaseClick();
			notice.hide();
		},
	};
}
