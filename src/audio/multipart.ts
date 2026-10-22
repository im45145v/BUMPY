export interface MultipartFile {
	name: string;
	filename: string;
	type: string;
	data: Uint8Array;
}

export interface MultipartField {
	name: string;
	value: string;
}

export function encodeMultipart(
	fields: ReadonlyArray<MultipartField | MultipartFile>,
): { contentType: string; body: ArrayBuffer } {
	const boundary = `bumpy-${boundaryToken(fields)}`;
	const chunks: Uint8Array[] = [];
	const encoder = new TextEncoder();
	for (const field of fields) {
		chunks.push(encoder.encode(`--${boundary}\r\n`));
		if ('value' in field) {
			chunks.push(
				encoder.encode(
					`Content-Disposition: form-data; name="${field.name}"\r\n\r\n${field.value}\r\n`,
				),
			);
			continue;
		}
		chunks.push(
			encoder.encode(
				`Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n` +
					`Content-Type: ${field.type}\r\n\r\n`,
			),
		);
		chunks.push(field.data);
		chunks.push(encoder.encode('\r\n'));
	}
	chunks.push(encoder.encode(`--${boundary}--\r\n`));
	const length = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
	const body = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return {
		contentType: `multipart/form-data; boundary=${boundary}`,
		body: body.buffer,
	};
}

function boundaryToken(fields: ReadonlyArray<MultipartField | MultipartFile>): string {
	let token = `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
	const encoded = new TextDecoder().decode(preview(fields));
	for (let i = 0; i < 5 && encoded.includes(token); i++) {
		token += i.toString(16);
	}
	return token;
}

function preview(fields: ReadonlyArray<MultipartField | MultipartFile>): Uint8Array {
	const parts: Uint8Array[] = [];
	for (const field of fields) {
		if ('value' in field) parts.push(new TextEncoder().encode(field.value));
		else parts.push(field.data.slice(0, 64));
	}
	const length = parts.reduce((sum, part) => sum + part.byteLength, 0);
	const merged = new Uint8Array(length);
	let offset = 0;
	for (const part of parts) {
		merged.set(part, offset);
		offset += part.byteLength;
	}
	return merged;
}
