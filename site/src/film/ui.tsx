import type { CSSProperties, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { amber, cream, ink, mono, paper, sans, serif } from "./theme";

export const Mark: React.FC<{ size: number; color?: string; glyph?: string }> = ({
	size,
	color = amber,
	glyph = ink,
}) => {
	return (
		<svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
			<rect width="64" height="64" rx="18" fill={color} />
			<path
				d="M12 42c7-16 13-20 20-20s13 4 20 20"
				fill="none"
				stroke={glyph}
				strokeWidth="4.5"
				strokeLinecap="round"
			/>
			<circle cx="32" cy="42" r="3.2" fill={glyph} />
		</svg>
	);
};

export const Stage: React.FC<{ children: ReactNode }> = ({ children }) => {
	return (
		<AbsoluteFill
			style={{
				backgroundColor: ink,
				color: cream,
				fontFamily: sans,
				overflow: "hidden",
			}}
		>
			<AbsoluteFill
				style={{
					backgroundImage:
						"radial-gradient(circle at 12% 0%, rgba(226,160,74,0.2), transparent 34%), radial-gradient(circle at 100% 100%, rgba(155,181,154,0.16), transparent 40%)",
				}}
			/>
			<AbsoluteFill
				style={{
					pointerEvents: "none",
					opacity: 0.16,
					backgroundImage:
						"radial-gradient(rgba(246,241,232,0.7) 0.7px, transparent 0.7px)",
					backgroundSize: "4px 4px",
				}}
			/>
			{children}
		</AbsoluteFill>
	);
};

type FrameProps = {
	readonly kicker: string;
	readonly index: string;
	readonly footer: string;
	readonly children: ReactNode;
};

export const Frame: React.FC<FrameProps> = ({ kicker, index, footer, children }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Stage>
			<div
				style={{
					position: "absolute",
					top: 64,
					left: 80,
					fontFamily: mono,
					fontSize: 26,
					letterSpacing: "0.08em",
					color: amber,
					opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					}),
				}}
			>
				{kicker}
			</div>
			<div
				style={{
					position: "absolute",
					top: 64,
					right: 80,
					fontFamily: mono,
					fontSize: 26,
					color: "rgba(246,241,232,0.45)",
				}}
			>
				{index}
			</div>
			<div
				style={{
					position: "absolute",
					left: 80,
					right: 80,
					top: 150,
					bottom: 150,
				}}
			>
				{children}
			</div>
			<div
				style={{
					position: "absolute",
					left: 80,
					right: 80,
					bottom: 64,
					display: "flex",
					justifyContent: "space-between",
					gap: 32,
					alignItems: "flex-end",
					fontSize: 32,
					lineHeight: 1.35,
					opacity: interpolate(frame, [0.25 * fps, 0.7 * fps], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					}),
				}}
			>
				<span>{footer}</span>
				<span
					style={{
						width: interpolate(frame, [0.3 * fps, 1.1 * fps], [48, 220], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
							easing: Easing.bezier(0.16, 1, 0.3, 1),
						}),
						height: 3,
						borderRadius: 99,
						backgroundColor: amber,
						flex: "0 0 auto",
					}}
				/>
			</div>
		</Stage>
	);
};

export const paperStyle: CSSProperties = {
	backgroundColor: paper,
	color: "#241c14",
	borderRadius: 28,
	boxShadow: "0 28px 80px rgba(0,0,0,0.28)",
	fontFamily: serif,
};
