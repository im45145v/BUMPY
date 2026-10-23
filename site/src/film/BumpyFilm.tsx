import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { FC } from "react";
import { useVideoConfig } from "remotion";
import { CHAPTERS, FADE_FRAMES } from "./chapters";
import { AskScene } from "./scenes/AskScene";
import { CloseScene } from "./scenes/CloseScene";
import { LinksScene } from "./scenes/LinksScene";
import { LocalScene } from "./scenes/LocalScene";
import { OpeningScene } from "./scenes/OpeningScene";
import { PreviewScene } from "./scenes/PreviewScene";
import { ResearchScene } from "./scenes/ResearchScene";
import { SpeechScene } from "./scenes/SpeechScene";
import { TasksScene } from "./scenes/TasksScene";

const scenes: readonly FC[] = [
	OpeningScene,
	PreviewScene,
	SpeechScene,
	LinksScene,
	TasksScene,
	AskScene,
	ResearchScene,
	LocalScene,
	CloseScene,
];

export const BumpyFilm: FC = () => {
	const { fps } = useVideoConfig();
	if (scenes.length !== CHAPTERS.length) {
		throw new Error("Film scenes and chapters diverged.");
	}

	return (
		<TransitionSeries>
			{CHAPTERS.map((chapter, index) => {
				const Scene = scenes[index];
				if (!Scene) return null;
				return [
					index === 0 ? null : (
						<TransitionSeries.Transition
							key={`${chapter.id}-fade`}
							presentation={fade()}
							timing={linearTiming({ durationInFrames: FADE_FRAMES })}
						/>
					),
					<TransitionSeries.Sequence
						key={chapter.id}
						name={chapter.name}
						durationInFrames={chapter.duration}
						premountFor={fps}
					>
						<Scene />
					</TransitionSeries.Sequence>,
				];
			})}
		</TransitionSeries>
	);
};
