import { describe, expect, it } from 'vitest';
import {
	dailyBriefing,
	findGaps,
	journalDigest,
	localIsoDate,
	notesInPeriod,
	suggestTasks,
	thoughtTimeline,
} from '../src/insights/report';

const garden = {
	title: 'Garden',
	path: 'Journal/Garden.md',
	mtime: new Date(2026, 9, 22, 9).getTime(),
	text: 'The garden watering schedule keeps the tomatoes alive.\n\nWhat should change next year?',
};

describe('insights', () => {
	it('lists due tasks and notes from the same day', () => {
		const text = dailyBriefing({
			date: '2026-10-22',
			tasks: [
				{ title: 'Water tomatoes', due: '2026-10-22', done: false, path: 'Tasks.md' },
				{ title: 'Buy seed', due: '2026-11-01', done: false, path: 'Tasks.md' },
				{ title: 'Done', due: '2026-10-22', done: true, path: 'Tasks.md' },
			],
			notes: [garden],
		});
		expect(text).toContain('Water tomatoes');
		expect(text).not.toContain('Buy seed');
		expect(text).toContain('[[Garden]]');
		expect(localIsoDate(new Date(2026, 9, 22))).toBe('2026-10-22');
	});

	it('summarizes a journal period and connects related notes', () => {
		const other = {
			title: 'Tomatoes',
			path: 'Journal/Tomatoes.md',
			mtime: garden.mtime - 86_400_000,
			text: 'The garden watering schedule needs a morning reminder.',
		};
		const outside = {
			title: 'Invoice',
			path: 'Work/Invoice.md',
			mtime: garden.mtime,
			text: 'Shipping charges.',
		};
		expect(notesInPeriod([garden, outside], 'Journal', garden.mtime - 1000, garden.mtime)).toEqual([
			garden,
		]);
		expect(journalDigest([garden], 'last 7 days')).toContain('[[Garden]]');
		expect(thoughtTimeline([other, garden])).toContain('[[Tomatoes]]');
		expect(thoughtTimeline([other, garden])).toContain('[[Garden]]');
	});

	it('finds unfinished notes and task phrases', () => {
		const gaps = findGaps([
			{
				...garden,
				text: '## Soil\n\nShort.\n\nLook up soil tests.',
			},
		]);
		expect(gaps.some((gap) => gap.query.includes('Soil'))).toBe(true);
		expect(gaps.some((gap) => /soil tests/i.test(gap.query))).toBe(true);
		expect(suggestTasks('I should email Ada tomorrow')).toEqual([
			{ title: 'email Ada tomorrow', source: 'I should email Ada tomorrow' },
		]);
	});
});
