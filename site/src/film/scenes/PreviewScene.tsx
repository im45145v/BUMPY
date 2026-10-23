import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { amber, mono, sans, serif } from "../theme";
import { Frame, paperStyle } from "../ui";

const messy =
	"ok so launch moved to next friday i think. sarah said email the venue. budget note is stale";
const clean =
	"The launch moved to next Friday. Email the venue, as Sarah asked. The budget note is out of date.";

export const PreviewScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Frame kicker="Clean up" index="02" footer="Apply writes the reviewed range.">
			<div style={{ display: "flex", gap: 28, height: "100%" }}>
				<div
					style={{
						...paperStyle,
						flex: 1,
						padding: "36px 40px",
						opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
					}}
				>
					<div style={{ fontFamily: mono, fontSize: 24, letterSpacing: "0.08em" }}>
						Note
					</div>
					<p
						style={{
							marginTop: 28,
							fontFamily: sans,
							fontSize: 36,
							lineHeight: 1.4,
						}}
					>
						{messy}
					</p>
				</div>
				<div
					style={{
						...paperStyle,
						flex: 1,
						padding: "36px 40px",
						display: "flex",
						flexDirection: "column",
						opacity: interpolate(frame, [0.35 * fps, 0.8 * fps], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
						translate: interpolate(
							frame,
							[0.35 * fps, 0.9 * fps],
							["28px 0px", "0px 0px"],
							{
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
								easing: Easing.bezier(0.16, 1, 0.3, 1),
							},
						),
					}}
				>
					<div style={{ fontFamily: mono, fontSize: 24, letterSpacing: "0.08em" }}>
						Preview
					</div>
					<p
						style={{
							marginTop: 28,
							fontFamily: serif,
							fontSize: 40,
							lineHeight: 1.35,
						}}
					>
						{clean}
					</p>
					<div
						style={{
							marginTop: "auto",
							alignSelf: "flex-end",
							backgroundColor: amber,
							color: "#14110e",
							borderRadius: 999,
							padding: "16px 28px",
							fontFamily: sans,
							fontSize: 28,
							fontWeight: 600,
							scale: interpolate(frame, [1.3 * fps, 1.8 * fps], [0.86, 1], {
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
								easing: Easing.out(Easing.cubic),
								output: "perceptual-scale",
							}),
						}}
					>
						Apply
					</div>
				</div>
			</div>
		</Frame>
	);
};
