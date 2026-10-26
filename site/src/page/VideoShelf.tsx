import { useState } from "react";
import { films } from "./films";

export const VideoShelf: React.FC = () => {
	const [id, setId] = useState(films[0]?.id ?? "");
	const [missing, setMissing] = useState(false);
	const film = films.find((item) => item.id === id) ?? films[0];

	if (!film) return null;

	return (
		<div className="shelf">
			<div className="film-frame">
				{missing ? (
					<p className="film-fallback">
						This film is not in the build. The files live in <code>video/out</code>.
					</p>
				) : (
					<video
						key={film.src}
						controls
						playsInline
						preload="metadata"
						poster={film.poster}
						src={film.src}
						onError={() => setMissing(true)}
					>
						{film.title}
					</video>
				)}
			</div>
			<div className="shelf-list" role="listbox" aria-label="Rendered films">
				{films.map((item) => (
					<button
						key={item.id}
						type="button"
						role="option"
						aria-selected={item.id === film.id}
						className={item.id === film.id ? "shelf-item is-on" : "shelf-item"}
						onClick={() => {
							setMissing(false);
							setId(item.id);
						}}
					>
						<span>{item.title}</span>
						<span className="shelf-length">{item.length}</span>
						<span className="shelf-detail">{item.detail}</span>
					</button>
				))}
			</div>
		</div>
	);
};
