import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadPlayfair } from "@remotion/google-fonts/PlayfairDisplay";

const inter = loadInter("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

const playfair = loadPlayfair("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
});

loadPlayfair("italic", {
  weights: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
});

export const fontSans = inter.fontFamily;
export const fontSerif = playfair.fontFamily;
