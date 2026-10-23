/** Tokens oficiais do Agendê — `src/app/globals.css`. */
export const C = {
  cream: "#fbf4ee",
  blush: "#f3c4c2",
  peach: "#e8b4a0",
  rose: "#c45d7c",
  roseInk: "#9a3d58",
  wine: "#6b2d42",
  wineDeep: "#5c1a2e",
  navPill: "#8d3b51",
  paper: "#ffffff",
  canvas: "#faf3ee",
  metricBlush: "#fdecea",
  metricSand: "#f8ebdd",
  metricIvory: "#f7f1dc",
  metricLilac: "#f4eef3",
  confirmedBg: "#e5f5ec",
  confirmedFg: "#14663c",
  scheduledBg: "#f8e4ea",
  scheduledFg: "#7a3050",
  ink: "#4a3140",
  muted: "#5e4450",
  border: "#eadfd8",
  ring: "#f0e4de",
  success: "#1f6b45",
  white: "#fffaf8",
} as const;

export const shadowCard = "0 18px 50px -32px rgb(99 29 56 / 0.34)";
export const shadowPhone = "0 40px 80px -28px rgb(92 26 46 / 0.42)";
export const shadowSoft = "0 18px 40px -30px rgba(92,26,46,0.5)";

export const FPS = 30;
export const DURATION = 72 * FPS;

export const SCENES = {
  bookingIntro: { from: 0, dur: 8 * FPS },
  bookingFlow: { from: 8 * FPS, dur: 12 * FPS },
  agenda: { from: 20 * FPS, dur: 12 * FPS },
  manage: { from: 32 * FPS, dur: 13 * FPS },
  finance: { from: 45 * FPS, dur: 13 * FPS },
  close: { from: 58 * FPS, dur: 14 * FPS },
} as const;
