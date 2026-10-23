import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';
import { TASK_QUEUE, temporalAddress, temporalNamespace } from './queue';

async function run(): Promise<void> {
	const connection = await NativeConnection.connect({ address: temporalAddress() });
	try {
		const worker = await Worker.create({
			connection,
			namespace: temporalNamespace(),
			taskQueue: TASK_QUEUE,
			workflowsPath: fileURLToPath(new URL('./workflows.ts', import.meta.url)),
			activities,
		});
		await worker.run();
	} finally {
		await connection.close();
	}
}

run().catch((error: unknown) => {
	const message = error instanceof Error ? error.message : 'The worker stopped.';
	process.stderr.write(`${message}\n`);
	process.exitCode = 1;
});
