/**
 * Clinica Design System — TypeScript token constants.
 *
 * Every token here mirrors the CSS custom properties defined in styles.css.
 * Import these in component logic when you need values in JS (animation,
 * inline styles, canvas drawing, etc.) so you never string-match CSS vars.
 *
 * @example
 *   import { COLOR_JADE, DURATION_BASE } from '@workspace/clinica-ds/tokens';
 */

// ── Colours ──────────────────────────────────────────────────────────────────
export const COLOR_BACKGROUND       = '#07141D';
export const COLOR_PANEL            = '#0B1C25';
export const COLOR_PANEL_RAISED     = '#102A31';
export const COLOR_PANEL_OBJECTIVE  = '#16343B';
export const COLOR_JADE             = '#82D5BA';
export const COLOR_TEAL_BRIGHT      = '#55C8B7';
export const COLOR_GOLD_ANTIQUE     = '#C7A15D';
export const COLOR_GOLD_BRIGHT      = '#E1C27C';
export const COLOR_IVORY            = '#F0E7D5';
export const COLOR_MUTED            = '#9DA8AA';

/** Convenience colour map for iteration (e.g. palette swatches). */
export const COLORS = {
  background:      COLOR_BACKGROUND,
  panel:           COLOR_PANEL,
  panelRaised:     COLOR_PANEL_RAISED,
  panelObjective:  COLOR_PANEL_OBJECTIVE,
  jade:            COLOR_JADE,
  tealBright:      COLOR_TEAL_BRIGHT,
  goldAntique:     COLOR_GOLD_ANTIQUE,
  goldBright:      COLOR_GOLD_BRIGHT,
  ivory:           COLOR_IVORY,
  muted:           COLOR_MUTED,
} as const;

// ── Typography ────────────────────────────────────────────────────────────────
export const FONT_DISPLAY = "'Marcellus', Georgia, serif";
export const FONT_UI      = "'Source Sans 3', system-ui, sans-serif";
export const FONT_CINZEL  = "'Cinzel', Georgia, serif";

// ── Geometry ──────────────────────────────────────────────────────────────────
export const RADIUS_SM   = 6;
export const RADIUS_MD   = 12;
export const RADIUS_LG   = 18;
export const RADIUS_XL   = 24;
export const RADIUS_PILL = 999;

export const SHORTCUT_CARD_W = 88;
export const SHORTCUT_CARD_H = 96;
export const PAGE_GUTTER     = 16;
export const TOUCH_MIN       = 44;

// ── Motion ────────────────────────────────────────────────────────────────────
export const DURATION_FAST  = 120; // ms
export const DURATION_BASE  = 220; // ms
export const DURATION_SLOW  = 400; // ms
export const DURATION_SCENE = 650; // ms
export const EASE_DEFAULT   = 'cubic-bezier(0.4, 0, 0.2, 1)';

// ── Shadows (as CSS box-shadow strings) ───────────────────────────────────────
export const SHADOW_TEAL    = '0 0 12px 2px rgba(85, 200, 183, 0.45)';
export const SHADOW_GOLD    = '0 0 10px 1px rgba(199, 161, 93, 0.55)';
export const SHADOW_AMBIENT = '0 4px 24px 0 rgba(7, 20, 29, 0.7)';
export const SHADOW_PANEL   = '0 2px 8px 0 rgba(7, 20, 29, 0.5)';

// ── State opacity constants ───────────────────────────────────────────────────
export const OPACITY_DISABLED = 0.38;
export const OPACITY_NAV_INACTIVE = 0.55;
