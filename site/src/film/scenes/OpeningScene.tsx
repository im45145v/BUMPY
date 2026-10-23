import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { cream, mono, sans, serif } from "../theme";
import { Frame, Mark } from "../ui";

export const OpeningScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Frame
			kicker="The vault"
			index="01"
			footer="A local-first sidekick for Obsidian."
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					justifyContent: "flex-end",
					gap: 36,
					opacity: interpolate(frame, [0, 0.45 * fps], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					}),
					translate: interpolate(frame, [0, 0.9 * fps], ["0px 36px", "0px 0px"], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
						easing: Easing.bezier(0.16, 1, 0.3, 1),
					}),
				}}
			>
				<Mark size={92} />
				<div
					style={{
						fontFamily: serif,
						fontSize: 168,
						fontWeight: 600,
						letterSpacing: "-0.055em",
						lineHeight: 0.86,
					}}
				>
					Bumpy
				</div>
				<div
					style={{
						maxWidth: 920,
						fontFamily: sans,
						fontSize: 42,
						lineHeight: 1.35,
						color: cream,
					}}
				>
					The vault stays the source of truth. Notes stay ordinary Markdown.
				</div>
				<div
					style={{
						alignSelf: "flex-start",
						padding: "22px 28px",
						borderRadius: 18,
						backgroundColor: "rgba(243,236,223,0.1)",
						border: "1px solid rgba(246,241,232,0.14)",
						fontFamily: mono,
						fontSize: 28,
					}}
				>
					Friday. Move the launch. Email the venue.
				</div>
			</div>
		</Frame>
	);
};
