export const MAX_SPEECH_CHARS = 8_000;
export const MAX_AUDIO_BYTES = 24 * 1024 * 1024;

export function speechTextError(text: string): string | null {
	if (text.trim() === '') return 'There is no text to read aloud.';
	if (text.length > MAX_SPEECH_CHARS) {
		return `This is too long to read aloud (${text.length} characters). Select a shorter passage.`;
	}
	return null;
}
