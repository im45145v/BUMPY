import { loadFont as loadFraunces } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadPlex } from "@remotion/google-fonts/IBMPlexMono";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

const fraunces = loadFraunces("normal", {
	weights: ["500", "600", "700"],
	subsets: ["latin"],
});

const outfit = loadOutfit("normal", {
	weights: ["400", "500", "600"],
	subsets: ["latin"],
});

const plex = loadPlex("normal", {
	weights: ["400", "500"],
	subsets: ["latin"],
});

export const serif = fraunces.fontFamily;
export const sans = outfit.fontFamily;
export const mono = plex.fontFamily;

export const ink = "#14110e";
export const cream = "#f6f1e8";
export const paper = "#f3ecdf";
export const amber = "#e2a04a";
export const moss = "#9bb59a";
export const mute = "rgba(246, 241, 232, 0.62)";
