export const FPS = 30;
export const FADE_FRAMES = 12;

export const CHAPTERS = [
	{
		id: "opening",
		name: "The vault",
		duration: 150,
	},
	{
		id: "preview",
		name: "Clean up",
		duration: 140,
	},
	{
		id: "speech",
		name: "Speech",
		duration: 130,
	},
	{
		id: "links",
		name: "Links",
		duration: 120,
	},
	{
		id: "tasks",
		name: "Tasks",
		duration: 130,
	},
	{
		id: "ask",
		name: "Ask the vault",
		duration: 140,
	},
	{
		id: "research",
		name: "Research",
		duration: 120,
	},
	{
		id: "local",
		name: "On this computer",
		duration: 130,
	},
	{
		id: "close",
		name: "Apply",
		duration: 140,
	},
] as const;

export type ChapterId = (typeof CHAPTERS)[number]["id"];

export function chapterStart(index: number): number {
	let frame = 0;
	for (let i = 0; i < index; i++) {
		const chapter = CHAPTERS[i];
		if (!chapter) break;
		frame += chapter.duration - FADE_FRAMES;
	}
	return frame;
}

export function stillFrame(index: number): number {
	const chapter = CHAPTERS[index];
	if (!chapter) return 0;
	const hold = Math.round(chapter.duration * 0.58);
	const latest = chapter.duration - FADE_FRAMES - 2;
	return chapterStart(index) + Math.min(hold, Math.max(latest, 1));
}

export function chapterIndexAt(frame: number): number {
	let index = 0;
	for (let i = 0; i < CHAPTERS.length; i++) {
		if (frame >= chapterStart(i)) index = i;
	}
	return index;
}

export const FILM_FRAMES = CHAPTERS.reduce((sum, chapter, index) => {
	return sum + chapter.duration - (index === 0 ? 0 : FADE_FRAMES);
}, 0);
