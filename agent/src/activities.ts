import { readdir, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { ApplicationFailure } from '@temporalio/activity';
import OpenAI, { APIError } from 'openai';
import { validateInstruction } from '../../src/instructions/policy';
import { MISSING_USAGE_COST, formatRunCost } from '../../src/providers/ultramarine';
import type { TokenUsage } from '../../src/providers/types';
import {
	buildDocumentDraft,
	buildDocumentMessages,
	collectPassages,
	type DocumentPassage,
} from '../../src/research/documents';

const ULTRAMARINE_BASE_URL = 'https://api.paperinstruments.com/v1';
const MODEL = 'ultramarine-1-flash';

export interface LoadedDocuments {
	instructions: string;
	passages: DocumentPassage[];
}

export interface InterpretationInput {
	topic: string;
	instructions: string;
	passages: DocumentPassage[];
}

export interface InterpretationResult {
	draft: string;
	cost: string | null;
	usage: TokenUsage | null;
	documentCount: number;
}

export async function loadDocuments(dir: string): Promise<LoadedDocuments> {
	const root = await resolveRoot(dir);
	const files = await walkMarkdown(root, root);
	const instruction = files.find((file) => file.path === 'BUMPY.md');
	const checked = instruction ? validateInstruction(instruction.path, instruction.text) : null;
	return {
		instructions: checked && checked.ok ? checked.text : '',
		passages: collectPassages(files),
	};
}

export async function interpretDocuments(
	input: InterpretationInput,
): Promise<InterpretationResult> {
	const apiKey = process.env.PAPERINSTRUMENTS_API_KEY?.trim() ?? '';
	if (apiKey === '') {
		throw ApplicationFailure.nonRetryable(
			'Set PAPERINSTRUMENTS_API_KEY in the worker environment.',
		);
	}
	if (input.passages.length === 0) {
		throw ApplicationFailure.nonRetryable('That folder has no Markdown documents to read.');
	}

	const client = new OpenAI({ baseURL: ULTRAMARINE_BASE_URL, apiKey });
	let completion: OpenAI.Chat.Completions.ChatCompletion;
	try {
		completion = await client.chat.completions.create({
			model: MODEL,
			messages: buildDocumentMessages(input.topic, input.passages, input.instructions),
			reasoning_effort: 'max',
			max_completion_tokens: 8192,
		});
	} catch (error) {
		throw modelFailure(error, apiKey);
	}

	const text = completion.choices[0]?.message?.content?.trim() ?? '';
	if (text === '') {
		throw ApplicationFailure.nonRetryable('Ultramarine returned an empty interpretation.');
	}
	const usage = usageFrom(completion.usage);
	const cost = usage ? formatRunCost(usage) : MISSING_USAGE_COST;
	const date = new Date().toISOString().slice(0, 10);
	return {
		draft: buildDocumentDraft({
			topic: input.topic,
			date,
			passages: input.passages,
			interpretation: text,
			cost,
		}),
		cost,
		usage,
		documentCount: input.passages.length,
	};
}

async function resolveRoot(dir: string): Promise<string> {
	try {
		const resolved = await realpath(dir);
		await readdir(resolved);
		return resolved;
	} catch {
		throw ApplicationFailure.nonRetryable('The document folder could not be read.');
	}
}

async function walkMarkdown(
	root: string,
	current: string,
): Promise<{ path: string; text: string }[]> {
	const entries = await readdir(current, { withFileTypes: true });
	const files: { path: string; text: string }[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue;
		const full = path.join(current, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules') continue;
			const realDir = await realpath(full);
			if (realDir !== root && !realDir.startsWith(root + path.sep)) continue;
			files.push(...(await walkMarkdown(root, realDir)));
			continue;
		}
		if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) continue;
		const real = await realpath(full);
		if (real !== root && !real.startsWith(root + path.sep)) continue;
		const text = await readFile(real, 'utf8');
		files.push({ path: path.relative(root, real).split(path.sep).join('/'), text });
	}
	return files;
}

function usageFrom(
	usage: OpenAI.Completions.CompletionUsage | undefined,
): TokenUsage | null {
	if (!usage) return null;
	const cached = usage.prompt_tokens_details?.cached_tokens;
	return {
		inputTokens: usage.prompt_tokens,
		cachedInputTokens: typeof cached === 'number' ? cached : 0,
		outputTokens: usage.completion_tokens,
	};
}

function modelFailure(error: unknown, apiKey: string): ApplicationFailure {
	const status = error instanceof APIError ? error.status : undefined;
	const raw = error instanceof Error ? error.message : 'The model request failed.';
	const message =
		raw.replaceAll(apiKey, '').replace(/\s+/g, ' ').trim().slice(0, 180) ||
		'The model request failed.';
	if (status === 400 || status === 401 || status === 403 || status === 404) {
		return ApplicationFailure.nonRetryable(message);
	}
	return ApplicationFailure.create({ message });
}
