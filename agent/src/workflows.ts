import { proxyActivities } from '@temporalio/workflow';

export interface ResearchInput {
	topic: string;
	dir: string;
}

interface Passage {
	path: string;
	text: string;
}

interface LoadedDocuments {
	instructions: string;
	passages: Passage[];
}

export interface ResearchResult {
	draft: string;
	cost: string | null;
	usage: {
		inputTokens: number;
		cachedInputTokens: number;
		outputTokens: number;
	} | null;
	documentCount: number;
}

const load = proxyActivities<{ loadDocuments(dir: string): Promise<LoadedDocuments> }>({
	startToCloseTimeout: '30 seconds',
	retry: {
		initialInterval: '1 second',
		backoffCoefficient: 2,
		maximumAttempts: 2,
	},
});

const interpret = proxyActivities<{
	interpretDocuments(input: {
		topic: string;
		instructions: string;
		passages: Passage[];
	}): Promise<ResearchResult>;
}>({
	startToCloseTimeout: '3 minutes',
	retry: {
		initialInterval: '2 seconds',
		backoffCoefficient: 2,
		maximumInterval: '30 seconds',
		maximumAttempts: 5,
	},
});

/** Reads the folder once, then retries the Ultramarine call without rereading the files. */
export async function researchDocuments(input: ResearchInput): Promise<ResearchResult> {
	const loaded = await load.loadDocuments(input.dir);
	return interpret.interpretDocuments({
		topic: input.topic,
		instructions: loaded.instructions,
		passages: loaded.passages,
	});
}
