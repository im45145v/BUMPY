const LIST_LIMIT = 3;

export function assessProposal(original: string, proposed: string): string[] {
	if (proposed.trim() === '' || original === proposed) return [];

	const warnings: string[] = [];
	const originalMatter = frontmatter(original);
	const proposedMatter = frontmatter(proposed);
	if (originalMatter !== null && originalMatter !== proposedMatter) {
		warnings.push('Frontmatter would change.');
	}

	warnMissing('Wikilinks', wikilinkTargets(original), wikilinkTargets(proposed), warnings);
	warnMissing('Embeds', embedTargets(original), embedTargets(proposed), warnings);
	warnMissing('Links', linkUrls(original), linkUrls(proposed), warnings);
	warnMissing('Headings', headingTexts(original), headingTexts(proposed), warnings);
	warnCode(original, proposed, warnings);
	warnTasks(original, proposed, warnings);
	warnSize(original, proposed, warnings);
	if (fenceMarkers(proposed) % 2 !== 0) {
		warnings.push('A code fence looks unfinished.');
	}
	return warnings;
}

function warnMissing(
	label: string,
	original: string[],
	proposed: string[],
	warnings: string[],
): void {
	const gone = missing(original, proposed);
	if (gone.length === 0) return;
	warnings.push(`${label} would be removed: ${formatList(gone)}.`);
}

function warnCode(original: string, proposed: string, warnings: string[]): void {
	const gone = missing(fencedBodies(original), fencedBodies(proposed));
	if (gone.length > 0) {
		warnings.push('A fenced code block would be removed or changed.');
	}
}

function warnTasks(original: string, proposed: string, warnings: string[]): void {
	const before = taskLines(original);
	const after = taskLines(proposed);
	if (after.length < before.length) {
		warnings.push('Tasks would be removed.');
	}
	const doneBefore = before.filter((line) => /^\s*[-*] \[[xX]\]/.test(line)).length;
	const doneAfter = after.filter((line) => /^\s*[-*] \[[xX]\]/.test(line)).length;
	if (doneAfter < doneBefore) {
		warnings.push('A completed task would be cleared.');
	}
}

function warnSize(original: string, proposed: string, warnings: string[]): void {
	if (original.length >= 80 && proposed.length * 2 < original.length) {
		warnings.push('This removes about half or more of the text.');
	}
	const added = proposed.length - original.length;
	if (original.length > 0 && proposed.length > original.length * 2 && added > 400) {
		warnings.push('This adds a large amount of new text.');
	}
}

function missing(original: string[], proposed: string[]): string[] {
	const remaining = [...proposed];
	const gone: string[] = [];
	for (const item of original) {
		const index = remaining.indexOf(item);
		if (index < 0) gone.push(item);
		else remaining.splice(index, 1);
	}
	return gone;
}

function formatList(items: string[]): string {
	const shown = items.slice(0, LIST_LIMIT).map(shorten);
	if (items.length > LIST_LIMIT) {
		shown.push(`${items.length - LIST_LIMIT} more`);
	}
	if (shown.length === 1) return shown[0] ?? '';
	return `${shown.slice(0, -1).join(', ')}, and ${shown[shown.length - 1] ?? ''}`;
}

function shorten(value: string): string {
	const compact = value.replace(/\s+/g, ' ').trim();
	if (compact.length <= 80) return compact;
	return `${compact.slice(0, 79)}…`;
}

function frontmatter(text: string): string | null {
	if (!text.startsWith('---\n')) return null;
	const end = text.indexOf('\n---', 4);
	if (end < 0) return null;
	return text.slice(0, end + 4);
}

function wikilinkTargets(text: string): string[] {
	return collect(text, /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g, (match, source) => {
		if (match.index > 0 && source[match.index - 1] === '!') return null;
		return (match[1] ?? '').trim();
	});
}

function embedTargets(text: string): string[] {
	return collect(text, /!\[\[([^\]|#]+)/g, (match) => (match[1] ?? '').trim());
}

function linkUrls(text: string): string[] {
	return collect(text, /\[[^\]]+\]\(([^)\s]+)\)/g, (match, source) => {
		if (match.index > 0 && source[match.index - 1] === '!') return null;
		return match[1] ?? '';
	});
}

function headingTexts(text: string): string[] {
	const headings: string[] = [];
	for (const line of text.split('\n')) {
		const match = /^#{1,6}[ \t]+(.+?)\s*$/.exec(line);
		const title = match?.[1]?.replace(/\s+#+\s*$/, '').trim();
		if (title) headings.push(title);
	}
	return headings;
}

function fencedBodies(text: string): string[] {
	const bodies: string[] = [];
	const pattern = /^```[^\n]*\n([\s\S]*?)^```[ \t]*$/gm;
	for (const match of text.matchAll(pattern)) {
		bodies.push((match[1] ?? '').replace(/\s+$/, ''));
	}
	return bodies;
}

function fenceMarkers(text: string): number {
	let count = 0;
	for (const line of text.split('\n')) {
		if (/^(```+|~~~+)/.test(line.trim())) count += 1;
	}
	return count;
}

function taskLines(text: string): string[] {
	return text.split('\n').filter((line) => /^\s*[-*] \[[ xX]\]\s+\S/.test(line));
}

function collect(
	text: string,
	pattern: RegExp,
	pick: (match: RegExpExecArray, source: string) => string | null,
): string[] {
	const values: string[] = [];
	for (const match of text.matchAll(pattern)) {
		const value = pick(match, text);
		if (value) values.push(value);
	}
	return values;
}
