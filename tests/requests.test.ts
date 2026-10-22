import { describe, expect, it } from 'vitest';
import { cancelOnClick } from '../src/requests/dismiss';
import { RequestScope } from '../src/requests/scope';

describe('request cancellation', () => {
	it('aborts in-flight work when the notice is dismissed', () => {
		const scope = new RequestScope();
		const controller = scope.start();
		const notice = new EventTarget();
		const release = cancelOnClick(notice, controller);

		notice.dispatchEvent(new Event('click'));
		expect(controller.signal.aborted).toBe(true);

		release();
		scope.finish(controller);
		expect(scope.size).toBe(0);
	});

	it('cancels every active request on unload', () => {
		const scope = new RequestScope();
		const first = scope.start();
		const second = scope.start();
		scope.cancelAll();
		expect(first.signal.aborted).toBe(true);
		expect(second.signal.aborted).toBe(true);
		expect(scope.size).toBe(0);
	});
});
