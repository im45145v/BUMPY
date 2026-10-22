import { describe, expect, it } from 'vitest';
import { revealsSensitiveText, secretsFrom } from '../src/providers/redact';

describe('revealsSensitiveText', () => {
	it('hides a short note and a fragment of a longer one', () => {
		expect(revealsSensitiveText('cannot process Hi today', ['Hi'])).toBe(true);
		expect(
			revealsSensitiveText('rejected near bravo', [
				'Alpha bravo charlie delta.',
			]),
		).toBe(true);
		expect(
			revealsSensitiveText('failed at uarterly', ['Quarterly planning session']),
		).toBe(true);
	});

	it('keeps a provider detail that does not repeat the note', () => {
		expect(
			revealsSensitiveText('rate limit exceeded', [
				'See the launch plan and budget numbers tomorrow.',
			]),
		).toBe(false);
	});

	it('hides a credential fragment', () => {
		expect(revealsSensitiveText('bad key sk-test-secret', ['sk-test-secret'])).toBe(
			true,
		);
		expect(revealsSensitiveText('invalid secret supplied', ['sk-test-secret'])).toBe(
			true,
		);
	});

	it('reads the enclosed note rather than the wrapper', () => {
		const secrets = secretsFrom('', [
			{
				role: 'user',
				content:
					'Revise the note content below.\n\n<untrusted_note>\nHi\n</untrusted_note>',
			},
		]);
		expect(secrets).toEqual(['Hi']);
		expect(revealsSensitiveText('Revise the note content below', secrets)).toBe(
			false,
		);
		expect(revealsSensitiveText('echo Hi', secrets)).toBe(true);
	});
});
