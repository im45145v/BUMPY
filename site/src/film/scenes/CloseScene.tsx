import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { serif } from "../theme";
import { Frame, Mark } from "../ui";

export const CloseScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Frame kicker="Bumpy" index="09" footer="Ordinary Markdown.">
			<div
				style={{
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "flex-end",
					gap: 32,
				}}
			>
				<div
					style={{
						scale: interpolate(frame, [0, 0.7 * fps], [0.86, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
							easing: Easing.bezier(0.16, 1, 0.3, 1),
							output: "perceptual-scale",
						}),
					}}
				>
					<Mark size={88} />
				</div>
				<div
					style={{
						maxWidth: 1500,
						fontFamily: serif,
						fontSize: 92,
						fontWeight: 600,
						letterSpacing: "-0.045em",
						lineHeight: 0.96,
						opacity: interpolate(frame, [0.15 * fps, 0.7 * fps], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
						translate: interpolate(frame, [0.15 * fps, 0.8 * fps], ["0px 24px", "0px 0px"], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
							easing: Easing.bezier(0.16, 1, 0.3, 1),
						}),
					}}
				>
					Nothing is written until you apply.
				</div>
			</div>
		</Frame>
	);
};
