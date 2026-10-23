import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { mono, sans, serif } from "../theme";
import { Frame } from "../ui";

const local = ["Ollama", "LM Studio", "Local hashing", "SearXNG"];
const cloud = [
	"OpenAI",
	"Anthropic",
	"Gemini",
	"Groq",
	"OpenRouter",
	"Mistral",
	"DeepSeek",
	"xAI",
	"Ultramarine",
	"Backboard",
];

export const LocalScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Frame
			kicker="On this computer"
			index="08"
			footer="Keys stay in plugin data on this device."
		>
			<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
				<div style={{ display: "flex", flexWrap: "wrap", gap: "8px 28px" }}>
					{local.map((name, index) => (
						<div
							key={name}
							style={{
								fontFamily: serif,
								fontSize: 84,
								letterSpacing: "-0.045em",
								lineHeight: 1,
								opacity: interpolate(frame, [index * 5, 0.35 * fps + index * 5], [0, 1], {
									extrapolateLeft: "clamp",
									extrapolateRight: "clamp",
								}),
								translate: interpolate(
									frame,
									[index * 5, 0.45 * fps + index * 5],
									["0px 16px", "0px 0px"],
									{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
								),
							}}
						>
							{name}
						</div>
					))}
				</div>
				<div
					style={{
						marginTop: "auto",
						fontFamily: sans,
						fontSize: 28,
						lineHeight: 1.35,
						opacity: interpolate(frame, [0.9 * fps, 1.3 * fps], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
					}}
				>
					<div style={{ fontFamily: mono, fontSize: 24, marginBottom: 16 }}>
						When you choose a cloud provider
					</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px" }}>
						{cloud.map((name) => (
							<span key={name}>{name}</span>
						))}
					</div>
				</div>
			</div>
		</Frame>
	);
};
