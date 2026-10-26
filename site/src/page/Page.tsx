import manifest from "../../../manifest.json";
import { CHAPTERS } from "../film/chapters";
import { Mark } from "../film/ui";
import { CleanupDemo } from "./CleanupDemo";
import { PlayerPanel } from "./PlayerPanel";
import { VideoShelf } from "./VideoShelf";
import {
	chatProviders,
	commandGroups,
	develop,
	hero,
	principles,
	repoUrl,
	searchChoices,
	setupSteps,
	specGroups,
	speechChoices,
	story,
} from "./content";

const nav = [
	["#film", "Film"],
	["#videos", "Videos"],
	["#commands", "Commands"],
	["#speech", "Speech"],
	["#providers", "Providers"],
	["#details", "Details"],
	["#setup", "Setup"],
] as const;

const accent = "#8b5cf6";

export const Page: React.FC = () => {
	return (
		<>
			<a className="skip" href="#story">
				Skip to the story
			</a>
			<div className="workspace">
				<aside className="sidebar">
					<a className="brand" href="#top">
						<Mark size={28} color={accent} glyph="#ffffff" />
						<span>Bumpy</span>
					</a>
					<p className="sidebar-heading">On this page</p>
					<nav aria-label="Page">
						{nav.map(([href, label]) => (
							<a key={href} href={href}>
								{label}
							</a>
						))}
					</nav>
				</aside>
				<div className="leaf">
					<div className="tab-header">
						<div className="workspace-tab mod-active">
							<Mark size={16} color={accent} glyph="#ffffff" />
							<span>BUMPY</span>
						</div>
						<a className="button primary" href={repoUrl}>
							GitHub
						</a>
					</div>
			<main id="top">
				<div className="wrap reel">
					<div className="reel-copy" id="story">
						{CHAPTERS.map((chapter, index) => {
							const copy = story[chapter.id];
							const heroChapter = chapter.id === "opening";
							return (
								<article
									key={chapter.id}
									id={heroChapter ? "opening" : chapter.id}
									className={heroChapter ? "chapter chapter-hero" : "chapter"}
									data-chapter={chapter.id}
								>
									<p className="kicker">
										{String(index + 1).padStart(2, "0")} · {chapter.name}
									</p>
									{heroChapter ? (
										<>
											<h1>
												{hero.titleLead} <em>{hero.titleEm}</em>
											</h1>
											<p className="lede">{hero.lede}</p>
											<ul className="principles">
												{principles.map((item) => (
													<li key={item.title}>
														<strong>{item.title}</strong>
														<span>{item.text}</span>
													</li>
												))}
											</ul>
											<p className="film-note">{hero.filmNote}</p>
										</>
									) : (
										<h2>{copy.title}</h2>
									)}
									{copy.paragraphs.map((paragraph) => (
										<p key={paragraph}>{paragraph}</p>
									))}
									{chapter.id === "preview" ? <CleanupDemo /> : null}
								</article>
							);
						})}
					</div>
					<aside className="reel-film">
						<div className="reel-sticky">
							<PlayerPanel />
						</div>
					</aside>
				</div>

				<section className="band" id="videos">
					<div className="wrap">
						<p className="kicker">Videos</p>
						<h2>The rendered films.</h2>
						<p className="section-lead">
							These are the 1080p files from <code>video/out</code>. Maya is the Obsidian-styled
							story. The launch film is the score cut. The hackathon demo is the narrated walkthrough.
							Slow and steady is the short cut about the move.
						</p>
						<VideoShelf />
					</div>
				</section>

				<section className="band" id="commands">
					<div className="wrap">
						<p className="kicker">Command palette</p>
						<h2>Every command.</h2>
						<p className="section-lead">
							These are the command names. In Obsidian they appear in the command palette.
						</p>
						<div className="palette">
							{commandGroups.map((group) => (
								<section key={group.title} className="palette-group" aria-label={group.title}>
									<h3>{group.title}</h3>
									<ul>
										{group.commands.map((command) => (
											<li key={command.name}>
												<p>{command.name}</p>
												<span>{command.detail}</span>
											</li>
										))}
									</ul>
								</section>
							))}
						</div>
					</div>
				</section>

				<section className="band lift" id="speech">
					<div className="wrap">
						<p className="kicker">Speech</p>
						<h2>A key of its own, when you want one.</h2>
						<p className="section-lead">
							Speech to text and text to speech start on the app speech service. Cloud speech uses
							the key in the Speech section, which is separate from the chat key. Language can
							replace automatic detection for Grok and Gradium. A chosen language is also sent to
							Deepgram, to ElevenLabs models that accept it, and to the app recognizer.
						</p>
						<div className="choice-grid">
							{speechChoices.map((choice) => (
								<article key={choice.name} className="choice">
									<h3>{choice.name}</h3>
									<p>{choice.detail}</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<section className="band" id="providers">
					<div className="wrap">
						<p className="kicker">Providers</p>
						<h2>One default. A provider per feature when you want it.</h2>
						<p className="section-lead">
							The provider at the top of Settings → Bumpy is the default for every feature set to
							Same as default. Choosing a provider fills its usual URL and, when a list is known, a
							starting model. Keys are stored in this vault's plugin data on this device and are not
							written into notes.
						</p>
						<div className="table-scroll">
							<table>
								<caption>Chat providers, their usual URL, and the starting model.</caption>
								<thead>
									<tr>
										<th scope="col">Provider</th>
										<th scope="col">Usual URL</th>
										<th scope="col">Starting model</th>
										<th scope="col">Note</th>
									</tr>
								</thead>
								<tbody>
									{chatProviders.map((provider) => (
										<tr key={provider.name}>
											<th scope="row">{provider.name}</th>
											<td>
												<code>{provider.url}</code>
											</td>
											<td>{provider.model}</td>
											<td>{provider.note}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						<h3 className="subhead">Web search</h3>
						<div className="choice-grid">
							{searchChoices.map((choice) => (
								<article key={choice.name} className="choice">
									<h3>{choice.name}</h3>
									<p>{choice.detail}</p>
								</article>
							))}
						</div>
					</div>
				</section>

				<section className="band lift" id="details">
					<div className="wrap">
						<p className="kicker">The precise version</p>
						<h2>What actually happens.</h2>
						<div className="spec-grid">
							{specGroups.map((group) => (
								<article key={group.title} className="spec">
									<h3>{group.title}</h3>
									<ul>
										{group.items.map((item) => (
											<li key={item}>{item}</li>
										))}
									</ul>
								</article>
							))}
						</div>
					</div>
				</section>

				<section className="band" id="setup">
					<div className="wrap narrow">
						<p className="kicker">Setup</p>
						<h2>Four steps, then a preview.</h2>
						<ol className="steps">
							{setupSteps.map((step, index) => (
								<li key={step.title}>
									<span>{String(index + 1).padStart(2, "0")}</span>
									<div>
										<h3>{step.title}</h3>
										<p>{step.text}</p>
									</div>
								</li>
							))}
						</ol>
						<h3 className="subhead">While you build it</h3>
						<ul className="develop">
							{develop.map(([command, detail]) => (
								<li key={command}>
									<code>{command}</code>
									<span>{detail}</span>
								</li>
							))}
						</ul>
						<p>
							Requires Node.js 18 or newer. The plugin id is <code>bumpy</code>, and it asks for
							Obsidian {manifest.minAppVersion} or newer. Version {manifest.version}. It runs in the
							desktop and mobile apps. Computer notifications stay on the desktop app.
						</p>
					</div>
				</section>
			</main>

			<footer className="footer">
				<div className="wrap footer-grid">
					<div>
						<a className="brand" href="#top">
							<Mark size={28} color={accent} glyph="#ffffff" />
							<span>Bumpy</span>
						</a>
						<p>
							Local-first sidekick for notes, speech, links, tasks, and vault questions. Changes are
							previewed before they are written.
						</p>
					</div>
					<div>
						<p>
							<a href={repoUrl}>Repository</a>
						</p>
						<p>
							<a href={manifest.authorUrl}>{manifest.author}</a>
						</p>
						<p>
							<a href="https://obsidian.md">Obsidian</a>
						</p>
						<p>
							<a href="https://www.remotion.dev">Remotion</a>
						</p>
						<p>
							<a href="https://render.com">Render</a>
						</p>
					</div>
					<div>
						<p>
							The original sample plugin is copyright (C) 2020-2026 Dynalist Inc. Bumpy keeps those
							0BSD terms.
						</p>
						<p>
							This page uses the same dark workspace, borders, and purple accent as Obsidian. The
							plugin does not load web fonts. The pane beside the story embeds the launch video from YouTube.
							The other videos are the rendered files.
						</p>
					</div>
				</div>
			</footer>
				</div>
			</div>
		</>
	);
};
