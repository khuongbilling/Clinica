// ────────────────────────────────────────────────────────────
// UI — Luminous warm-dark design tokens (visual refresh, Push A).
//
// This layer sits ON TOP of the legacy COLORS palette in colors.ts. It does
// NOT replace it — existing (not-yet-refreshed) screens keep using COLORS.
// Refreshed screens import from here to adopt the unified, brighter,
// fantasy-medical-academy look: a warm magical base (deep plum/indigo instead
// of near-black), luminous gold + healing-teal accents, ivory/pearl text, and
// soft glow depth. Deep midnight is reserved for grief / danger / mystery.
//
// Spacing + base radius are reused from colors.ts so measurements stay
// consistent across the whole app.
// ────────────────────────────────────────────────────────────
import { RADIUS, SPACING } from "./colors";

export { SPACING };

export const UI = {
  // ── Warm-dark magical base surfaces ──
  bgDeep: "#130F1C",    // deepest page wash (warm plum-midnight, not black)
  bgBase: "#1A1526",    // main screen surface
  panel: "#241C34",     // raised panel / card
  panelHi: "#2F2544",   // highest surface (hover / active / nested)
  scrim: "rgba(14,10,22,0.72)", // legibility scrim over art

  // ── Luminous accents ──
  gold: "#E8C868",      // primary warm gold (brighter than legacy brand)
  goldSoft: "#F3DE97",  // highlight gold
  goldDeep: "#B58F38",  // pressed / border gold
  teal: "#4FD8C4",      // healing teal (secondary action / life)
  tealSoft: "#96ECDF",
  lavender: "#BBA7EA",  // lotus lavender accent
  sky: "#A6D8F6",       // soft sky blue
  rose: "#F4A9C4",      // gentle warmth accent

  // ── Text hierarchy (on warm-dark) ──
  text: "#F6F0E4",      // ivory / pearl — primary
  textSoft: "#CFC6DC",  // secondary
  textDim: "#948BA6",   // tertiary / captions
  onGold: "#1B1308",    // text/icon on gold fills
  onTeal: "#082019",    // text/icon on teal fills

  // ── Lines ──
  border: "rgba(232,200,104,0.20)",       // soft gold-tinted hairline
  borderStrong: "rgba(232,200,104,0.42)", // emphasized border
  divider: "rgba(246,240,228,0.08)",
} as const;

// Extended radius scale (card corners a touch softer than legacy lg).
export const UI_RADIUS = {
  ...RADIUS,
  card: 18,
  xl: 22,
} as const;

// ── Soft glow / depth presets (spreadable into style) ──
export const GLOW = {
  gold: {
    shadowColor: "#E8C868",
    shadowOpacity: 0.38,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  teal: {
    shadowColor: "#4FD8C4",
    shadowOpacity: 0.34,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  ambient: {
    shadowColor: "#000000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
} as const;

// ── Gradient color ramps (cast to string[] at the LinearGradient call site) ──
export const GRADIENTS = {
  page: ["#211A30", "#160F22", "#100B1A"],       // top→bottom page wash
  panel: ["rgba(52,42,74,0.94)", "rgba(33,26,49,0.96)"],
  panelGold: ["rgba(72,58,32,0.55)", "rgba(38,29,20,0.72)"],
  panelTeal: ["rgba(24,58,54,0.5)", "rgba(18,32,38,0.72)"],
  goldButton: ["#F3DE97", "#E8C868", "#C9A44A"],
  tealButton: ["#7DE6D6", "#4FD8C4", "#2FB3A2"],
  storyScrim: ["rgba(16,11,24,0)", "rgba(16,11,24,0.55)", "rgba(12,8,18,0.94)"],
} as const;

// Convenience: text style presets used across refreshed screens.
export const TEXT = {
  kicker: {
    color: UI.gold,
    fontSize: 11,
    fontWeight: "800" as const,
    letterSpacing: 2.5,
  },
  title: {
    color: UI.text,
    fontSize: 20,
    fontWeight: "800" as const,
  },
  body: {
    color: UI.textSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  caption: {
    color: UI.textDim,
    fontSize: 11,
    fontWeight: "600" as const,
    letterSpacing: 0.4,
  },
} as const;
