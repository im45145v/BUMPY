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
	write(path: string, text: string): Promise<void>;
	search(question: string): Promise<string>;
}

const JOB_ID = /^[A-Za-z0-9-]{8,80}$/;

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
			return ok(shorten(text, 8000));
		}
		if (job.name === 'vault.preview') {
			const path = vaultPath(job.arguments.path);
			const proposed = exactText(job.arguments.proposed, 20_000);
			if (!path || proposed === null) return fail('invalid arguments');
			const current = await surface.read(path);
			if (current === null) return fail('That note is not available.');
			if (current.length > 20_000) return fail('That note is too long to preview on a call.');
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
			const original = exactText(job.arguments.original, 20_000);
			const proposed = exactText(job.arguments.proposed, 20_000);
			if (!path || original === null || proposed === null) return fail('invalid arguments');
			const current = await surface.read(path);
			if (current === null) return fail('That note is not available.');
			const decision = decideReplacement(current, original, proposed);
			if (!decision.ok) return fail(decision.reason);
			await surface.write(path, decision.next);
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

export function spokenPreview(warnings: readonly string[]): string {
	if (warnings.length === 0) return 'The preview is ready. Say apply to write it.';
	return `The preview is ready. ${warnings[0]} Say apply to write it.`;
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

function shorten(text: string, max: number): string {
	if (text.length <= max) return text;
	return `${text.slice(0, max)}\n\n[The rest of the note was left out.]`;
}

function ok(result: unknown): BridgeResult {
	return { ok: true, result };
}

function fail(error: string): BridgeResult {
	return { ok: false, error };
}
