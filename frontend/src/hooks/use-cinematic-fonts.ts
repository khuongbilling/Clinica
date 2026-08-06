/**
 * Cinematic typography for the prologue.
 *
 * Two custom faces, loaded from bundled project assets (NOT node_modules —
 * Metro under Expo Go resolves node_modules .ttf assets unreliably on
 * Android, see use-icon-fonts.ts):
 *
 *   • Cinzel SemiBold        — elegant engraved display serif. Identity card,
 *                              kicker tags, scene labels, speaker names.
 *   • Cormorant Garamond 500 — refined readable serif (+ true italic).
 *                              Narration lines and VN dialogue text.
 *
 * useFonts caches globally, so calling this hook in multiple components is
 * cheap. Callers must degrade gracefully: apply the families only when
 * `loaded` is true (via cinematicFontStyles) so a slow load falls back to
 * system text instead of blocking or crashing.
 *
 * NOTE: when a custom family IS applied we also reset fontWeight/fontStyle to
 * normal — otherwise Android/web synthesize a fake bold/oblique on top of the
 * already-styled face.
 */

import { useFonts } from "expo-font";
import type { TextStyle } from "react-native";

export const FONT_DISPLAY          = "Cinzel-SemiBold";
export const FONT_NARRATION        = "CormorantGaramond-Medium";
export const FONT_NARRATION_ITALIC = "CormorantGaramond-MediumItalic";

export const useCinematicFonts = (): readonly [boolean, Error | null] =>
  useFonts({
    [FONT_DISPLAY]:          require("../../assets/fonts/Cinzel_600SemiBold.ttf"),
    [FONT_NARRATION]:        require("../../assets/fonts/CormorantGaramond_500Medium.ttf"),
    [FONT_NARRATION_ITALIC]: require("../../assets/fonts/CormorantGaramond_500Medium_Italic.ttf"),
  });

export interface CinematicFontStyles {
  display:         TextStyle | null;
  narration:       TextStyle | null;
  narrationItalic: TextStyle | null;
}

/** Font-family style fragments, or nulls while fonts are still loading. */
export function cinematicFontStyles(loaded: boolean): CinematicFontStyles {
  if (!loaded) return { display: null, narration: null, narrationItalic: null };
  return {
    display:         { fontFamily: FONT_DISPLAY,   fontWeight: "normal" },
    narration:       { fontFamily: FONT_NARRATION, fontWeight: "normal" },
    narrationItalic: {
      fontFamily: FONT_NARRATION_ITALIC,
      fontWeight: "normal",
      fontStyle:  "normal",
    },
  };
}
