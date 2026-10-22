import { requestUrl } from 'obsidian';
import type { HttpClient } from './types';

export const obsidianHttp: HttpClient = async (request) => {
	const response = await requestUrl({
		url: request.url,
		method: request.method ?? 'POST',
		contentType:
			request.contentType ??
			(typeof request.body === 'string' ? 'application/json' : undefined),
		headers: request.headers,
		body: request.body,
		throw: false,
	});
	return {
		status: response.status,
		body: response.text,
		bytes: response.arrayBuffer,
	};
};
