import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Connection, Client } from '@temporalio/client';
import { TASK_QUEUE, temporalAddress, temporalNamespace } from './queue';
import { researchDocuments, type ResearchResult } from './workflows';

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	const connection = await Connection.connect({ address: temporalAddress() });
	try {
		const client = new Client({
			connection,
			namespace: temporalNamespace(),
		});
		if (args.resume) {
			const handle = client.workflow.getHandle(args.resume);
			const result = (await handle.result()) as ResearchResult;
			await writeDraft(args.out ?? defaultOut(), result);
			report(args.resume, result);
			return;
		}
		if (!args.dir || !args.topic) {
			process.stderr.write(
				'Usage: npm run research -- --dir <folder> --topic <text> [--out <file>]\n' +
					'Resume: npm run research -- --resume <workflow-id> [--out <file>]\n',
			);
			process.exitCode = 1;
			return;
		}
		const workflowId = `bumpy-research-${slug(args.topic)}-${Date.now()}`;
		const handle = await client.workflow.start(researchDocuments, {
			taskQueue: TASK_QUEUE,
			workflowId,
			args: [{ topic: args.topic, dir: path.resolve(args.dir) }],
		});
		process.stdout.write(
			`Started ${handle.workflowId}. Resume with --resume ${handle.workflowId}\n`,
		);
		const result = await handle.result();
		await writeDraft(args.out ?? defaultOut(), result);
		report(handle.workflowId, result);
	} finally {
		await connection.close();
	}
}

function report(workflowId: string, result: ResearchResult): void {
	process.stdout.write(`Workflow ${workflowId}\n`);
	process.stdout.write(`Documents ${result.documentCount}\n`);
	process.stdout.write(`${result.cost ?? 'This run has no cost.'}\n`);
}

async function writeDraft(file: string, result: ResearchResult): Promise<void> {
	const target = path.resolve(file);
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, result.draft, 'utf8');
	process.stdout.write(`Wrote ${target}\n`);
}

function defaultOut(): string {
	return path.join(process.cwd(), 'out', 'latest.md');
}

function parseArgs(argv: readonly string[]): {
	dir?: string;
	topic?: string;
	out?: string;
	resume?: string;
} {
	const parsed: { dir?: string; topic?: string; out?: string; resume?: string } = {};
	for (let index = 0; index < argv.length; index++) {
		const arg = argv[index];
		const next = argv[index + 1];
		if (!arg || !next) continue;
		if (arg === '--dir') parsed.dir = next;
		if (arg === '--topic') parsed.topic = next;
		if (arg === '--out') parsed.out = next;
		if (arg === '--resume') parsed.resume = next;
		if (arg.startsWith('--')) index += 1;
	}
	return parsed;
}

function slug(topic: string): string {
	const value = topic
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 40);
	return value || 'topic';
}

main().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : 'The research run failed.';
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
