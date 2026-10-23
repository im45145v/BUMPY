import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { amber, mono, sans, serif } from "../theme";
import { Frame, paperStyle } from "../ui";

const notes = [
	{ title: "Launch", body: "Move it to Friday. See [[Venue]].", x: 0, y: 40 },
	{ title: "Venue", body: "Sarah is booking the room.", x: 560, y: 0 },
	{ title: "Budget", body: "Hold the extra spend.", x: 1080, y: 70 },
];

export const LinksScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const draw = interpolate(frame, [0.3 * fps, 1.3 * fps], [1, 0], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<Frame
			kicker="Links"
			index="04"
			footer="Suggestions skip notes you already linked."
		>
			<svg
				width="1760"
				height="620"
				viewBox="0 0 1760 620"
				style={{ position: "absolute", inset: 0 }}
			>
				<line
					x1="280"
					y1="210"
					x2="760"
					y2="170"
					stroke={amber}
					strokeWidth="4"
					strokeDasharray="700"
					strokeDashoffset={700 * draw}
				/>
				<line
					x1="900"
					y1="190"
					x2="1280"
					y2="240"
					stroke={amber}
					strokeWidth="4"
					strokeDasharray="700"
					strokeDashoffset={700 * draw}
				/>
			</svg>
			{notes.map((note, index) => (
				<div
					key={note.title}
					style={{
						...paperStyle,
						position: "absolute",
						left: note.x,
						top: note.y,
						width: 460,
						padding: "32px 36px",
						opacity: interpolate(frame, [index * 6, 0.4 * fps + index * 6], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
						translate: interpolate(
							frame,
							[index * 6, 0.55 * fps + index * 6],
							["0px 24px", "0px 0px"],
							{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
						),
					}}
				>
					<div style={{ fontFamily: serif, fontSize: 48, fontWeight: 600 }}>
						{note.title}
					</div>
					<p style={{ marginTop: 16, fontFamily: sans, fontSize: 30, lineHeight: 1.35 }}>
						{note.body.includes("[[") ? (
							<>
								Move it to Friday. See <span style={{ color: "#8a5a12" }}>[[Venue]]</span>.
							</>
						) : (
							note.body
						)}
					</p>
					<div style={{ marginTop: 22, fontFamily: mono, fontSize: 22, opacity: 0.6 }}>
						wikilink
					</div>
				</div>
			))}
		</Frame>
	);
};
