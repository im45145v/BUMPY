import { decideReplacement } from '../notes/apply';
import { assessProposal } from '../notes/validate-proposal';
import { tasksIn } from '../tasks/parse';

export interface BridgeJob {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
}

export interface BridgeResult {
	ok: boolean;
	result?: unknown;
	error?: string;
}

export interface VaultNote {
	path: string;
	title: string;
	text: string;
}

export interface VaultSurface {
	notes(): Promise<VaultNote[]>;
	read(path: string): Promise<string | null>;
	write(path: string, text: string, expected?: string): Promise<void>;
	search(question: string): Promise<string>;
	showPreview?(preview: CallPreview): void;
}

const JOB_ID = /^[A-Za-z0-9-]{8,80}$/;

/** A call may replace a note only when the whole note fits in what the model is shown. */
export const CALL_NOTE_LIMIT = 20_000;

export function readBridgeJob(body: string): BridgeJob | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== 'object') return null;
	const job = (parsed as { job?: unknown }).job;
	if (!job || typeof job !== 'object') return null;
	const record = job as { id?: unknown; name?: unknown; arguments?: unknown };
	if (typeof record.id !== 'string' || !JOB_ID.test(record.id)) return null;
	if (typeof record.name !== 'string' || record.name === '') return null;
	const args =
		record.arguments && typeof record.arguments === 'object'
			? (record.arguments as Record<string, unknown>)
			: {};
	return { id: record.id, name: record.name, arguments: args };
}

export async function runVaultJob(
	surface: VaultSurface,
	job: BridgeJob,
): Promise<BridgeResult> {
	try {
		if (job.name === 'vault.ask') {
			const question = requiredText(job.arguments.question, 500);
			if (!question) return fail('invalid arguments');
			return ok(await surface.search(question));
		}
		if (job.name === 'vault.tasks') {
			return ok(listOpenTasks(await surface.notes()));
		}
		if (job.name === 'vault.read') {
			const path = vaultPath(job.arguments.path);
			if (!path) return fail('invalid arguments');
			const text = await surface.read(path);
			if (text === null) return fail('That note is not available.');
			return ok(noteForCall(text));
		}
		if (job.name === 'vault.preview') {
			const path = vaultPath(job.arguments.path);
			const proposed = exactText(job.arguments.proposed, CALL_NOTE_LIMIT);
			if (!path || proposed === null) return fail('invalid arguments');
			const current = await surface.read(path);
			if (current === null) return fail('That note is not available.');
			if (current.length > CALL_NOTE_LIMIT) {
				return fail('That note is too long to change on a call. Edit it in Obsidian.');
			}
			const warnings = assessProposal(current, proposed);
			return ok({
				path,
				original: current,
				proposed,
				warnings,
				spoken: spokenPreview(warnings),
			});
		}
		if (job.name === 'vault.apply') {
			const path = vaultPath(job.arguments.path);
			const original = exactText(job.arguments.original, CALL_NOTE_LIMIT);
			const proposed = exactText(job.arguments.proposed, CALL_NOTE_LIMIT);
			if (!path || original === null || proposed === null) return fail('invalid arguments');
			const current = await surface.read(path);
			if (current === null) return fail('That note is not available.');
			if (current === proposed) return ok({ written: true, path, unchanged: true });
			const decision = decideReplacement(current, original, proposed);
			if (!decision.ok) return fail(decision.reason);
			await surface.write(path, decision.next, current);
			return ok({ written: true, path });
		}
		return fail('unknown tool');
	} catch (error) {
		const message = error instanceof Error ? error.message : 'The vault job failed.';
		return fail(message.slice(0, 300));
	}
}

export function listOpenTasks(notes: readonly VaultNote[]): string {
	const open = notes.flatMap((note) =>
		tasksIn(note.text).flatMap((task) =>
			task.done
				? []
				: [
						{
							title: task.title,
							due: task.due,
							time: task.time,
							path: note.path,
						},
					],
		),
	);
	open.sort((left, right) => {
		if (left.due && right.due) {
			return left.due.localeCompare(right.due) || left.title.localeCompare(right.title);
		}
		if (left.due) return -1;
		if (right.due) return 1;
		return left.title.localeCompare(right.title);
	});
	if (open.length === 0) return 'No open tasks.';
	const lines = open.slice(0, 20).map((task) => {
		const due = task.due ? `, due ${task.due}` : '';
		const time = task.time ? ` ${task.time}` : '';
		return `${task.title}${due}${time} (${task.path})`;
	});
	if (open.length > 20) lines.push('Some open tasks were left out.');
	return lines.join('\n');
}

export interface CallPreview {
	path: string;
	original: string;
	proposed: string;
	warnings: string[];
}

export function callPreviewFrom(result: unknown): CallPreview | null {
	if (!result || typeof result !== 'object') return null;
	const record = result as {
		path?: unknown;
		original?: unknown;
		proposed?: unknown;
		warnings?: unknown;
	};
	if (
		typeof record.path !== 'string' ||
		typeof record.original !== 'string' ||
		typeof record.proposed !== 'string'
	) {
		return null;
	}
	const warnings = Array.isArray(record.warnings)
		? record.warnings.filter((item): item is string => typeof item === 'string')
		: [];
	return {
		path: record.path,
		original: record.original,
		proposed: record.proposed,
		warnings,
	};
}

/** Spoken summary of a whole-note replacement. Warnings stay in the sentence. */
export function spokenPreview(warnings: readonly string[]): string {
	const lead = 'This replaces the whole note.';
	if (warnings.length === 0) {
		return `${lead} Say apply to write it. The preview is open in Obsidian.`;
	}
	const heard = warnings.slice(0, 2).join(' ');
	const extra =
		warnings.length > 2 ? ` ${warnings.length - 2} more warnings are in Obsidian.` : '';
	return `${lead} ${heard}${extra} Say apply anyway to write it.`.slice(0, 500);
}

export function vaultPath(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const path = value.trim();
	if (
		path === '' ||
		path.length > 240 ||
		path.startsWith('/') ||
		path.includes('\\') ||
		path.includes('\0') ||
		path.split('/').includes('..') ||
		!path.toLowerCase().endsWith('.md')
	) {
		return null;
	}
	return path;
}

function requiredText(value: unknown, max: number): string | null {
	if (typeof value !== 'string') return null;
	const text = value.trim();
	if (text === '' || text.length > max) return null;
	return text;
}

function exactText(value: unknown, max: number): string | null {
	if (typeof value !== 'string' || value.length > max || value.includes('\0')) return null;
	return value;
}

function noteForCall(text: string): string {
	if (text.length <= CALL_NOTE_LIMIT) return text;
	const excerpt = text.slice(0, 1_200);
	return `${excerpt}\n\n[The rest of this ${text.length}-character note was left out. It is too long to change on a call.]`;
}

function ok(result: unknown): BridgeResult {
	return { ok: true, result };
}

function fail(error: string): BridgeResult {
	return { ok: false, error };
}
