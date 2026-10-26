import { useState } from "react";
import { films } from "./films";

const storyFilm = films.find((film) => film.id === "maya");

export const PlayerPanel: React.FC = () => {
	const [missing, setMissing] = useState(false);

	if (!storyFilm) return null;

	return (
		<div className="player-panel" id="film">
			<p className="kicker">Story</p>
			<div className="film-frame">
				{missing ? (
					<p className="film-fallback">
						The story film is not in this build. The file lives in <code>video/out/story</code>.
					</p>
				) : (
					<video
						controls
						playsInline
						preload="metadata"
						poster={storyFilm.poster}
						src={storyFilm.src}
						onError={() => setMissing(true)}
					>
						{storyFilm.title}
					</video>
				)}
			</div>
			<div className="player-meta">
				<p>{storyFilm.title}</p>
				<p>{storyFilm.length}</p>
			</div>
		</div>
	);
};
