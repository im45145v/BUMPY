import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { amber, mono, sans, serif } from "../theme";
import { Frame, paperStyle } from "../ui";

const sources = ["Launch", "Venue", "Budget"];

export const AskScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Frame
			kicker="Ask the vault"
			index="06"
			footer="The answer lists the notes it used."
		>
			<div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 28 }}>
				<div
					style={{
						fontFamily: serif,
						fontSize: 72,
						letterSpacing: "-0.045em",
						lineHeight: 1,
						opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
					}}
				>
					What did I decide about the launch?
				</div>
				<div style={{ display: "flex", gap: 16 }}>
					{sources.map((source, index) => (
						<div
							key={source}
							style={{
								fontFamily: mono,
								fontSize: 26,
								padding: "14px 18px",
								borderRadius: 999,
								border: `1px solid ${amber}`,
								opacity: interpolate(
									frame,
									[0.45 * fps + index * 6, 0.75 * fps + index * 6],
									[0, 1],
									{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
								),
							}}
						>
							{source}
						</div>
					))}
				</div>
				<div
					style={{
						...paperStyle,
						marginTop: "auto",
						padding: "36px 40px",
						opacity: interpolate(frame, [1.05 * fps, 1.45 * fps], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
						translate: interpolate(frame, [1.05 * fps, 1.5 * fps], ["0px 20px", "0px 0px"], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
					}}
				>
					<div style={{ fontFamily: mono, fontSize: 22, letterSpacing: "0.08em" }}>
						From these passages
					</div>
					<p
						style={{
							margin: "18px 0 0",
							fontFamily: sans,
							fontSize: 36,
							lineHeight: 1.35,
						}}
					>
						You moved the launch to Friday, and Sarah is booking the venue.
					</p>
				</div>
			</div>
		</Frame>
	);
};
