import { useState } from "react";
import { films } from "./films";

const localFilms = import.meta.env.BUMPY_LOCAL_FILMS;
const localIds = Array.isArray(localFilms) ? localFilms : [];
const availableFilms = films.filter((film) => film.youtube || localIds.includes(film.id));

export const VideoShelf: React.FC = () => {
	const [id, setId] = useState(availableFilms.find((film) => film.youtube)?.id ?? availableFilms[0]?.id ?? "");
	const [missing, setMissing] = useState(false);
	const film = availableFilms.find((item) => item.id === id) ?? availableFilms[0];

	if (!film) return null;

	return (
		<div className="shelf">
			<div className="film-frame">
				{film.youtube ? (
					<iframe
						key={film.id}
						src={`https://www.youtube.com/embed/${film.youtube}`}
						title={film.title}
						loading="lazy"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						allowFullScreen
						referrerPolicy="strict-origin-when-cross-origin"
					/>
				) : missing ? (
					<p className="film-fallback">This video could not load.</p>
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
			<div className="shelf-list" role="group" aria-label="Choose a film">
				{availableFilms.map((item) => (
					<button
						key={item.id}
						type="button"
						aria-pressed={item.id === film.id}
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
