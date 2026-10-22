export interface BriefingTask {
	title: string;
	due: string | null;
	done: boolean;
	path: string;
}

export interface BriefingNote {
	title: string;
	path: string;
	mtime: number;
	text: string;
}

export function localIsoDate(date: Date): string {
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${month}-${day}`;
}

export function startOfLocalDay(date: Date): number {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dailyBriefing(input: {
	date: string;
	tasks: readonly BriefingTask[];
	notes: readonly BriefingNote[];
}): string {
	const open = input.tasks.filter((task) => !task.done);
	const due = open.filter((task) => task.due !== null && task.due <= input.date);
	const taskLines =
		due.length === 0
			? 'No open tasks are due.'
			: due.map((task) => `- [ ] ${task.title} (${task.due}) — [[${titleFromPath(task.path)}]]`).join('\n');
	const noteLines =
		input.notes.length === 0
			? 'No notes were modified on this day.'
			: input.notes
					.map((note) => `- [[${note.title}]]`)
					.join('\n');
	return [`# Briefing ${input.date}`, '', '## Tasks', '', taskLines, '', '## Notes', '', noteLines, ''].join('\n');
}

export function journalDigest(
	notes: readonly BriefingNote[],
	label: string,
): string {
	const sections = notes.map((note) => {
		const excerpt = firstParagraph(note.text);
		return `## [[${note.title}]]\n\n${excerpt}`;
	});
	return [`# Journal ${label}`, '', sections.join('\n\n') || 'No journal notes in this period.', ''].join('\n');
}

export function thoughtTimeline(notes: readonly BriefingNote[]): string {
	const ordered = [...notes].sort((a, b) => a.mtime - b.mtime);
	const lines = ordered.map((note) => {
		const related = ordered
			.filter((other) => other.path !== note.path && shares(note.text, other.text))
			.slice(0, 3)
			.map((other) => `[[${other.title}]]`);
		const link = related.length > 0 ? ` Related: ${related.join(', ')}.` : '';
		return `- [[${note.title}]] — ${firstParagraph(note.text)}${link}`;
	});
	return ['# Thought evolution', '', lines.join('\n') || 'No notes to compare.', ''].join('\n');
}

export interface KnowledgeGap {
	topic: string;
	path: string;
	reason: string;
	query: string;
}

export function findGaps(notes: readonly BriefingNote[]): KnowledgeGap[] {
	const gaps: KnowledgeGap[] = [];
	for (const note of notes) {
		const lines = note.text.split('\n');
		for (let index = 0; index < lines.length; index++) {
			const line = lines[index] ?? '';
			const heading = /^#{1,6} (.+)$/.exec(line)?.[1]?.trim();
			if (heading) {
				const body = lines.slice(index + 1, index + 4).join('').trim();
				if (body.length < 40) {
					gaps.push({
						topic: heading,
						path: note.path,
						reason: `${note.title} has a heading with little underneath it.`,
						query: heading,
					});
				}
			}
			if (/\?\s*$/.test(line) && line.trim().length > 8) {
				gaps.push({
					topic: line.replace(/^#+\s*/, '').trim(),
					path: note.path,
					reason: `${note.title} asks a question that is not answered here.`,
					query: line.replace(/[?#]/g, '').trim(),
				});
			}
			if (/\b(look up|research later|todo)\b/i.test(line)) {
				gaps.push({
					topic: line.replace(/^[-*\s]+/, '').trim(),
					path: note.path,
					reason: `${note.title} marks something to follow up.`,
					query: line.replace(/\b(look up|research later|todo)\b/gi, '').trim(),
				});
			}
		}
	}
	return gaps.slice(0, 30);
}

export function suggestTasks(text: string): Array<{ title: string; source: string }> {
	const tasks: Array<{ title: string; source: string }> = [];
	for (const line of text.split('\n')) {
		const match =
			/(?:I should|I need to|remember to|don't forget to|don’t forget to|todo:)\s+(.+)/i.exec(
				line,
			);
		const title = match?.[1]?.trim();
		if (!title) continue;
		tasks.push({ title, source: line.trim() });
	}
	return tasks;
}

export function notesInPeriod(
	notes: readonly BriefingNote[],
	folder: string,
	start: number,
	end: number,
): BriefingNote[] {
	const prefix = folder.replace(/^\/+|\/+$/g, '');
	return notes.filter((note) => {
		const inFolder = prefix === '' || note.path === prefix || note.path.startsWith(`${prefix}/`);
		return inFolder && note.mtime >= start && note.mtime <= end;
	});
}

function firstParagraph(text: string): string {
	const body = text.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
	const paragraph = body.split(/\n\s*\n/)[0]?.replace(/\s+/g, ' ').trim() ?? '';
	return paragraph.slice(0, 240) || 'No excerpt.';
}

function shares(left: string, right: string): boolean {
	const words = new Set(
		left.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= 5),
	);
	let count = 0;
	for (const word of right.toLowerCase().split(/[^\p{L}\p{N}]+/u)) {
		if (words.has(word)) count += 1;
		if (count >= 3) return true;
	}
	return false;
}

function titleFromPath(path: string): string {
	const name = path.split('/').pop() ?? path;
	return name.replace(/\.md$/i, '');
}
