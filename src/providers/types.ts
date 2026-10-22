export class ProviderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProviderError';
	}
}

export class RequestCancelledError extends Error {
	constructor() {
		super('The request was cancelled.');
		this.name = 'RequestCancelledError';
	}
}

export interface ChatMessage {
	role: 'system' | 'user';
	content: string;
}

export interface CompletionRequest {
	model: string;
	temperature: number;
	messages: ChatMessage[];
	signal?: AbortSignal;
	/** Extra private text that must not appear in errors. It is not sent to the provider. */
	redact?: readonly string[];
}

export interface AIProvider {
	complete(request: CompletionRequest): Promise<string>;
}

export interface HttpRequest {
	url: string;
	method?: 'GET' | 'POST' | 'PUT';
	headers: Record<string, string>;
	body?: string | ArrayBuffer;
	contentType?: string;
	signal?: AbortSignal;
}

export interface HttpResponse {
	status: number;
	body: string;
	bytes?: ArrayBuffer;
}

export type HttpClient = (request: HttpRequest) => Promise<HttpResponse>;
