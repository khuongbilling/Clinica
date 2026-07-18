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

  // ── Healing Sanctuary / Academy sky-navy surfaces ──────────────────────────
  // These replace the cyber-black COLORS.surface tones in non-battle screens
  // (University, Journey Map, Class Result, Community Board). They read as
  // "deep healing sanctuary" rather than "black dashboard" while keeping
  // enough contrast for all body text to remain readable.
  sanctuaryBg:     "#0B1825",                    // deepest wash — sky-navy, not black
  sanctuaryPanel:  "#122030",                    // raised panel — sky-navy with warmth
  sanctuaryCard:   "#192C3C",                    // card surface — highest elevation
  sanctuaryBorder: "rgba(61,196,168,0.18)",      // jade hairline border
  jade:            "#3DC4A8",                    // jade green accent (academy/healing)
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

// ── Global type scale — Push 1 Readability Pass.
// Clinica reads like a luminous portrait-mode donghua RPG academy, not a
// compact dark dashboard. Every size here is a minimum floor — individual
// screens can go larger, never smaller.
//
// Rules enforced here:
//   • No gameplay instruction text below 14 px.
//   • No tutorial / cutscene / story text below 16 px.
//   • Letter spacing on small ALL-CAPS kickers kept ≤ 1.5 to avoid over-spacing.
//   • Line heights for body copy provide comfortable clinical reading.
export const TYPO = {
  // Screen / page level
  screenTitle:  32,   // H1 — main page title (tab home, hub headers)
  heroTitle:    28,   // H1 variant — large hero-section heading
  pageTitle:    26,   // H1 compact — when screen estate is tight

  // Section level
  sectionHead:  21,   // H2 — section group header
  subtitle:     18,   // page-level subtitle / intro line

  // Card level
  cardTitle:    18,   // H3 — card/item title
  cardSubtitle: 15,   // card secondary text / brief description

  // Body — 16 is the minimum for any multi-line explanatory text (clinical,
  // tutorial, story). Short single-line labels may use 14.
  body:         16,   // primary paragraph / description / tutorial text (min)
  bodySmall:    14,   // compact body (requirements, lore, flavor text)
  bodyMin:      14,   // absolute minimum for any readable gameplay instruction

  // UI chrome — meta/label text on badges, stat lines, timestamps
  label:        14,   // UI labels, stat names
  meta:         13,   // metadata, counters, secondary stats
  chip:         13,   // reward chips, small status badges
  kicker:       12,   // decorative ALL-CAPS kickers (accent color, ≤1.5 tracking)
  micro:        12,   // absolute floor — only for decorative overlay text

  // Interactive
  button:       16,   // primary CTA button text
  buttonSm:     14,   // secondary / ghost button text
  tab:          13,   // tab bar labels
} as const;

// ── Line heights — pair with TYPO values for comfortable reading.
export const LINE = {
  tight:    1.25,   // compact single-line labels
  snug:     1.35,   // card subtitles, short descriptions
  normal:   1.5,    // body text, clinical explanations
  relaxed:  1.65,   // tutorial / story / cutscene text (max comfort)
} as const;

// Convenience: absolute line height values pre-paired with TYPO body sizes.
export const LH = {
  body:      24,    // TYPO.body (16) × 1.5
  bodySmall: 21,    // TYPO.bodySmall (14) × 1.5
  narrative: 26,    // story / cutscene paragraphs — extra air
  label:     20,    // TYPO.label (14) in multi-line contexts
} as const;

// Convenience: text style presets used across refreshed screens.
export const TEXT = {
  kicker: {
    color: UI.gold,
    fontSize: 12,
    fontWeight: "800" as const,
    letterSpacing: 1.2,
  },
  title: {
    color: UI.text,
    fontSize: 30,
    fontWeight: "800" as const,
  },
  body: {
    color: UI.textSoft,
    fontSize: 16,
    lineHeight: 25,
  },
  caption: {
    color: UI.textDim,
    fontSize: 13,
    fontWeight: "600" as const,
    letterSpacing: 0.3,
  },
} as const;
