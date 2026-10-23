import type { TokenUsage } from './types';

/** Published Ultramarine rates, dollars per million tokens. */
export const ULTRAMARINE_INPUT_PER_MILLION = 0.15;
export const ULTRAMARINE_CACHED_INPUT_PER_MILLION = 0.03;
export const ULTRAMARINE_OUTPUT_PER_MILLION = 0.5;

const INPUT_NANODOLLARS_PER_TOKEN = 150;
const CACHED_NANODOLLARS_PER_TOKEN = 30;
const OUTPUT_NANODOLLARS_PER_TOKEN = 500;
const NANODOLLARS_PER_DOLLAR = 1_000_000_000;

export const ULTRAMARINE_HOST = 'api.paperinstruments.com';

export const MISSING_USAGE_COST =
	'Ultramarine did not report token usage, so this run has no cost.';

export function isUltramarineEndpoint(baseUrl: string): boolean {
	try {
		return new URL(baseUrl.trim()).hostname === ULTRAMARINE_HOST;
	} catch {
		return false;
	}
}

/** Dollars for one run. Cached input is billed at the cached rate and is not billed again as fresh input. */
export function ultramarineCostUsd(usage: TokenUsage): number {
	return costNanodollars(usage) / NANODOLLARS_PER_DOLLAR;
}

export function formatRunCost(usage: TokenUsage): string {
	const cached = Math.min(
		wholeTokens(usage.cachedInputTokens),
		wholeTokens(usage.inputTokens),
	);
	return [
		`Ultramarine reported ${wholeTokens(usage.inputTokens)} input tokens (${cached} cached) and ${wholeTokens(usage.outputTokens)} output tokens.`,
		`At $${ULTRAMARINE_INPUT_PER_MILLION.toFixed(2)} per million uncached input tokens, $${ULTRAMARINE_CACHED_INPUT_PER_MILLION.toFixed(2)} per million cached input tokens, and $${ULTRAMARINE_OUTPUT_PER_MILLION.toFixed(2)} per million output tokens, this run cost ${formatNanodollars(costNanodollars(usage))}.`,
	].join(' ');
}

function costNanodollars(usage: TokenUsage): number {
	const input = wholeTokens(usage.inputTokens);
	const cached = Math.min(wholeTokens(usage.cachedInputTokens), input);
	const output = wholeTokens(usage.outputTokens);
	return (
		(input - cached) * INPUT_NANODOLLARS_PER_TOKEN +
		cached * CACHED_NANODOLLARS_PER_TOKEN +
		output * OUTPUT_NANODOLLARS_PER_TOKEN
	);
}

/** Six decimal places, rounded from integer nanodollars so small runs do not drift. */
function formatNanodollars(nanodollars: number): string {
	const micro = Math.round(nanodollars / 1_000);
	const whole = Math.trunc(micro / 1_000_000);
	const fraction = Math.abs(micro % 1_000_000);
	return `$${whole}.${String(fraction).padStart(6, '0')}`;
}

function wholeTokens(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0;
	return Math.floor(value);
}
