import { Player, type PlayerRef } from "@remotion/player";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { BumpyFilm } from "../film/BumpyFilm";
import {
	CHAPTERS,
	FILM_FRAMES,
	FPS,
	type ChapterId,
	chapterIndexAt,
	stillFrame,
} from "../film/chapters";

type PlayerPanelProps = {
	readonly requestedId: ChapterId;
	readonly onJump: (id: ChapterId) => void;
};

type BoundaryState = { readonly failed: boolean };

class FilmBoundary extends Component<{ readonly children: ReactNode }, BoundaryState> {
	state: BoundaryState = { failed: false };

	static getDerivedStateFromError(): BoundaryState {
		return { failed: true };
	}

	render() {
		if (this.state.failed) {
			return (
				<p className="film-fallback">
					The film could not play in this browser. The rest of the page is ready to read.
				</p>
			);
		}
		return this.props.children;
	}
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({ requestedId, onJump }) => {
	const ref = useRef<PlayerRef>(null);
	const followRef = useRef(true);
	const opened = useRef(false);
	const [follow, setFollow] = useState(true);
	const [frame, setFrame] = useState(0);
	const [playing, setPlaying] = useState(false);
	const [reduceMotion] = useState(
		() => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
	);

	useEffect(() => {
		const player = ref.current;
		if (!player) return;

		const onFrame = (event: { detail: { frame: number } }) => {
			setFrame(event.detail.frame);
		};
		const onPlay = () => setPlaying(true);
		const onPause = () => setPlaying(false);

		player.addEventListener("frameupdate", onFrame);
		player.addEventListener("play", onPlay);
		player.addEventListener("pause", onPause);
		return () => {
			player.removeEventListener("frameupdate", onFrame);
			player.removeEventListener("play", onPlay);
			player.removeEventListener("pause", onPause);
		};
	}, []);

	useEffect(() => {
		const player = ref.current;
		if (!player || !followRef.current) return;
		const index = CHAPTERS.findIndex((chapter) => chapter.id === requestedId);
		if (index < 0) return;
		if (!opened.current) {
			opened.current = true;
			if (!reduceMotion) return;
		}
		const target = stillFrame(index);
		player.pause();
		player.seekTo(target);
		setFrame(target);
	}, [requestedId, reduceMotion]);

	const chapter = CHAPTERS[chapterIndexAt(frame)] ?? CHAPTERS[0];

	function hold(target: number) {
		const player = ref.current;
		if (!player) return;
		player.pause();
		player.seekTo(target);
		setFrame(target);
	}

	function togglePlay() {
		const player = ref.current;
		if (!player) return;
		if (player.isPlaying()) {
			player.pause();
			return;
		}
		followRef.current = false;
		setFollow(false);
		void player.play();
	}

	function enableFollow() {
		followRef.current = true;
		setFollow(true);
		const index = CHAPTERS.findIndex((item) => item.id === requestedId);
		if (index >= 0) hold(stillFrame(index));
	}

	return (
		<FilmBoundary>
			<div className="player-panel" id="film">
				<p className="kicker">Live film</p>
				<div className="film-frame">
					<Player
						ref={ref}
						component={BumpyFilm}
						durationInFrames={FILM_FRAMES}
						compositionWidth={1920}
						compositionHeight={1080}
						fps={FPS}
						loop
						autoPlay={!reduceMotion}
						initiallyMuted
						clickToPlay={false}
						doubleClickToFullscreen
						style={{ width: "100%", height: "100%" }}
					/>
				</div>
				<div className="player-meta">
					<p>
						Scene {String(chapterIndexAt(frame) + 1).padStart(2, "0")} · {chapter.name}
					</p>
					<p>{follow ? "Following the page" : "Playing freely"}</p>
				</div>
				<input
					className="scrub"
					type="range"
					min={0}
					max={FILM_FRAMES - 1}
					value={Math.min(frame, FILM_FRAMES - 1)}
					aria-label="Film position"
					onChange={(event) => {
						followRef.current = false;
						setFollow(false);
						hold(Number(event.target.value));
					}}
				/>
				<div className="player-actions">
					<button type="button" className="button primary" onClick={togglePlay}>
						{playing ? "Pause" : "Play"}
					</button>
					<button
						type="button"
						className="button"
						aria-pressed={follow}
						onClick={() => {
							if (follow) {
								followRef.current = false;
								setFollow(false);
								return;
							}
							enableFollow();
						}}
					>
						{follow ? "Unfollow the page" : "Follow the page"}
					</button>
				</div>
				<div className="chapter-row" role="tablist" aria-label="Film scenes">
					{CHAPTERS.map((item, index) => (
						<button
							key={item.id}
							type="button"
							role="tab"
							aria-selected={item.id === chapter.id}
							className={item.id === chapter.id ? "chapter-chip is-on" : "chapter-chip"}
							onClick={() => {
								onJump(item.id);
								hold(stillFrame(index));
							}}
						>
							{item.name}
						</button>
					))}
				</div>
			</div>
		</FilmBoundary>
	);
};
