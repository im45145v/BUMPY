export type Film = {
	readonly id: string;
	readonly title: string;
	readonly detail: string;
	readonly length: string;
	readonly src: string;
	readonly poster: string;
	readonly file: string;
	readonly posterFile: string;
};

export const films: readonly Film[] = [
	{
		id: "maya",
		title: "Maya's next move",
		detail:
			"Narrated story in a dark workspace. Maya has three minutes to recover a decision from her notes. Bumpy gathers the passages, suggests links, and previews a plan.",
		length: "2:07",
		src: "/videos/maya.mp4",
		poster: "/videos/maya.jpg",
		file: "video/out/story/Bumpy-Maya-1080p60.mp4",
		posterFile: "video/out/story/poster.jpg",
	},
	{
		id: "launch",
		title: "Put your thoughts in motion",
		detail:
			"Launch film with an original score. The on-screen copy carries the story when the sound is off.",
		length: "1:12",
		src: "/videos/launch.mp4",
		poster: "/videos/launch.jpg",
		file: "video/out/launch/Bumpy-Launch-1080p.mp4",
		posterFile: "video/out/launch/poster.jpg",
	},
	{
		id: "hackathon",
		title: "Hackathon product demo",
		detail:
			"Narrated walkthrough of the plugin in Obsidian. The captures come from a synthetic vault, including local answers, cleanup, links, tasks, and the calendar.",
		length: "3:50",
		src: "/videos/hackathon.mp4",
		poster: "/videos/hackathon.jpg",
		file: "video/out/hackathon/Bumpy-Hackathon-Full-Demo.mp4",
		posterFile: "video/out/hackathon/poster.jpg",
	},
	{
		id: "week3",
		title: "Slow and steady",
		detail:
			"Short cut about four notes for a move. They disagree with each other, and nobody has opened the folder.",
		length: "1:05",
		src: "/videos/week3.mp4",
		poster: "/videos/week3.jpg",
		file: "video/out/bumpy-week3.mp4",
		posterFile: "video/out/week3-poster.jpg",
	},
];
