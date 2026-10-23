import { useState } from "react";

const messy =
	"ok so launch moved to next friday i think. sarah said email the venue. budget note is stale";
const clean =
	"The launch moved to next Friday. Email the venue, as Sarah asked. The budget note is out of date.";

export const CleanupDemo: React.FC = () => {
	const [applied, setApplied] = useState(false);

	return (
		<div className="demo">
			<div className="demo-note">
				<p className="kicker">Note</p>
				<p>{applied ? clean : messy}</p>
			</div>
			<div className="demo-note demo-preview">
				<p className="kicker">Preview</p>
				<p>{clean}</p>
			</div>
			<div className="demo-actions">
				<button
					type="button"
					className="button primary"
					onClick={() => setApplied(true)}
					disabled={applied}
				>
					{applied ? "Applied on this page" : "Apply"}
				</button>
				{applied ? (
					<button type="button" className="button" onClick={() => setApplied(false)}>
						Reset the sample
					</button>
				) : null}
			</div>
			<p className="fine">
				A sample on this page. In Obsidian, Apply writes only the reviewed range.
			</p>
		</div>
	);
};
