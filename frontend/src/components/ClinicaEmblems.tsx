/**
 * ClinicaEmblems — Donghua/anime fantasy-medical RPG seal icons.
 *
 * Design principles (redesigned for bold mobile readability):
 *   • Main outlines: strokeWidth 1.6–2.0 (not 1.0)
 *   • Key fills: 35–65 % opacity (not 10 %)
 *   • Accent / glow fills: 70–100 % for focal elements
 *   • Distinctive non-circular silhouettes — no plain rings as primary shape
 *   • 1–2 dominant shapes readable at 14–28 px
 *
 * Each emblem accepts `size` and `color`, matching <Ionicons size={n} color={c} />.
 *
 * Exports:
 *   ShiftEmblem       — Healer's ward lantern (bold hexagonal body + cross)
 *   HeroesEmblem      — Twin-healer crest (oval frame, two robed silhouettes)
 *   RealmEmblem       — Sanctuary torii gate (thick posts, lotus crown)
 *   ShopEmblem        — Apothecary bottle (solid cork, cross label)
 *   CommunityEmblem   — Guild banner pennant (hanging flag + lotus rosette)
 *   UniversityEmblem  — Lotus academy pagoda (3-tier, bold eaves)
 *   JourneyEmblem     — Parchment scroll (thick curls, big lotus, chapter seal)
 *   SummoningEmblem   — Academy gate portal (arch + lotus star + hero glow)
 *   WardDefenseEmblem — Shield with lotus (bold shield, solid petal center)
 *   BossWardEmblem    — Triple-flame dragon seal (filled flames, coil mark)
 *   LotusJournalEmblem— Open lotus flower (wide petals, filled, stem)
 *   LotusLessonsEmblem— Lesson scroll tablet (open scroll + lotus + lines)
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
// Bold hexagonal lantern body, arched handle, prominent cross, tassel drops.
// ─────────────────────────────────────────────────────────────────────────────
export function ShiftEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const body  = color + "45";   // 27 % fill — lantern body glow
  const glass = color + "25";   // subtle inner glow
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Handle arc — thick */}
      <Path
        d="M9 7 Q12 2.5 15 7"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      {/* Cap ring at top of lantern */}
      <Rect x="9.5" y="6.5" width="5" height="1.4" rx="0.7" fill={color} />
      {/* Lantern body — broad hexagon */}
      <Path
        d="M8 7.9 L5 11.5 L5 16.5 L8 20.1 L16 20.1 L19 16.5 L19 11.5 L16 7.9 Z"
        stroke={color}
        strokeWidth="1.7"
        strokeLinejoin="round"
        fill={body}
      />
      {/* Inner glass glow */}
      <Path
        d="M9.5 9.5 L7.5 12 L7.5 16 L9.5 18.5 L14.5 18.5 L16.5 16 L16.5 12 L14.5 9.5 Z"
        fill={glass}
        stroke="none"
      />
      {/* Horizontal slats — visible at larger sizes */}
      <Line x1="5.5" y1="11.5" x2="18.5" y2="11.5" stroke={color} strokeWidth="1.0" opacity="0.5" />
      <Line x1="5.5" y1="16.5" x2="18.5" y2="16.5" stroke={color} strokeWidth="1.0" opacity="0.5" />
      {/* Healing cross — bold */}
      <Path d="M12 12 L12 19" stroke={color} strokeWidth="2.0" strokeLinecap="round" />
      <Path d="M9 15 L15 15" stroke={color} strokeWidth="2.0" strokeLinecap="round" />
      {/* Base cap */}
      <Rect x="9.5" y="20.1" width="5" height="1.3" rx="0.6" fill={color} opacity="0.8" />
      {/* Tassel drops */}
      <Path
        d="M10.5 21.4 L10 23.5 M12 21.4 L12 23.5 M13.5 21.4 L14 23.5"
        stroke={color}
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.75"
      />
      <Circle cx="10" cy="23.5" r="0.7" fill={color} opacity="0.75" />
      <Circle cx="12" cy="23.5" r="0.7" fill={color} opacity="0.75" />
      <Circle cx="14" cy="23.5" r="0.7" fill={color} opacity="0.75" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEROES — Twin-Healer Crest Seal
// Thick oval frame, two prominent healer figures, bold lotus star at top.
// ─────────────────────────────────────────────────────────────────────────────
export function HeroesEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const frameFill = color + "30";
  const robeFill  = color + "50";
  const headFill  = color + "60";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Oval crest frame — thick */}
      <Ellipse
        cx="12" cy="13"
        rx="10.5" ry="11"
        stroke={color} strokeWidth="1.7" fill={frameFill}
      />
      {/* Left healer head */}
      <Circle cx="8.5" cy="7.5" r="2.4" stroke={color} strokeWidth="1.3" fill={headFill} />
      {/* Right healer head */}
      <Circle cx="15.5" cy="7.5" r="2.4" stroke={color} strokeWidth="1.3" fill={headFill} />
      {/* Left healer robe */}
      <Path
        d="M5.5 11.5 Q8.5 9.5 11.5 11.5 L11 19 Q8.5 20.5 6 19 Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={robeFill}
      />
      {/* Right healer robe */}
      <Path
        d="M12.5 11.5 Q15.5 9.5 18.5 11.5 L18 19 Q15.5 20.5 13 19 Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={robeFill}
      />
      {/* Healing cross on left robe */}
      <Path d="M8.5 13 V17 M6.8 15 H10.2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      {/* Healing cross on right robe */}
      <Path d="M15.5 13 V17 M13.8 15 H17.2" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      {/* Lotus 5-point star between heads */}
      <Path
        d="M12 1.5 L13.1 4.5 L16.2 4.5 L13.7 6.5 L14.7 9.5 L12 7.8 L9.3 9.5 L10.3 6.5 L7.8 4.5 L10.9 4.5 Z"
        stroke={color} strokeWidth="0.9" fill={color + "70"}
      />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REALM — Sanctuary Torii Gate
// Bold thick posts + double curved beam, large lotus crown, ground sill.
// ─────────────────────────────────────────────────────────────────────────────
export function RealmEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const fill = color + "45";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lotus crown — three large petals above gate */}
      <Path d="M12 0.5 Q14 3.5 12 6 Q10 3.5 12 0.5" fill={color + "80"} stroke={color} strokeWidth="1.2" />
      <Path d="M8.5 2 Q11 4 9.5 7 Q7.5 5 8.5 2" fill={color + "55"} stroke={color} strokeWidth="1.0" />
      <Path d="M15.5 2 Q13 4 14.5 7 Q16.5 5 15.5 2" fill={color + "55"} stroke={color} strokeWidth="1.0" />
      <Circle cx="12" cy="5.5" r="1.3" fill={color} />
      {/* Kasagi — upper curved beam, bold */}
      <Path
        d="M2.5 10 Q12 5 21.5 10 L22 11.8 Q12 7 2 11.8 Z"
        stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={fill}
      />
      {/* Nuki — lower straight bar */}
      <Rect x="7" y="14" width="10" height="2.2" rx="0.8" stroke={color} strokeWidth="1.3" fill={fill} />
      {/* Left post — thick */}
      <Rect x="7" y="9" width="2.5" height="13" rx="0.9" stroke={color} strokeWidth="1.3" fill={fill} />
      {/* Right post — thick */}
      <Rect x="14.5" y="9" width="2.5" height="13" rx="0.9" stroke={color} strokeWidth="1.3" fill={fill} />
      {/* Base foot caps */}
      <Rect x="6" y="21.5" width="4.5" height="1.5" rx="0.6" fill={color} opacity="0.7" />
      <Rect x="13.5" y="21.5" width="4.5" height="1.5" rx="0.6" fill={color} opacity="0.7" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHOP — Apothecary Bottle Seal
// Fat round bottle with solid cork, bold cross label, leaf flanks.
// ─────────────────────────────────────────────────────────────────────────────
export function ShopEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const body = color + "45";
  const cork = color + "75";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Cork stopper — solid */}
      <Path
        d="M9.5 3 Q12 2 14.5 3 L14 6.5 L10 6.5 Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={cork}
      />
      {/* Neck */}
      <Rect x="10.5" y="6.5" width="3" height="2.5" stroke={color} strokeWidth="1.3" fill={body} />
      {/* Bottle body — wide round bottom */}
      <Path
        d="M10.5 9 Q7.5 10 7 12.5 L7 19.5 Q7 22.5 12 22.5 Q17 22.5 17 19.5 L17 12.5 Q16.5 10 13.5 9 Z"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill={body}
      />
      {/* Decorative band rings */}
      <Path d="M7.3 13.5 Q12 13 16.7 13.5" stroke={color} strokeWidth="1.0" opacity="0.55" fill="none" />
      <Path d="M7.3 18 Q12 17.5 16.7 18" stroke={color} strokeWidth="1.0" opacity="0.55" fill="none" />
      {/* Bold healing cross on bottle */}
      <Path d="M12 14 L12 20" stroke={color} strokeWidth="2.0" strokeLinecap="round" />
      <Path d="M9.5 17 L14.5 17" stroke={color} strokeWidth="2.0" strokeLinecap="round" />
      {/* Leaf curls flanking bottle */}
      <Path d="M7 13 Q4.5 15 5.5 18" stroke={color} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.7" />
      <Path d="M17 13 Q19.5 15 18.5 18" stroke={color} strokeWidth="1.1" strokeLinecap="round" fill="none" opacity="0.7" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMMUNITY — Guild Banner Pennant
// A hanging rectangular pennant with split/notched bottom, lotus rosette
// at center, and top crossbar — NOT a circle/starburst.
// ─────────────────────────────────────────────────────────────────────────────
export function CommunityEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const bannerFill = color + "40";
  const petalFill  = color + "70";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top crossbar / pole */}
      <Rect x="3" y="1.5" width="18" height="2" rx="1" fill={color} />
      {/* Banner body */}
      <Path
        d="M4.5 3.5 L4.5 18.5 L12 22.5 L19.5 18.5 L19.5 3.5 Z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={bannerFill}
      />
      {/* Inner border line */}
      <Path
        d="M6 5 L6 17 L12 20 L18 17 L18 5 Z"
        stroke={color} strokeWidth="0.6" strokeLinejoin="round" fill="none" opacity="0.45"
      />
      {/* Lotus rosette — 8 petals at center */}
      <Path d="M12 7.5 Q13.8 9.5 12 12 Q10.2 9.5 12 7.5" fill={petalFill} stroke={color} strokeWidth="1.0" />
      <Path d="M15.5 9.5 Q13.5 11 12 12 Q13 9 15.5 9.5" fill={petalFill} stroke={color} strokeWidth="0.9" />
      <Path d="M15.5 14.5 Q13.5 13 12 12 Q14 13.5 15.5 14.5" fill={petalFill} stroke={color} strokeWidth="0.9" />
      <Path d="M12 16.5 Q10.2 14.5 12 12 Q13.8 14.5 12 16.5" fill={petalFill} stroke={color} strokeWidth="1.0" />
      <Path d="M8.5 14.5 Q10.5 13 12 12 Q10 13.5 8.5 14.5" fill={petalFill} stroke={color} strokeWidth="0.9" />
      <Path d="M8.5 9.5 Q10.5 11 12 12 Q11 9 8.5 9.5" fill={petalFill} stroke={color} strokeWidth="0.9" />
      {/* Center seed */}
      <Circle cx="12" cy="12" r="1.6" fill={color} />
      {/* Hanging tassel strings at bottom corners */}
      <Line x1="6" y1="18" x2="5.5" y2="21" stroke={color} strokeWidth="0.9" opacity="0.65" />
      <Line x1="18" y1="18" x2="18.5" y2="21" stroke={color} strokeWidth="0.9" opacity="0.65" />
      <Circle cx="5.5" cy="21.5" r="0.8" fill={color} opacity="0.65" />
      <Circle cx="18.5" cy="21.5" r="0.8" fill={color} opacity="0.65" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSITY — Lotus Academy Pagoda
// Three-tier pagoda with bold upswept eaves, solid lotus spire, doorway arch.
// ─────────────────────────────────────────────────────────────────────────────
export function UniversityEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const roofFill = color + "45";
  const bodyFill = color + "28";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Lotus spire at apex — solid */}
      <Path d="M12 0.5 Q13.2 2.5 12 4.5 Q10.8 2.5 12 0.5" fill={color} stroke={color} strokeWidth="0.8" />
      <Path d="M10 2 Q12 3.5 10.8 5.5 Q9 4 10 2" fill={color + "70"} stroke={color} strokeWidth="0.7" />
      <Path d="M14 2 Q12 3.5 13.2 5.5 Q15 4 14 2" fill={color + "70"} stroke={color} strokeWidth="0.7" />
      {/* Top tier roof — upswept eaves */}
      <Path
        d="M8.5 4.5 Q12 1.5 15.5 4.5 L17 8 L7 8 Z"
        stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={roofFill}
      />
      {/* Top tier body */}
      <Rect x="10.5" y="8" width="3" height="2.5" stroke={color} strokeWidth="1.1" fill={bodyFill} />
      {/* Mid tier roof */}
      <Path
        d="M6 10.5 Q12 7 18 10.5 L20 14 L4 14 Z"
        stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={roofFill}
      />
      {/* Mid tier body */}
      <Rect x="9" y="14" width="6" height="2.5" stroke={color} strokeWidth="1.1" fill={bodyFill} />
      {/* Base tier roof */}
      <Path
        d="M2.5 16.5 Q12 13 21.5 16.5 L23 21 L1 21 Z"
        stroke={color} strokeWidth="1.4" strokeLinejoin="round" fill={roofFill}
      />
      {/* Doorway */}
      <Path
        d="M10.5 21 L10.5 24 L13.5 24 L13.5 21"
        stroke={color} strokeWidth="1.1" strokeLinejoin="round" fill="none"
      />
      {/* Door arch */}
      <Path d="M10.5 23 Q12 21 13.5 23" stroke={color} strokeWidth="1.0" fill="none" opacity="0.7" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// JOURNEY — Parchment Scroll Chapter Map
// Wide unfurled scroll with bold thick curled ends, large lotus path marker,
// winding dotted route, and a prominent chapter seal in the corner.
// ─────────────────────────────────────────────────────────────────────────────
export function JourneyEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const scrollFill = color + "35";
  const lotusFill  = color + "65";
  const sealFill   = color + "50";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Scroll body */}
      <Rect x="3.5" y="5" width="17" height="14" rx="1.5" stroke={color} strokeWidth="1.6" fill={scrollFill} />
      {/* Left scroll roll — thick, prominent */}
      <Ellipse cx="3.5" cy="12" rx="1.8" ry="7" stroke={color} strokeWidth="1.4" fill={color + "40"} />
      <Ellipse cx="3.5" cy="12" rx="0.8" ry="5.5" stroke={color} strokeWidth="0.7" fill={color + "20"} />
      {/* Right scroll roll */}
      <Ellipse cx="20.5" cy="12" rx="1.8" ry="7" stroke={color} strokeWidth="1.4" fill={color + "40"} />
      <Ellipse cx="20.5" cy="12" rx="0.8" ry="5.5" stroke={color} strokeWidth="0.7" fill={color + "20"} />
      {/* Winding path across scroll */}
      <Path
        d="M5.5 17 L8 14 L12 11 L16 9 L18.5 7.5"
        stroke={color}
        strokeWidth="1.1"
        strokeDasharray="1.5 1.8"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
      {/* Lotus bloom on path — large, visible */}
      {/* 4 petals */}
      <Path d="M12 8.5 Q14 10 12 12 Q10 10 12 8.5" fill={lotusFill} stroke={color} strokeWidth="1.0" />
      <Path d="M15 11 Q13 12.5 12 12 Q14 10.5 15 11" fill={lotusFill} stroke={color} strokeWidth="1.0" />
      <Path d="M12 13.5 Q10 12 12 12 Q14 12 12 13.5" fill={lotusFill} stroke={color} strokeWidth="1.0" />
      <Path d="M9 11 Q11 12.5 12 12 Q10 10.5 9 11" fill={lotusFill} stroke={color} strokeWidth="1.0" />
      {/* Lotus center */}
      <Circle cx="12" cy="11.5" r="1.4" fill={color} />
      {/* Chapter seal — bold octagon in bottom-right */}
      <Path
        d="M16 15 L17 14 L18.5 14 L19.5 15 L19.5 16.5 L18.5 17.5 L17 17.5 L16 16.5 Z"
        stroke={color} strokeWidth="1.0" fill={sealFill}
      />
      <Circle cx="17.75" cy="15.75" r="1.0" fill={color} opacity="0.9" />
      {/* Start marker dot */}
      <Circle cx="6" cy="16.5" r="1.0" fill={color} opacity="0.8" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMONING — Academy Gate Portal
// Two bold pillars + curved arch, large lotus star burst above arch apex,
// glowing hero silhouette within the portal — NOT a plain circle.
// ─────────────────────────────────────────────────────────────────────────────
export function SummoningEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const pillarFill = color + "55";
  const glowFill   = color + "30";
  const petalFill  = color + "70";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* ── Lotus star burst above arch ── */}
      {/* 8 radiating petals from apex */}
      <Path d="M12 0.5 Q13 3 12 5 Q11 3 12 0.5" fill={petalFill} stroke={color} strokeWidth="0.9" />
      <Path d="M14.5 1.5 Q14 4 12 5 Q13.5 3 14.5 1.5" fill={petalFill} stroke={color} strokeWidth="0.8" />
      <Path d="M9.5 1.5 Q10 4 12 5 Q10.5 3 9.5 1.5" fill={petalFill} stroke={color} strokeWidth="0.8" />
      <Path d="M17 3.5 Q15 5.5 12 5 Q15 4 17 3.5" fill={color + "55"} stroke={color} strokeWidth="0.7" />
      <Path d="M7 3.5 Q9 5.5 12 5 Q9 4 7 3.5" fill={color + "55"} stroke={color} strokeWidth="0.7" />
      {/* Center star gem */}
      <Circle cx="12" cy="5" r="1.5" fill={color} />

      {/* ── Arch / Gate ── */}
      {/* Portal arch beam — curved */}
      <Path
        d="M4.5 16 Q4.5 6.5 12 6.5 Q19.5 6.5 19.5 16"
        stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="butt"
      />
      {/* Portal inner glow — filled arch area */}
      <Path
        d="M6.5 16 Q6.5 8.5 12 8.5 Q17.5 8.5 17.5 16 Z"
        fill={glowFill} stroke="none"
      />
      {/* Left pillar */}
      <Rect x="3" y="14" width="3.5" height="10" rx="1" stroke={color} strokeWidth="1.6" fill={pillarFill} />
      {/* Right pillar */}
      <Rect x="17.5" y="14" width="3.5" height="10" rx="1" stroke={color} strokeWidth="1.6" fill={pillarFill} />
      {/* Pillar cap ornaments */}
      <Rect x="2.5" y="13" width="4.5" height="1.5" rx="0.5" fill={color} opacity="0.85" />
      <Rect x="17" y="13" width="4.5" height="1.5" rx="0.5" fill={color} opacity="0.85" />

      {/* ── Hero figure inside portal ── */}
      {/* Head */}
      <Circle cx="12" cy="11" r="2.0" stroke={color} strokeWidth="1.0" fill={color + "50"} />
      {/* Robe */}
      <Path
        d="M9.5 14 Q12 12.5 14.5 14 L14 18.5 Q12 19.5 10 18.5 Z"
        stroke={color} strokeWidth="1.0" strokeLinejoin="round" fill={color + "40"}
      />

      {/* Ground sill */}
      <Rect x="2" y="23.5" width="20" height="1.5" rx="0.6" fill={color} opacity="0.6" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WARD DEFENSE — Shield with Lotus
// Bold pointed shield, solid inner lotus, top crest flange.
// ─────────────────────────────────────────────────────────────────────────────
export function WardDefenseEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const shieldFill = color + "40";
  const petalFill  = color + "70";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shield outer — bold */}
      <Path
        d="M12 1.5 L20.5 5.5 L20.5 14 Q20.5 20.5 12 23.5 Q3.5 20.5 3.5 14 L3.5 5.5 Z"
        stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={shieldFill}
      />
      {/* Shield inner bevel */}
      <Path
        d="M12 3.8 L18.5 7 L18.5 14 Q18.5 19 12 21.5 Q5.5 19 5.5 14 L5.5 7 Z"
        stroke={color} strokeWidth="0.8" strokeLinejoin="round" fill="none" opacity="0.5"
      />
      {/* Top crest flange */}
      <Path d="M12 1.5 L14 4 L12 5 L10 4 Z" fill={color} opacity="0.9" />
      {/* Lotus center — 4 bold petals */}
      <Path d="M12 7.5 Q14.5 9.5 12 12.5 Q9.5 9.5 12 7.5" fill={petalFill} stroke={color} strokeWidth="1.1" />
      <Path d="M16.5 12 Q14 13.5 12 12.5 Q14.5 10.5 16.5 12" fill={petalFill} stroke={color} strokeWidth="1.1" />
      <Path d="M12 17 Q9.5 15 12 12.5 Q14.5 15 12 17" fill={petalFill} stroke={color} strokeWidth="1.1" />
      <Path d="M7.5 12 Q10 10.5 12 12.5 Q9.5 13.5 7.5 12" fill={petalFill} stroke={color} strokeWidth="1.1" />
      {/* Center gem */}
      <Circle cx="12" cy="12.5" r="1.8" fill={color} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOSS WARD — Triple-Flame Dragon Seal
// Thick ring with three bold filled flames, tight coil mark, lotus base.
// ─────────────────────────────────────────────────────────────────────────────
export function BossWardEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const sealFill  = color + "30";
  const flameFill = color + "80";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Seal ring — thick */}
      <Circle cx="12" cy="13.5" r="9.5" stroke={color} strokeWidth="1.6" fill={sealFill} />
      {/* Triple flame peaks — bold filled */}
      <Path
        d="M12 2 Q14 5 12 8 Q10 5 12 2"
        fill={flameFill} stroke={color} strokeWidth="1.2"
      />
      <Path
        d="M8 4 Q9.5 7 8 9.5 Q6.5 7 8 4"
        fill={color + "60"} stroke={color} strokeWidth="1.0"
      />
      <Path
        d="M16 4 Q14.5 7 16 9.5 Q17.5 7 16 4"
        fill={color + "60"} stroke={color} strokeWidth="1.0"
      />
      {/* Dragon coil spiral */}
      <Path
        d="M12 10.5 C15 10.5 17 12 17 14.5 C17 17 14.5 18.5 12 18.5 C9.5 18.5 8 17 8.5 15 C9 13 11 12.5 12 13.5 C13 14.5 13 15.5 12 16"
        stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none"
      />
      {/* Dragon eye */}
      <Circle cx="14" cy="11.5" r="1.0" fill={color} />
      {/* Lotus base */}
      <Path d="M9 22 Q12 20 15 22" stroke={color} strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
      <Path d="M12 20 Q13.8 21 12 22.5 Q10.2 21 12 20" fill={color + "55"} stroke={color} strokeWidth="0.8" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOTUS JOURNAL — Open Lotus Flower
// Five wide filled petals, prominent stamen center, stem, leaf base.
// ─────────────────────────────────────────────────────────────────────────────
export function LotusJournalEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const petalFill = color + "55";
  const innerFill = color + "70";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Five wide petals */}
      <Path
        d="M12 3 Q15 6.5 12 11 Q9 6.5 12 3"
        fill={petalFill} stroke={color} strokeWidth="1.3"
      />
      <Path
        d="M19 7 Q17 11 13.5 10.5 Q15.5 6.5 19 7"
        fill={petalFill} stroke={color} strokeWidth="1.1"
      />
      <Path
        d="M17.5 16 Q13.5 15 13 11.5 Q16.5 12.5 17.5 16"
        fill={petalFill} stroke={color} strokeWidth="1.1"
      />
      <Path
        d="M6.5 16 Q10.5 15 11 11.5 Q7.5 12.5 6.5 16"
        fill={petalFill} stroke={color} strokeWidth="1.1"
      />
      <Path
        d="M5 7 Q7 11 10.5 10.5 Q8.5 6.5 5 7"
        fill={petalFill} stroke={color} strokeWidth="1.1"
      />
      {/* Center disc */}
      <Circle cx="12" cy="11" r="2.5" stroke={color} strokeWidth="1.2" fill={innerFill} />
      {/* Center gem */}
      <Circle cx="12" cy="11" r="1.0" fill={color} />
      {/* Stamen dots */}
      <Circle cx="10.3" cy="9.5" r="0.5" fill={color} opacity="0.8" />
      <Circle cx="13.7" cy="9.5" r="0.5" fill={color} opacity="0.8" />
      <Circle cx="12" cy="9" r="0.5" fill={color} opacity="0.8" />
      {/* Leaf base */}
      <Path
        d="M8.5 16 Q12 18.5 15.5 16 Q12 18 8.5 16"
        stroke={color} strokeWidth="1.3" fill={color + "30"} strokeLinecap="round"
      />
      {/* Stem */}
      <Path d="M12 18.5 L12 23" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      {/* Side leaf */}
      <Path d="M10 21 Q12 22 14 21" stroke={color} strokeWidth="1.0" fill="none" opacity="0.65" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOTUS LESSONS — Lesson Scroll Tablet
// Open parchment scroll (landscape) with ruled lesson lines, lotus bloom center,
// seal stamp at corner — reads as a SCROLL not a circle.
// ─────────────────────────────────────────────────────────────────────────────
export function LotusLessonsEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const scrollFill = color + "35";
  const petalFill  = color + "65";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Scroll body */}
      <Rect x="2" y="5.5" width="20" height="13" rx="1.8" stroke={color} strokeWidth="1.6" fill={scrollFill} />
      {/* Top roll cylinder */}
      <Ellipse cx="12" cy="5.5" rx="10" ry="1.8" stroke={color} strokeWidth="1.2" fill={color + "50"} />
      {/* Bottom roll cylinder */}
      <Ellipse cx="12" cy="18.5" rx="10" ry="1.8" stroke={color} strokeWidth="1.2" fill={color + "50"} />
      {/* Lesson text lines — left column */}
      <Path d="M4 9 L10.5 9" stroke={color} strokeWidth="1.0" strokeLinecap="round" opacity="0.7" />
      <Path d="M4 11 L10 11" stroke={color} strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
      <Path d="M4 13 L10.5 13" stroke={color} strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
      <Path d="M4 15 L9 15" stroke={color} strokeWidth="0.7" strokeLinecap="round" opacity="0.45" />
      {/* Lotus bloom — right side of scroll */}
      {/* 4 petals */}
      <Path d="M16.5 9.5 Q18.5 11 16.5 13 Q14.5 11 16.5 9.5" fill={petalFill} stroke={color} strokeWidth="1.0" />
      <Path d="M19.5 12 Q18 13.5 16.5 12 Q18 10.5 19.5 12" fill={petalFill} stroke={color} strokeWidth="0.9" />
      <Path d="M16.5 14.5 Q15 13 16.5 12 Q18 13 16.5 14.5" fill={petalFill} stroke={color} strokeWidth="0.9" />
      <Path d="M13.5 12 Q15 10.5 16.5 12 Q15 13.5 13.5 12" fill={petalFill} stroke={color} strokeWidth="0.9" />
      {/* Center seed */}
      <Circle cx="16.5" cy="12" r="1.3" fill={color} />
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
  recruitment: SummoningEmblem,
  // Lotus Lessons
  "lotus-lessons": LotusLessonsEmblem,
  "lotus-scroll": LotusLessonsEmblem,
  // University section banners (imageKey → emblem mapping)
  "uni-lessons": LotusLessonsEmblem,
  "uni-recruit": SummoningEmblem,
  "uni-training": HeroesEmblem,
  "uni-library": JourneyEmblem,
  "uni-classtree": UniversityEmblem,
  "uni-skill-academy": UniversityEmblem,
  // Shop / Apothecary Market banners
  "apothecary-market": ShopEmblem,
  "summoning-altar": SummoningEmblem,
  "regalia-upgrades": WardDefenseEmblem,
  "sanctuary-bank": ShopEmblem,
  "night-market": CommunityEmblem,
  "event-shop": ShopEmblem,
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
