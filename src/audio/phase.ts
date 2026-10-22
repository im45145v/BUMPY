export type DictatePhase =
	| { name: 'idle' }
	| { name: 'recording'; partial: string }
	| { name: 'transcribing' }
	| { name: 'review'; transcript: string }
	| { name: 'error'; message: string };

export type DictateEvent =
	| { type: 'start' }
	| { type: 'partial'; text: string }
	| { type: 'stop' }
	| { type: 'transcript'; text: string }
	| { type: 'edit'; text: string }
	| { type: 'fail'; message: string }
	| { type: 'reset' };

export function dictateReducer(
	state: DictatePhase,
	event: DictateEvent,
): DictatePhase {
	switch (event.type) {
		case 'start':
			if (state.name !== 'idle' && state.name !== 'error') return state;
			return { name: 'recording', partial: '' };
		case 'partial':
			if (state.name !== 'recording') return state;
			return { name: 'recording', partial: event.text };
		case 'stop':
			if (state.name !== 'recording') return state;
			return { name: 'transcribing' };
		case 'transcript':
			if (state.name !== 'recording' && state.name !== 'transcribing') return state;
			return { name: 'review', transcript: event.text };
		case 'edit':
			if (state.name !== 'review') return state;
			return { name: 'review', transcript: event.text };
		case 'fail':
			return { name: 'error', message: event.message };
		case 'reset':
			return { name: 'idle' };
		default:
			return state;
	}
}
