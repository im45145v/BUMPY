import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { amber, ink, mono, sans, serif } from "../theme";
import { Frame, paperStyle } from "../ui";

const cells = [
	"",
	"",
	"",
	"1",
	"2",
	"3",
	"4",
	"5",
	"6",
	"7",
	"8",
	"9",
	"10",
	"11",
	"12",
	"13",
	"14",
	"15",
	"16",
	"17",
	"18",
	"19",
	"20",
	"21",
	"22",
	"23",
	"24",
	"25",
	"26",
	"27",
	"28",
	"29",
	"30",
	"31",
	"",
];

export const TasksScene: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	return (
		<Frame kicker="Tasks" index="05" footer="Open tasks, on a month you can scan.">
			<div style={{ display: "flex", gap: 36, height: "100%", alignItems: "stretch" }}>
				<div
					style={{
						...paperStyle,
						width: 760,
						padding: 32,
						opacity: interpolate(frame, [0, 0.4 * fps], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
					}}
				>
					<div
						style={{
							display: "flex",
							justifyContent: "space-between",
							fontFamily: serif,
							fontSize: 36,
							marginBottom: 18,
						}}
					>
						<span>October 2026</span>
						<span style={{ fontFamily: mono, fontSize: 22 }}>example</span>
					</div>
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(7, 1fr)",
							gap: 8,
						}}
					>
						{["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
							<div
								key={`${label}-${index}`}
								style={{ textAlign: "center", fontFamily: mono, fontSize: 20, opacity: 0.55 }}
							>
								{label}
							</div>
						))}
						{cells.map((day, index) => {
							const due = day === "23";
							return (
								<div
									key={`${day}-${index}`}
									style={{
										height: 58,
										borderRadius: 12,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontFamily: sans,
										fontSize: 24,
										backgroundColor: due ? amber : "rgba(36,28,20,0.05)",
										color: due ? ink : "#241c14",
										outline: due ? `3px solid ${ink}` : "none",
										scale: due
											? interpolate(frame, [0.8 * fps, 1.2 * fps], [0.9, 1], {
													extrapolateLeft: "clamp",
													extrapolateRight: "clamp",
													output: "perceptual-scale",
												})
											: 1,
									}}
								>
									{day}
								</div>
							);
						})}
					</div>
				</div>
				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
						gap: 22,
					}}
				>
					<div style={{ fontFamily: serif, fontSize: 64, letterSpacing: "-0.04em", lineHeight: 0.95 }}>
						Pay rent, with a date.
					</div>
					<div
						style={{
							fontFamily: mono,
							fontSize: 32,
							padding: "22px 24px",
							borderRadius: 18,
							backgroundColor: "rgba(246,241,232,0.08)",
							opacity: interpolate(frame, [0.7 * fps, 1.1 * fps], [0, 1], {
								extrapolateLeft: "clamp",
								extrapolateRight: "clamp",
							}),
						}}
					>
						- [ ] Pay rent 📅 2026-10-23
					</div>
					<div style={{ fontFamily: sans, fontSize: 30, lineHeight: 1.4 }}>
						A time becomes a reminder. A vague phrase asks you to pick the day.
					</div>
				</div>
			</div>
		</Frame>
	);
};
