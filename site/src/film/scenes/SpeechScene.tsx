import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { amber, mono, serif } from "../theme";
import { Frame } from "../ui";

const words = ["Pay", "rent", "next", "Friday."];

export const SpeechScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Frame
			kicker="Dictate"
			index="03"
			footer="Edit the transcript before it is inserted."
		>
			<div
				style={{
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "flex-end",
					gap: 36,
				}}
			>
				<div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
					{new Array(18).fill(0).map((_, index) => (
						<div
							key={index}
							style={{
								width: 14,
								borderRadius: 99,
								backgroundColor: index % 4 === 0 ? amber : "rgba(246,241,232,0.78)",
								height: 18 + Math.abs(Math.sin((frame + index * 3) / 4.5)) * 96,
							}}
						/>
					))}
				</div>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
					{words.map((word, index) => (
						<span
							key={word}
							style={{
								fontFamily: serif,
								fontSize: 108,
								letterSpacing: "-0.04em",
								lineHeight: 0.95,
								opacity: interpolate(
									frame,
									[0.25 * fps + index * 8, 0.45 * fps + index * 8],
									[0, 1],
									{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
								),
								translate: interpolate(
									frame,
									[0.25 * fps + index * 8, 0.55 * fps + index * 8],
									["0px 18px", "0px 0px"],
									{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
								),
							}}
						>
							{word}
						</span>
					))}
				</div>
				<div
					style={{
						fontFamily: mono,
						fontSize: 36,
						opacity: interpolate(frame, [1.5 * fps, 1.9 * fps], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
					}}
				>
					- [ ] Pay rent 📅 2026-10-23
				</div>
			</div>
		</Frame>
	);
};
