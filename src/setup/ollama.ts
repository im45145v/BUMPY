import type { HttpClient } from '../providers/types';

export const OLLAMA_CHAT_MODEL = 'llama3.2';
export const OLLAMA_EMBED_MODEL = 'nomic-embed-text';
export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

export interface PullResult {
	ok: boolean;
	message: string;
}

/** OpenAI-style `/v1` base URL to the native Ollama origin, which serves `/api/pull`. */
export function ollamaNativeOrigin(baseUrl: string): string {
	const url = new URL(baseUrl.trim());
	const path = url.pathname.replace(/\/+$/, '');
	url.pathname = path.endsWith('/v1') ? path.slice(0, -'/v1'.length) || '/' : path || '/';
	url.search = '';
	url.hash = '';
	return url.toString().replace(/\/$/, '');
}

export function ollamaInstallCommand(platform: string): string {
	if (platform === 'linux') return 'curl -fsSL https://ollama.com/install.sh | sh';
	if (platform === 'darwin') return 'brew install ollama';
	return OLLAMA_DOWNLOAD_URL;
}

export async function pullOllamaModel(
	http: HttpClient,
	origin: string,
	model: string,
): Promise<PullResult> {
	const name = model.trim();
	if (name === '') return { ok: false, message: 'Choose a model to download.' };
	let url: string;
	try {
		url = new URL('/api/pull', origin).toString();
	} catch {
		return { ok: false, message: 'The Ollama address is not valid.' };
	}
	try {
		const response = await http({
			url,
			method: 'POST',
			headers: {},
			contentType: 'application/json',
			body: JSON.stringify({ model: name, stream: false }),
		});
		if (response.status < 200 || response.status >= 300) {
			return { ok: false, message: pullFailure(response.status, response.body) };
		}
		const problem = readPullProblem(response.body);
		if (problem) return { ok: false, message: problem };
		return { ok: true, message: `Downloaded ${name}.` };
	} catch {
		return {
			ok: false,
			message: 'Could not reach Ollama. Install it, open it, and try again.',
		};
	}
}

function pullFailure(status: number, body: string): string {
	return readPullProblem(body) || `Ollama refused the download (${status}).`;
}

function readPullProblem(body: string): string {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return '';
	}
	if (!parsed || typeof parsed !== 'object') return '';
	const error = (parsed as { error?: unknown }).error;
	if (typeof error !== 'string' || error.trim() === '') return '';
	const detail = error.trim().replace(/\s+/g, ' ').slice(0, 180);
	return `Ollama could not download the model. ${detail}`;
}
