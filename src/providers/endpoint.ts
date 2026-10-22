import { ProviderError } from './types';

const BLOCKED_HOSTS = new Set([
	'169.254.169.254',
	'metadata.google.internal',
]);

const API_TAILS = [
	'/chat/completions',
	'/embeddings',
	'/audio/transcriptions',
	'/audio/speech',
];

/** Parse a user-supplied http(s) base and drop fragments, queries, and credentials. */
export function parseHttpBase(baseUrl: string, label = 'provider URL'): URL {
	let url: URL;
	try {
		url = new URL(baseUrl.trim());
	} catch {
		throw new ProviderError(`The ${label} is not valid.`);
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		throw new ProviderError(`The ${label} must start with http:// or https://.`);
	}
	if (url.username !== '' || url.password !== '') {
		throw new ProviderError(`The ${label} cannot include a username or password.`);
	}
	const host = url.hostname.replace(/\.$/, '').toLowerCase();
	if (BLOCKED_HOSTS.has(host)) {
		throw new ProviderError(`The ${label} cannot point at a metadata address.`);
	}
	url.hash = '';
	url.search = '';
	return url;
}

/** Build an API URL from the parsed origin and path, so a fragment cannot replace the path. */
export function joinApiPath(baseUrl: string, suffix: string): string {
	const url = parseHttpBase(baseUrl);
	let path = url.pathname.replace(/\/+$/, '');
	for (const tail of API_TAILS) {
		if (path.endsWith(tail)) {
			path = path.slice(0, -tail.length).replace(/\/+$/, '');
			break;
		}
	}
	url.pathname = `${path}/${suffix.replace(/^\/+/, '')}`;
	return url.toString();
}
