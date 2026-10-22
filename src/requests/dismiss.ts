/** Clicking the in-flight notice, including its Cancel button, aborts the request. */
export function cancelOnClick(
	target: EventTarget,
	controller: AbortController,
): () => void {
	const cancel = () => {
		controller.abort();
	};
	target.addEventListener('click', cancel);
	return () => {
		target.removeEventListener('click', cancel);
	};
}
