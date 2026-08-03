/**
 * PrologueVNBar
 *
 * Shared VN dialogue component used across all prologue scenes.
 * Renders two layers — always as absolute overlays inside the scene's root:
 *
 *   1. Character portrait — right-aligned, bottom-flush with the dialogue bar,
 *      74% of screen width, with left-edge and bottom feather gradients.
 *
 *   2. Dialogue bar — bottom of screen:
 *        [accent strip]
 *        [ avatar 92×92 ]  dialogue text…          [ ▾ ]
 *        [  speaker name ]
 *
 * Animation values (barSlide, barFade, charFade) are driven by the parent scene
 * so each scene keeps full control over its timeline.
 *
 * Helper: vnSpeakerFor(id) converts a PrologueSpeakerId to a VNSpeakerDef
 * using the canonical PROLOGUE_CHARACTERS data + per-character VN art configs.
 */

import { Animated, Dimensions, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  PROLOGUE_CHARACTERS,
  type PrologueSpeakerId,
} from "../../game/prologueCharacters";

const { width: W, height: H } = Dimensions.get("window");

// ── Per-character VN art config (artFit + portrait height at 74% screen width) ─
//
// ADDING A NEW CHARACTER?
//   • Add an entry here keyed by the same name used in PROLOGUE_CHARACTERS
//     (src/game/prologueCharacters.ts).
//   • `Record<PrologueSpeakerId, …>` is exhaustive — TypeScript will fail to
//     compile if a key is missing, and `npm run validate` runs
//     scripts/check-prologue-vn-cfg.js which also catches the gap.
//   • artHeight formula: Math.round(W * 0.74 * <imgH> / <imgW>)
//     where <imgH>/<imgW> are the portrait PNG's native pixel dimensions.
//   • Use artFit:"cover" only when the portrait is already a full-bleed crop
//     (like Nightingale's extended image) — otherwise use "contain".

const VN_ART_CFG: Record<
  PrologueSpeakerId,
  { artFit: "contain" | "cover"; artHeight?: number }
> = {
  PRODIGY:     { artFit: "contain", artHeight: Math.round(W * 0.74 * 1060 / 896) },
  MASTER_BAI:  { artFit: "contain", artHeight: Math.round(W * 0.74 * 1040 / 896) },
  NIGHTINGALE: { artFit: "cover" },
  FLEMING:     { artFit: "contain", artHeight: Math.round(W * 0.74 * 1203 / 896) },
};

// ── Public speaker type ───────────────────────────────────────────────────────

export interface VNSpeakerDef {
  /** Display name shown below the avatar ring. May contain \n for two lines. */
  name:          string;
  /** Accent colour used for border, name, caret, arrow. */
  color:         string;
  /** Bar background colour (usually dark, matching the character palette). */
  barColor:      string;
  /** Full-height large portrait shown to the right of the screen. */
  largePortrait: any;
  /** Small bust/avatar shown inside the 92 × 92 avatar ring. */
  avatar:        any;
  /** contentFit for the large portrait (contain for most, cover for Nightingale). */
  artFit:        "contain" | "cover";
  /** Explicit portrait height (px). Omit for Nightingale-style full-cover. */
  artHeight?:    number;
  /** contentFit for the avatar ring. Defaults to "cover". Use "contain" for non-face art. */
  avatarFit?:    "contain" | "cover";
}

/**
 * Build a VNSpeakerDef for a canonical prologue character.
 * Import this helper into scene files to avoid duplicating the SPEAKERS record.
 */
export function vnSpeakerFor(id: PrologueSpeakerId): VNSpeakerDef {
  const ch  = PROLOGUE_CHARACTERS[id];
  const cfg = VN_ART_CFG[id];
  return {
    name:         ch.name,
    color:        ch.color,
    barColor:     ch.barColor,
    largePortrait: ch.largePortrait,
    avatar:        ch.avatar48,
    artFit:        cfg.artFit,
    artHeight:     cfg.artHeight,
  };
}

// ── Default bar height (excluding safe-area inset) ───────────────────────────

export const VN_BAR_HEIGHT = 200;

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  speaker:       VNSpeakerDef;
  displayed:     string;
  typewriterDone: boolean;
  /** translateY start value for slide-in animation (parent-driven). */
  barSlide:      Animated.Value;
  /** Opacity of the dialogue bar (parent-driven). */
  barFade:       Animated.Value;
  /** Opacity of the character portrait (parent-driven). */
  charFade:      Animated.Value;
  /** Height of the dialogue bar in px, NOT including safe-area inset. Default: 200. */
  barHeight?:    number;
  /**
   * Whether to show the ▾ advance arrow.
   * Defaults to `typewriterDone`. Pass explicitly to suppress on autoEnd beats.
   */
  showArrow?:    boolean;
  /**
   * Whether to render the right-side character portrait.
   * Set false during stages where the speaker portrait is shown elsewhere
   * (e.g. the SI central portrait during its monologue).
   */
  showPortrait?: boolean;
  /**
   * 'monologue' renders the SI-style italic/pinkish text with no caret or arrow.
   * Default: 'normal'.
   */
  textVariant?:  "normal" | "monologue";
  /** Hide the entire component (portrait + bar). Default: true (visible). */
  visible?:      boolean;
}

export default function PrologueVNBar({
  speaker,
  displayed,
  typewriterDone,
  barSlide,
  barFade,
  charFade,
  barHeight    = VN_BAR_HEIGHT,
  showArrow,
  showPortrait = true,
  textVariant  = "normal",
  visible      = true,
}: Props) {
  const insets   = useSafeAreaInsets();
  const barTotal = barHeight + insets.bottom;

  if (!visible) return null;

  const arrowVisible = showArrow !== undefined ? showArrow : typewriterDone;
  const isMonologue  = textVariant === "monologue";
  const avatarFit    = speaker.avatarFit ?? "cover";

  return (
    <>
      {/* ── charPortrait — right side, bottom flush with bar ───────────── */}
      {showPortrait && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.charPortrait,
            {
              bottom:    barTotal,
              transform: [{ translateY: barSlide }],
              width:     W * 0.74,
              height:    Math.min(speaker.artHeight ?? (H - barTotal), H - barTotal),
              opacity:   charFade,
            },
          ]}
        >
          <ExpoImage
            source={speaker.largePortrait}
            style={{ width: "100%", height: "100%" }}
            contentFit={speaker.artFit}
          />
          {/* bottom feather */}
          <LinearGradient
            colors={["transparent", "rgba(4,8,18,0.96)"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={s.charBottomFade}
            pointerEvents="none"
          />
        </Animated.View>
      )}

      {/* ── VN Dialogue Bar ──────────────────────────────────────────────── */}
      <Animated.View
        style={[
          s.bar,
          {
            opacity:         barFade,
            transform:       [{ translateY: barSlide }],
            height:          barTotal,
            paddingBottom:   insets.bottom + 14,
            backgroundColor: speaker.barColor,
            borderTopColor:  `${speaker.color}66`,
          },
        ]}
        pointerEvents="none"
      >
        {/* Top accent strip */}
        <View style={[s.barAccent, { backgroundColor: speaker.color }]} />

        <View style={s.barInner}>
          {/* Left column: avatar ring + speaker name */}
          <View style={s.leftCol}>
            <View style={[s.avatarRing, { borderColor: speaker.color }]}>
              <ExpoImage
                source={speaker.avatar}
                style={s.avatarImg}
                contentFit={avatarFit}
              />
            </View>
            <Text
              style={[s.speakerName, { color: speaker.color }]}
              numberOfLines={2}
            >
              {speaker.name}
            </Text>
          </View>

          {/* Dialogue text */}
          <View style={s.textCol}>
            {isMonologue ? (
              <Text style={s.dlgMonologue} numberOfLines={4}>{displayed}</Text>
            ) : (
              <Text style={s.dlgText} numberOfLines={4}>
                {displayed}
                {!typewriterDone && (
                  <Text style={{ color: speaker.color }}>▌</Text>
                )}
              </Text>
            )}
          </View>

          {/* Advance arrow — hidden for monologue and when explicitly suppressed */}
          {arrowVisible && !isMonologue && (
            <View style={s.arrowWrap}>
              <Text style={[s.arrow, { color: speaker.color }]}>▾</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  /** The large full-height character portrait — right-aligned, bottom flush with the bar. */
  charPortrait: {
    position:        "absolute",
    right:           0,
    overflow:        "hidden",
    backgroundColor: "transparent",
  },

  charBottomFade: {
    position: "absolute",
    bottom:   0,
    left:     0,
    right:    0,
    height:   "32%",
  },

  bar: {
    position:       "absolute",
    bottom:         0,
    left:           0,
    right:          0,
    borderTopWidth: 1.5,
  },
  barAccent: { height: 2, width: "100%", opacity: 0.8 },

  barInner: {
    flex:              1,
    flexDirection:     "row",
    alignItems:        "center",
    paddingHorizontal: 16,
    paddingVertical:   12,
    gap:               14,
  },

  leftCol: {
    alignItems: "center",
    gap:        6,
    flexShrink: 0,
    width:      92,
  },
  avatarRing: {
    width:        92,
    height:       92,
    borderRadius: 46,
    borderWidth:  3,
    overflow:     "hidden",
  },
  avatarImg: { width: "100%", height: "100%" },

  speakerName: {
    fontSize:      10,
    fontWeight:    "800",
    letterSpacing: 1.2,
    textAlign:     "center",
    textTransform: "uppercase",
    lineHeight:    14,
  },

  textCol: { flex: 1 },

  dlgText: {
    color:      "#E8EEF6",
    fontSize:   17,
    fontWeight: "400",
    lineHeight: 26,
  },

  /** SI / enemy monologue style — italic, de-saturated red, no caret. */
  dlgMonologue: {
    color:         "rgba(255,210,210,0.92)",
    fontSize:      16,
    fontWeight:    "300",
    lineHeight:    26,
    letterSpacing: 0.6,
    fontStyle:     "italic",
  },

  arrowWrap: { alignSelf: "flex-end", paddingBottom: 4, flexShrink: 0 },
  arrow:     { fontSize: 24, fontWeight: "900", opacity: 0.9 },
});
