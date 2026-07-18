/**
 * ClinicaEmblems — Donghua/anime fantasy-medical RPG seal icons.
 *
 * Each emblem is an SVG component (24×24 viewBox) that accepts `size` and
 * `color` props, matching the same API as `<Ionicons size={n} color={c} />`.
 * All shapes use soft-curved linework with a light tinted fill for depth,
 * evoking hand-drawn academy-seal calligraphy in jade/gold palette.
 *
 * Exported:
 *   ShiftEmblem       — Healer's ward lantern sigil
 *   HeroesEmblem      — Twin-healer crest seal
 *   RealmEmblem       — Sanctuary torii gate emblem
 *   ShopEmblem        — Apothecary bottle seal
 *   CommunityEmblem   — World-lotus eight-petal rosette
 *   UniversityEmblem  — Lotus academy tower crest
 *   JourneyEmblem     — Parchment scroll chapter map
 *   SummoningEmblem   — Hero-gate lotus star seal
 *   WardDefenseEmblem — Diamond shield with lotus
 *   BossWardEmblem    — Tri-flame dragon seal
 *   LotusJournalEmblem— Open lotus plate flower
 *
 *   ClinicaEmblem     — Unified lookup component: <ClinicaEmblem id="shift" />
 *   getModeEmblem     — Returns a ReactNode for a given mode ID
 */

import React from "react";
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
} from "react-native-svg";

export interface EmblemProps {
  size?: number;
  color?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHIFT — Healer's Ward Lantern
// Hexagonal lantern body, arched handle, healing cross, tassel drops.
// ─────────────────────────────────────────────────────────────────────────────
export function ShiftEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "1A";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Handle arc */}
      <Path
        d="M9.5 7 Q12 3 14.5 7"
        stroke={color}
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lantern body — octagonal */}
      <Path
        d="M8.5 7 L5.5 10.5 L5.5 16 L8.5 19.5 L15.5 19.5 L18.5 16 L18.5 10.5 L15.5 7 Z"
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Decorative slats */}
      <Line x1="5.5" y1="10.5" x2="18.5" y2="10.5" stroke={color} strokeWidth="0.8" opacity="0.55" />
      <Line x1="5.5" y1="16" x2="18.5" y2="16" stroke={color} strokeWidth="0.8" opacity="0.55" />
      {/* Healing cross */}
      <Path d="M12 11 L12 17.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M9.5 14 L14.5 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      {/* Tassel drops */}
      <Path
        d="M10.5 19.5 L10 22 M12 19.5 L12 22.5 M13.5 19.5 L14 22"
        stroke={color}
        strokeWidth="0.9"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Small bead at bottom of each tassel */}
      <Circle cx="10" cy="22.2" r="0.6" fill={color} opacity="0.7" />
      <Circle cx="12" cy="22.7" r="0.6" fill={color} opacity="0.7" />
      <Circle cx="14" cy="22.2" r="0.6" fill={color} opacity="0.7" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEROES — Twin-Healer Crest Seal
// Two healer silhouettes inside an oval crest, lotus star between them.
// ─────────────────────────────────────────────────────────────────────────────
export function HeroesEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "18";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Oval crest frame */}
      <Ellipse cx="12" cy="12" rx="10.5" ry="11" stroke={color} strokeWidth="1.1" fill={fill} />
      {/* Inner accent ring */}
      <Ellipse cx="12" cy="12" rx="8.5" ry="9" stroke={color} strokeWidth="0.5" opacity="0.35" fill="none" />
      {/* Left healer head */}
      <Circle cx="8.5" cy="7.5" r="2.2" stroke={color} strokeWidth="1.1" fill={fill} />
      {/* Right healer head */}
      <Circle cx="15.5" cy="7.5" r="2.2" stroke={color} strokeWidth="1.1" fill={fill} />
      {/* Left healer robe */}
      <Path
        d="M5.8 11 Q8.5 9.5 11.2 11 L10.8 17 Q8.5 18.5 6.2 17 Z"
        stroke={color}
        strokeWidth="1.0"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Right healer robe */}
      <Path
        d="M12.8 11 Q15.5 9.5 18.2 11 L17.8 17 Q15.5 18.5 13.2 17 Z"
        stroke={color}
        strokeWidth="1.0"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Small healing cross on each robe */}
      <Path d="M8.5 12.5 V15.5 M7 14 H10" stroke={color} strokeWidth="0.85" strokeLinecap="round" opacity="0.75" />
      <Path d="M15.5 12.5 V15.5 M14 14 H17" stroke={color} strokeWidth="0.85" strokeLinecap="round" opacity="0.75" />
      {/* Lotus star between heads at top */}
      <Path
        d="M12 3 L12.9 5.2 L15.2 5.2 L13.5 6.7 L14.2 9 L12 7.8 L9.8 9 L10.5 6.7 L8.8 5.2 L11.1 5.2 Z"
        stroke={color}
        strokeWidth="0.7"
        fill={color + "55"}
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REALM — Sanctuary Torii Gate
// Two posts, curved kasagi, middle nuki bar, lotus crown above.
// ─────────────────────────────────────────────────────────────────────────────
export function RealmEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "18";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lotus crown petals above gate */}
      <Path d="M12 1 Q13.3 3.5 12 5.5 Q10.7 3.5 12 1" fill={color + "70"} stroke={color} strokeWidth="0.8" />
      <Path d="M9 3 Q11 4.5 10 6.5 Q8.5 5 9 3" fill={color + "50"} stroke={color} strokeWidth="0.7" />
      <Path d="M15 3 Q13 4.5 14 6.5 Q15.5 5 15 3" fill={color + "50"} stroke={color} strokeWidth="0.7" />
      {/* Kasagi — top curved beam */}
      <Path
        d="M4 9.5 Q12 5.5 20 9.5 L20 11 Q12 7 4 11 Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Nuki — middle straight bar */}
      <Rect x="7.5" y="13" width="9" height="1.8" rx="0.6" stroke={color} strokeWidth="1.0" fill={fill} />
      {/* Left post */}
      <Rect x="7.5" y="9" width="2" height="13" rx="0.8" stroke={color} strokeWidth="1.0" fill={fill} />
      {/* Right post */}
      <Rect x="14.5" y="9" width="2" height="13" rx="0.8" stroke={color} strokeWidth="1.0" fill={fill} />
      {/* Ground sill */}
      <Path d="M6.5 21.5 Q12 21 17.5 21.5" stroke={color} strokeWidth="1.0" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOP — Apothecary Bottle Seal
// Round-bottomed medicine bottle, cork stopper, healing cross, leaf curls.
// ─────────────────────────────────────────────────────────────────────────────
export function ShopEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "18";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cork / stopper */}
      <Path
        d="M9.8 4 Q12 3 14.2 4 L14.2 6.5 L9.8 6.5 Z"
        stroke={color}
        strokeWidth="1.0"
        strokeLinejoin="round"
        fill={color + "45"}
      />
      {/* Neck */}
      <Rect x="10.5" y="6.5" width="3" height="3" stroke={color} strokeWidth="1.0" fill={fill} />
      {/* Shoulder transition */}
      <Path
        d="M10.5 9.5 Q8.5 9.8 8 11 L8 20 Q8 22 12 22 Q16 22 16 20 L16 11 Q15.5 9.8 13.5 9.5 Z"
        stroke={color}
        strokeWidth="1.2"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Decorative horizontal rings on body */}
      <Path d="M8.2 13 Q12 12.5 15.8 13" stroke={color} strokeWidth="0.7" opacity="0.5" fill="none" />
      <Path d="M8.2 17.5 Q12 17 15.8 17.5" stroke={color} strokeWidth="0.7" opacity="0.5" fill="none" />
      {/* Healing cross on body */}
      <Path d="M12 13.5 V18.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <Path d="M9.5 16 H14.5" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      {/* Leaf curls flanking bottle */}
      <Path d="M8 13 Q5.5 14 6 17" stroke={color} strokeWidth="0.85" strokeLinecap="round" fill="none" opacity="0.65" />
      <Path d="M16 13 Q18.5 14 18 17" stroke={color} strokeWidth="0.85" strokeLinecap="round" fill="none" opacity="0.65" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY — World-Lotus Eight-Petal Rosette
// Eight-point starburst with outer ring and center lotus dot.
// ─────────────────────────────────────────────────────────────────────────────
export function CommunityEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer circle ring */}
      <Circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1.0" fill="none" />
      {/* Eight-point lotus star */}
      <Path
        d="M12 2.5 L13.3 8.8 L18.7 5.3 L15.2 10.7 L21.5 12 L15.2 13.3 L18.7 18.7 L13.3 15.2 L12 21.5 L10.7 15.2 L5.3 18.7 L8.8 13.3 L2.5 12 L8.8 10.7 L5.3 5.3 L10.7 8.8 Z"
        stroke={color}
        strokeWidth="1.0"
        strokeLinejoin="round"
        fill={color + "22"}
      />
      {/* Inner accent circle */}
      <Circle cx="12" cy="12" r="3.5" stroke={color} strokeWidth="0.8" fill={color + "30"} />
      {/* Center lotus dot */}
      <Circle cx="12" cy="12" r="1.4" fill={color} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSITY — Lotus Academy Tower Crest
// Three-tiered pagoda with upswept eaves and lotus-tip spire.
// ─────────────────────────────────────────────────────────────────────────────
export function UniversityEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "1A";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lotus spire at apex */}
      <Path d="M12 1 Q13 2.5 12 4 Q11 2.5 12 1" fill={color} stroke={color} strokeWidth="0.6" />
      <Path d="M10.5 2.5 Q12 3.5 11 5 Q9.5 4 10.5 2.5" fill={color + "55"} stroke={color} strokeWidth="0.5" />
      <Path d="M13.5 2.5 Q12 3.5 13 5 Q14.5 4 13.5 2.5" fill={color + "55"} stroke={color} strokeWidth="0.5" />
      {/* Top tier roof */}
      <Path
        d="M9 5 Q12 2.5 15 5 L16.5 7.5 L7.5 7.5 Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Top tier body */}
      <Rect x="10.5" y="7.5" width="3" height="2.5" stroke={color} strokeWidth="1.0" fill={fill} />
      {/* Mid tier roof */}
      <Path
        d="M6.5 10 Q12 7 17.5 10 L19 13 L5 13 Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Mid tier body */}
      <Rect x="9.5" y="13" width="5" height="2.5" stroke={color} strokeWidth="1.0" fill={fill} />
      {/* Base tier roof */}
      <Path
        d="M3.5 15.5 Q12 12 20.5 15.5 L22 19.5 L2 19.5 Z"
        stroke={color}
        strokeWidth="1.1"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Doorway base */}
      <Path
        d="M10 19.5 L10 23 L14 23 L14 19.5"
        stroke={color}
        strokeWidth="1.0"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Door arch */}
      <Path d="M10 22 Q12 20 14 22" stroke={color} strokeWidth="0.8" fill="none" opacity="0.6" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY — Parchment Scroll Chapter Map
// Unfurled scroll with curled ends, a lotus-marked path, and a chapter seal.
// ─────────────────────────────────────────────────────────────────────────────
export function JourneyEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "18";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Scroll body */}
      <Rect x="4" y="5.5" width="16" height="13" rx="1.5" stroke={color} strokeWidth="1.2" fill={fill} />
      {/* Left scroll curl */}
      <Path
        d="M4 5.5 Q2 6.5 2.5 9 Q3 11 4 11"
        stroke={color}
        strokeWidth="1.0"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M4 12.5 Q2 13 2.5 15.5 Q3 17.5 4 18.5"
        stroke={color}
        strokeWidth="1.0"
        strokeLinecap="round"
        fill="none"
      />
      {/* Right scroll curl */}
      <Path
        d="M20 5.5 Q22 6.5 21.5 9 Q21 11 20 11"
        stroke={color}
        strokeWidth="1.0"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M20 12.5 Q22 13 21.5 15.5 Q21 17.5 20 18.5"
        stroke={color}
        strokeWidth="1.0"
        strokeLinecap="round"
        fill="none"
      />
      {/* Dotted path line across scroll */}
      <Path
        d="M5.5 16 L8 13.5 L11.5 11 L15 9 L18.5 7.5"
        stroke={color}
        strokeWidth="0.8"
        strokeDasharray="1.2 1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.75"
      />
      {/* Lotus flower on path midpoint */}
      <Circle cx="12" cy="11.5" r="1.8" stroke={color} strokeWidth="0.9" fill={color + "30"} />
      <Path d="M12 9 Q13 10 12 11.5 Q11 10 12 9" fill={color + "60"} stroke="none" />
      <Path d="M14 11.5 Q13 12.5 12 11.5 Q13 10.5 14 11.5" fill={color + "60"} stroke="none" />
      <Path d="M12 14 Q11 13 12 11.5 Q13 13 12 14" fill={color + "60"} stroke="none" />
      <Path d="M10 11.5 Q11 10.5 12 11.5 Q11 12.5 10 11.5" fill={color + "60"} stroke="none" />
      {/* Chapter seal — small octagon in bottom-right corner */}
      <Path
        d="M16.5 15.5 L17.5 14.5 L18.8 14.5 L19.8 15.5 L19.8 16.8 L18.8 17.8 L17.5 17.8 L16.5 16.8 Z"
        stroke={color}
        strokeWidth="0.7"
        fill={color + "25"}
      />
      <Circle cx="18.15" cy="16.15" r="0.8" fill={color} opacity="0.8" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMONING — Hero Gate Lotus Star Seal
// Circular gate ring with eight radial lotus petals and inner hero silhouette.
// ─────────────────────────────────────────────────────────────────────────────
export function SummoningEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "1A";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Outer seal ring */}
      <Circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1.3" fill={fill} />
      {/* Inner ring */}
      <Circle cx="12" cy="12" r="8" stroke={color} strokeWidth="0.7" fill="none" opacity="0.5" />
      {/* Eight radial lotus petals */}
      <Path d="M12 2.5 Q13.5 6 12 8 Q10.5 6 12 2.5" fill={color + "55"} stroke={color} strokeWidth="0.8" />
      <Path d="M21.5 12 Q18 13.5 16 12 Q18 10.5 21.5 12" fill={color + "55"} stroke={color} strokeWidth="0.8" />
      <Path d="M12 21.5 Q10.5 18 12 16 Q13.5 18 12 21.5" fill={color + "55"} stroke={color} strokeWidth="0.8" />
      <Path d="M2.5 12 Q6 10.5 8 12 Q6 13.5 2.5 12" fill={color + "55"} stroke={color} strokeWidth="0.8" />
      <Path d="M19.1 4.9 Q17 8 14.8 7.2 Q16 4.5 19.1 4.9" fill={color + "40"} stroke={color} strokeWidth="0.7" />
      <Path d="M19.1 19.1 Q16 17 16.8 14.8 Q19.5 16 19.1 19.1" fill={color + "40"} stroke={color} strokeWidth="0.7" />
      <Path d="M4.9 19.1 Q7 17 9.2 17.8 Q8 20.5 4.9 19.1" fill={color + "40"} stroke={color} strokeWidth="0.7" />
      <Path d="M4.9 4.9 Q8 7 7.2 9.2 Q4.5 8 4.9 4.9" fill={color + "40"} stroke={color} strokeWidth="0.7" />
      {/* Central hero silhouette — simplified standing figure */}
      <Circle cx="12" cy="9.5" r="1.8" stroke={color} strokeWidth="1.0" fill={color + "30"} />
      <Path
        d="M9.5 13 Q12 11 14.5 13 L14 17 Q12 18 10 17 Z"
        stroke={color}
        strokeWidth="0.9"
        strokeLinejoin="round"
        fill={color + "25"}
      />
      {/* Glow rays between petals */}
      <Line x1="12" y1="4" x2="12" y2="2" stroke={color} strokeWidth="0.5" opacity="0.4" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WARD DEFENSE — Diamond Shield with Lotus
// Pointed shield outline, inner lotus motif, corner flanges.
// ─────────────────────────────────────────────────────────────────────────────
export function WardDefenseEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "18";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shield outer */}
      <Path
        d="M12 2 L20 6 L20 14 Q20 19.5 12 23 Q4 19.5 4 14 L4 6 Z"
        stroke={color}
        strokeWidth="1.3"
        strokeLinejoin="round"
        fill={fill}
      />
      {/* Shield inner inset */}
      <Path
        d="M12 4.5 L18 7.5 L18 14 Q18 18.5 12 21 Q6 18.5 6 14 L6 7.5 Z"
        stroke={color}
        strokeWidth="0.6"
        strokeLinejoin="round"
        fill="none"
        opacity="0.4"
      />
      {/* Lotus center — 4 petals */}
      <Path d="M12 8 Q13.5 10 12 12 Q10.5 10 12 8" fill={color + "60"} stroke={color} strokeWidth="0.8" />
      <Path d="M16 12 Q14 13.5 12 12 Q14 10.5 16 12" fill={color + "60"} stroke={color} strokeWidth="0.8" />
      <Path d="M12 16 Q10.5 14 12 12 Q13.5 14 12 16" fill={color + "60"} stroke={color} strokeWidth="0.8" />
      <Path d="M8 12 Q10 10.5 12 12 Q10 13.5 8 12" fill={color + "60"} stroke={color} strokeWidth="0.8" />
      <Circle cx="12" cy="12" r="1.5" fill={color} />
      {/* Top corner flanges */}
      <Path d="M12 2 L13.5 4 L12 4.5 L10.5 4 Z" fill={color + "55"} stroke="none" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOSS WARD — Triple-Flame Dragon Seal
// Three flame peaks, coiled inner mark, lotus base — danger / final encounter.
// ─────────────────────────────────────────────────────────────────────────────
export function BossWardEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "1A";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Circular seal ring */}
      <Circle cx="12" cy="13" r="9.5" stroke={color} strokeWidth="1.1" fill={fill} />
      {/* Triple flame peaks */}
      <Path
        d="M12 2 Q13.5 5 12 7.5 Q10.5 5 12 2"
        fill={color + "70"}
        stroke={color}
        strokeWidth="1.0"
      />
      <Path
        d="M8.5 4 Q9.5 6.5 8 8.5 Q6.5 6.5 8.5 4"
        fill={color + "50"}
        stroke={color}
        strokeWidth="0.9"
      />
      <Path
        d="M15.5 4 Q14.5 6.5 16 8.5 Q17.5 6.5 15.5 4"
        fill={color + "50"}
        stroke={color}
        strokeWidth="0.9"
      />
      {/* Inner coil/spiral — dragon mark */}
      <Path
        d="M12 10 C14.5 10 16 11.5 16 13.5 C16 15.5 14 17 12 17 C10 17 8.5 15.5 9 14 C9.5 12.5 11 12 12 12.5 C13 13 13 14 12 14.5"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
      {/* Dragon eye dot */}
      <Circle cx="13.5" cy="11.5" r="0.8" fill={color} />
      {/* Lotus base beneath seal */}
      <Path
        d="M7.5 21.5 Q12 19.5 16.5 21.5"
        stroke={color}
        strokeWidth="1.0"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <Path d="M12 19.5 Q13.5 20.5 12 22 Q10.5 20.5 12 19.5" fill={color + "45"} stroke={color} strokeWidth="0.7" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOTUS JOURNAL — Open Lotus Plate Flower
// Five open petals, stamens, leaf base, stem — wellness / off-shift.
// ─────────────────────────────────────────────────────────────────────────────
export function LotusJournalEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "30";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Five petals */}
      <Path d="M12 4 Q14 7 12 10 Q10 7 12 4" fill={fill} stroke={color} strokeWidth="1.1" />
      <Path d="M18 7.5 Q16.5 10.5 13.5 10.5 Q15 7 18 7.5" fill={fill} stroke={color} strokeWidth="1.0" />
      <Path d="M17 15.5 Q14 15 13 12 Q16 12.5 17 15.5" fill={fill} stroke={color} strokeWidth="1.0" />
      <Path d="M7 15.5 Q10 15 11 12 Q8 12.5 7 15.5" fill={fill} stroke={color} strokeWidth="1.0" />
      <Path d="M6 7.5 Q7.5 10.5 10.5 10.5 Q9 7 6 7.5" fill={fill} stroke={color} strokeWidth="1.0" />
      {/* Center */}
      <Circle cx="12" cy="11" r="2.2" stroke={color} strokeWidth="1.0" fill={color + "45"} />
      <Circle cx="12" cy="11" r="0.9" fill={color} />
      {/* Stamens dots */}
      <Circle cx="10.5" cy="9.5" r="0.4" fill={color} opacity="0.7" />
      <Circle cx="13.5" cy="9.5" r="0.4" fill={color} opacity="0.7" />
      <Circle cx="12" cy="9" r="0.4" fill={color} opacity="0.7" />
      {/* Leaf */}
      <Path
        d="M9.5 15.5 Q12 18 14.5 15.5 Q12 17 9.5 15.5"
        stroke={color}
        strokeWidth="1.1"
        fill={color + "22"}
        strokeLinecap="round"
      />
      {/* Stem */}
      <Path d="M12 17.5 L12 22" stroke={color} strokeWidth="1.0" strokeLinecap="round" />
      <Path d="M10.5 20 Q12 21 13.5 20" stroke={color} strokeWidth="0.8" fill="none" opacity="0.6" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED LOOKUP
// ─────────────────────────────────────────────────────────────────────────────

const EMBLEM_BY_ID: Record<string, React.FC<EmblemProps>> = {
  // Bottom tab IDs
  shift: ShiftEmblem,
  heroes: HeroesEmblem,
  realm: RealmEmblem,
  shop: ShopEmblem,
  community: CommunityEmblem,
  // Mode card IDs (from modeHub.ts)
  "ward-shift": ShiftEmblem,
  "university": UniversityEmblem,
  "ward-defense": WardDefenseEmblem,
  "boss-ward": BossWardEmblem,
  "lotus-journal": LotusJournalEmblem,
  "grand-rounds": JourneyEmblem,
  "grand-rounds-library": JourneyEmblem,
  "case-study-archive": JourneyEmblem,
  "expedition": JourneyEmblem,
  "code-blue": BossWardEmblem,
  "scholars-arena": UniversityEmblem,
  "knowledge-bowl": CommunityEmblem,
  "knowledge-bowl-practice": UniversityEmblem,
  "clinical-simulation-lab": ShiftEmblem,
  "epidemic-response": CommunityEmblem,
  // Journey / Summoning aliases
  journey: JourneyEmblem,
  summoning: SummoningEmblem,
  recruit: SummoningEmblem,
};

interface ClinicaEmblemProps extends EmblemProps {
  id: string;
}

/** Unified emblem component — renders the emblem for the given mode/tab ID. */
export function ClinicaEmblem({ id, size = 24, color = "#E8C868" }: ClinicaEmblemProps) {
  const Emblem = EMBLEM_BY_ID[id];
  if (!Emblem) return null;
  return <Emblem size={size} color={color} />;
}

/** Returns a ReactNode for embedding in mode card banners. Returns null for unknown IDs. */
export function getModeEmblem(id: string, size: number, color: string): React.ReactNode {
  const Emblem = EMBLEM_BY_ID[id];
  if (!Emblem) return null;
  return <Emblem size={size} color={color} />;
}
