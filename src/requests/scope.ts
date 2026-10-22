/** Tracks in-flight work so unload and dismissal can cancel it together. */
export class RequestScope {
	private readonly active = new Set<AbortController>();

	start(): AbortController {
		const controller = new AbortController();
		this.active.add(controller);
		return controller;
	}

	finish(controller: AbortController): void {
		this.active.delete(controller);
	}

	cancelAll(): void {
		for (const controller of this.active) controller.abort();
		this.active.clear();
	}

	get size(): number {
		return this.active.size;
	}
}
