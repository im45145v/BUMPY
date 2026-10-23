import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { amber, mono, sans, serif } from "../theme";
import { Frame, paperStyle } from "../ui";

export const ResearchScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Frame
			kicker="Research"
			index="07"
			footer="Citations stay inside the search results."
		>
			<div
				style={{
					...paperStyle,
					height: "100%",
					padding: "40px 48px",
					display: "flex",
					flexDirection: "column",
					opacity: interpolate(frame, [0, 0.35 * fps], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					}),
				}}
			>
				<div style={{ fontFamily: mono, fontSize: 24 }}>Launch venues</div>
				<div
					style={{
						marginTop: 12,
						fontFamily: serif,
						fontSize: 64,
						letterSpacing: "-0.04em",
					}}
				>
					A note, with the links it actually got.
				</div>
				<div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 14 }}>
					{["example.com/friday-room", "example.com/how-to-book"].map((url, index) => (
						<div
							key={url}
							style={{
								fontFamily: mono,
								fontSize: 30,
								color: "#8a5a12",
								opacity: interpolate(frame, [0.4 * fps + index * 8, 0.8 * fps + index * 8], [0, 1], {
									extrapolateLeft: "clamp",
									extrapolateRight: "clamp",
								}),
							}}
						>
							{url}
						</div>
					))}
				</div>
				<div
					style={{
						marginTop: "auto",
						display: "flex",
						justifyContent: "space-between",
						gap: 24,
						alignItems: "flex-end",
					}}
				>
					<p style={{ margin: 0, maxWidth: 980, fontFamily: sans, fontSize: 32, lineHeight: 1.4 }}>
						Friday rooms are easier to book than Mondays. This sentence is the model's reading of the links.
					</p>
					<div
						style={{
							flex: "0 0 auto",
							border: `3px solid ${amber}`,
							color: "#8a5a12",
							borderRadius: 12,
							padding: "12px 16px",
							fontFamily: mono,
							fontSize: 26,
							rotate: "-6deg",
							opacity: interpolate(frame, [1.15 * fps, 1.5 * fps], [0, 1], {
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
							}),
						}}
					>
						AI-generated
					</div>
				</div>
			</div>
		</Frame>
	);
};
