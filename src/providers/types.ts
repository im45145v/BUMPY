export class ProviderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ProviderError';
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
}

export interface AIProvider {
	complete(request: CompletionRequest): Promise<string>;
}

export interface HttpRequest {
	url: string;
	headers: Record<string, string>;
	body: string;
}

export interface HttpResponse {
	status: number;
	body: string;
}

export type HttpClient = (request: HttpRequest) => Promise<HttpResponse>;
