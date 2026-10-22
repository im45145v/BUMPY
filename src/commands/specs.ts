import type { CleanupMode } from '../notes/cleanup-session';

export const CLEANUP_COMMANDS: Array<{
	id: string;
	name: string;
	mode: CleanupMode;
}> = [
	{
		id: 'cleanup-selection',
		name: 'Clean up selection',
		mode: 'selection',
	},
	{
		id: 'cleanup-note',
		name: 'Clean up note',
		mode: 'note',
	},
];
