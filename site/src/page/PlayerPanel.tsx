const storyFilm = {
	title: "BUMPY Launch Video",
	embed: "https://www.youtube.com/embed/hwy7td4Mmdg",
};

export const PlayerPanel: React.FC = () => {
	return (
		<div className="player-panel" id="film">
			<p className="kicker">Story</p>
			<div className="film-frame">
				<iframe
					src={storyFilm.embed}
					title={storyFilm.title}
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
					allowFullScreen
					referrerPolicy="strict-origin-when-cross-origin"
				/>
			</div>
			<div className="player-meta">
				<p>{storyFilm.title}</p>
			</div>
		</div>
	);
};
