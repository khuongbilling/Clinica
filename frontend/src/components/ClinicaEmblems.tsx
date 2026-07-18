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
 *   DailyRoundsEmblem — Bold calendar (header band, binding rings, lotus center)
 *   MilestonesEmblem  — Trophy cup (U-body, two handles, stepped base, lotus)
 *   WorldEventsEmblem — Celestial orb (8-point starburst rays, lotus rosette)
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
// JOURNEY — Handdrawn Open Journal / Chapter Map
// Slightly wobbly badge border, open book with bowed pages, bold spine,
// organic lotus petals on left page, wavy route notes on right page.
// ─────────────────────────────────────────────────────────────────────────────
export function JourneyEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const bgFill    = color + "22";
  const pageFill  = color + "32";
  const pageFill2 = color + "1E";
  const petalFill = color + "80";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Slightly wobbly badge border — not a perfect circle */}
      <Path
        d="M12 2.1 C15.4 1.9 18.4 3.5 20.3 6.0 C22.3 8.5 22.7 11.9 21.4 14.7
           C20.1 17.5 17.5 19.5 14.4 20.3 C11.3 21.1 7.8 20.4 5.4 18.2
           C2.9 16.0 1.9 12.6 2.6 9.5 C3.3 6.4 5.6 3.7 8.8 2.7
           C9.7 2.3 10.8 2.2 12 2.1 Z"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill={bgFill}
      />
      {/* Left page — slightly bowed, organic bezier */}
      <Path
        d="M6.1 16.9 C5.8 14.3 5.9 11.6 6.3 9.1
           C8.3 8.5 10.1 8.8 11.5 9.5
           C11.3 12.1 11.1 14.9 10.8 17.6
           C8.9 17.8 7.2 17.5 6.1 16.9 Z"
        stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
        fill={pageFill}
      />
      {/* Right page */}
      <Path
        d="M12.5 9.5 C14.0 8.8 15.8 8.5 17.9 9.1
           C18.2 11.6 18.4 14.3 18.2 16.9
           C16.8 17.5 15.2 17.8 13.3 17.6
           C13.1 14.9 12.9 12.1 12.5 9.5 Z"
        stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
        fill={pageFill2}
      />
      {/* Bold spine — confident single stroke, slight curve */}
      <Path
        d="M12.0 9.0 C11.9 11.2 11.9 14.3 12.1 17.7"
        stroke={color} strokeWidth="2.1" strokeLinecap="round" fill="none"
      />
      {/* Cap curve at top of spine (book binding arc) */}
      <Path
        d="M9.4 8.9 C10.4 8.1 11.2 7.9 12.0 7.9 C12.8 7.9 13.6 8.1 14.7 8.9"
        stroke={color} strokeWidth="1.7" strokeLinecap="round" fill="none"
      />
      {/* Lotus on left page — 4 organic handdrawn petals */}
      <Path d="M8.3 11.7 C9.1 10.3 10.2 9.8 10.3 11.3 C10.2 12.8 9.3 13.6 8.3 11.7 Z"
        fill={petalFill} stroke={color} strokeWidth="1.2" strokeLinecap="round"
        strokeLinejoin="round" />
      <Path d="M8.3 11.7 C7.2 10.9 6.4 10.0 7.5 11.2 C8.0 12.0 8.2 12.8 8.3 11.7 Z"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Path d="M8.3 11.7 C8.9 13.1 8.6 14.4 7.7 13.6 C7.0 13.0 7.3 12.1 8.3 11.7 Z"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Path d="M8.3 11.7 C9.6 12.5 10.1 13.5 9.2 13.9 C8.5 14.1 8.0 13.1 8.3 11.7 Z"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Circle cx="8.3" cy="11.7" r="1.2" fill={color} />
      {/* Wavy route/notes on right page — hand-jotted lines */}
      <Path d="M14.1 12.1 C14.9 11.9 15.6 12.0 16.6 11.9"
        stroke={color} strokeWidth="0.95" strokeLinecap="round" fill="none" opacity="0.65" />
      <Path d="M14.1 13.6 C15.1 13.4 15.8 13.5 16.9 13.4"
        stroke={color} strokeWidth="0.95" strokeLinecap="round" fill="none" opacity="0.50" />
      <Path d="M14.1 15.1 C14.8 14.9 15.5 14.9 16.2 14.8"
        stroke={color} strokeWidth="0.95" strokeLinecap="round" fill="none" opacity="0.35" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMONING — Handdrawn Academy Gate Portal
// Organic lotus starburst above, slightly irregular arch, hand-drawn pillars,
// sketchy hero silhouette within the glowing portal.
// ─────────────────────────────────────────────────────────────────────────────
export function SummoningEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const pillarFill = color + "50";
  const glowFill   = color + "28";
  const petalFill  = color + "72";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Handdrawn lotus starburst above arch */}
      <Path d="M12 0.6 C12.8 2.5 12.6 3.8 12.0 5.2 C11.4 3.8 11.2 2.5 12 0.6"
        fill={petalFill} stroke={color} strokeWidth="1.0" strokeLinecap="round" />
      <Path d="M14.7 1.5 C14.2 3.3 13.3 4.2 12.0 5.2 C12.8 3.5 13.8 2.5 14.7 1.5"
        fill={petalFill} stroke={color} strokeWidth="0.9" strokeLinecap="round" />
      <Path d="M9.3 1.5 C10.2 2.5 11.2 3.5 12.0 5.2 C10.7 4.2 9.8 3.3 9.3 1.5"
        fill={petalFill} stroke={color} strokeWidth="0.9" strokeLinecap="round" />
      <Path d="M17.2 3.5 C15.4 5.0 13.8 5.2 12.0 5.2 C13.8 4.3 15.6 3.8 17.2 3.5"
        fill={color + "50"} stroke={color} strokeWidth="0.75" strokeLinecap="round" />
      <Path d="M6.8 3.5 C8.4 3.8 10.2 4.3 12.0 5.2 C10.2 5.2 8.6 5.0 6.8 3.5"
        fill={color + "50"} stroke={color} strokeWidth="0.75" strokeLinecap="round" />
      <Circle cx="12" cy="5.2" r="1.5" fill={color} />
      {/* Portal arch — organic, slightly uneven curve */}
      <Path
        d="M4.6 16.2 C4.3 12.5 5.3 9.0 12.0 6.8 C18.7 9.0 19.7 12.5 19.4 16.2"
        stroke={color} strokeWidth="1.9" fill="none" strokeLinecap="round"
      />
      {/* Portal inner glow */}
      <Path
        d="M6.5 16.2 C6.3 12.2 7.5 9.6 12.0 8.4 C16.5 9.6 17.7 12.2 17.5 16.2 Z"
        fill={glowFill} stroke="none"
      />
      {/* Left pillar — organic, slightly tapered */}
      <Path
        d="M3.1 14.3 C2.9 17.0 2.9 20.5 3.0 23.8
           C3.8 24.0 6.3 24.0 6.5 23.8
           C6.6 20.5 6.5 17.0 6.3 14.3 Z"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill={pillarFill}
      />
      {/* Right pillar */}
      <Path
        d="M17.5 14.3 C17.3 17.0 17.4 20.5 17.4 23.8
           C17.7 24.0 20.1 24.0 21.0 23.8
           C21.1 20.5 20.9 17.0 20.8 14.3 Z"
        stroke={color} strokeWidth="1.6" strokeLinejoin="round" fill={pillarFill}
      />
      {/* Pillar caps — hand-drawn banner feel */}
      <Path d="M2.5 13.0 C3.5 12.7 5.8 12.8 7.0 13.1 C6.9 14.3 3.1 14.4 2.5 13.0 Z"
        fill={color} opacity="0.85" />
      <Path d="M17.0 13.1 C18.2 12.8 20.4 12.7 21.5 13.0 C21.0 14.4 17.1 14.3 17.0 13.1 Z"
        fill={color} opacity="0.85" />
      {/* Hero silhouette — sketchy head + robe */}
      <Circle cx="12" cy="11.1" r="2.0" stroke={color} strokeWidth="1.1" fill={color + "50"} />
      <Path
        d="M9.7 14.2 C10.7 12.8 13.3 12.8 14.3 14.2
           C14.1 17.4 13.2 18.7 12.0 19.2
           C10.8 18.7 9.9 17.4 9.7 14.2 Z"
        stroke={color} strokeWidth="1.0" strokeLinejoin="round" fill={color + "40"}
      />
      {/* Ground sill — slightly wavy */}
      <Path d="M2.1 23.5 C7.0 23.2 17.0 23.2 21.9 23.5 C22.0 24.0 22.0 24.0 21.9 24.2
               C17.0 24.0 7.0 24.0 2.1 24.2 C2.0 24.0 2.0 24.0 2.1 23.5 Z"
        fill={color} opacity="0.6" />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WARD DEFENSE — Handdrawn Shield with Lotus
// Slightly organic, slightly asymmetric shield outline drawn with cubic beziers,
// inner bevel, crest diamond, and 4 organic lotus petals at center.
// ─────────────────────────────────────────────────────────────────────────────
export function WardDefenseEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const shieldFill = color + "3C";
  const petalFill  = color + "75";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Shield outer — organic, slightly asymmetric */}
      <Path
        d="M12 1.6 C15.3 2.9 18.6 4.4 20.8 5.6
           C20.7 10.3 20.4 14.6 18.9 17.6
           C17.2 21.0 14.9 22.4 12.0 23.7
           C9.1 22.4 6.8 21.0 5.1 17.6
           C3.6 14.6 3.3 10.3 3.2 5.6
           C5.4 4.4 8.7 2.9 12.0 1.6 Z"
        stroke={color} strokeWidth="1.9" strokeLinejoin="round" fill={shieldFill}
      />
      {/* Inner bevel — slightly wobbly */}
      <Path
        d="M12 3.9 C14.7 4.9 17.3 6.2 18.8 7.1
           C18.7 11.0 18.5 14.5 17.2 17.1
           C15.8 19.9 14.0 21.1 12.0 22.0
           C10.0 21.1 8.2 19.9 6.8 17.1
           C5.5 14.5 5.3 11.0 5.2 7.1
           C6.7 6.2 9.3 4.9 12.0 3.9 Z"
        stroke={color} strokeWidth="0.8" strokeLinejoin="round" fill="none" opacity="0.48"
      />
      {/* Top crest diamond */}
      <Path d="M12.0 1.6 C13.2 3.1 13.5 4.3 12.0 5.2 C10.5 4.3 10.8 3.1 12.0 1.6 Z"
        fill={color} opacity="0.88" />
      {/* Lotus — 4 organic handdrawn petals */}
      <Path d="M12 7.7 C14.7 9.8 14.4 12.1 12.0 12.9 C9.6 12.1 9.3 9.8 12 7.7"
        fill={petalFill} stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <Path d="M16.7 12.3 C14.4 13.9 12.6 13.0 12.0 12.9 C13.8 11.3 15.5 10.9 16.7 12.3"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Path d="M12.0 17.2 C9.3 15.1 9.6 12.9 12.0 12.9 C14.4 12.9 14.7 15.1 12.0 17.2"
        fill={petalFill} stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <Path d="M7.3 12.3 C8.5 10.9 10.2 11.3 12.0 12.9 C11.4 13.0 9.6 13.9 7.3 12.3"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Circle cx="12" cy="12.6" r="1.9" fill={color} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BOSS WARD — Handdrawn Triple-Flame Dragon Seal
// Wobbly seal ring, three organic flame peaks, ink-drawn dragon coil, lotus base.
// ─────────────────────────────────────────────────────────────────────────────
export function BossWardEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const sealFill  = color + "2E";
  const flameFill = color + "7E";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Wobbly seal ring — handdrawn, not a perfect circle */}
      <Path
        d="M12 3.2 C15.6 3.0 18.9 4.8 20.9 7.7
           C22.9 10.6 23.2 14.4 21.7 17.4
           C20.2 20.4 17.2 22.5 13.9 23.1
           C10.6 23.7 7.1 22.6 4.8 20.3
           C2.5 18.0 1.7 14.5 2.6 11.3
           C3.5 8.1 6.0 5.4 9.2 4.2
           C10.1 3.7 11.1 3.3 12 3.2 Z"
        stroke={color} strokeWidth="1.7" strokeLinejoin="round" fill={sealFill}
      />
      {/* Triple flame peaks — organic, handdrawn */}
      <Path d="M12.0 2.0 C13.3 4.6 13.1 6.6 12.0 8.6 C10.9 6.6 10.7 4.6 12.0 2.0"
        fill={flameFill} stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <Path d="M8.0 3.8 C8.9 6.1 8.6 7.9 7.9 9.9 C6.9 8.3 6.6 6.3 8.0 3.8"
        fill={color + "5A"} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Path d="M16.0 3.8 C17.4 6.3 17.1 8.3 16.1 9.9 C15.4 7.9 15.1 6.1 16.0 3.8"
        fill={color + "5A"} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      {/* Dragon coil spiral — organic ink stroke */}
      <Path
        d="M12.0 10.9 C15.3 10.7 17.4 12.3 17.3 14.9
           C17.2 17.5 14.7 19.1 12.1 19.0
           C9.5 18.9 8.0 17.2 8.5 15.2
           C9.0 13.2 11.1 12.6 12.2 13.7
           C13.3 14.8 13.2 15.9 12.1 16.3"
        stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none"
      />
      {/* Dragon eye */}
      <Circle cx="14.3" cy="11.7" r="1.1" fill={color} />
      {/* Lotus base — organic */}
      <Path d="M9.1 21.9 C10.6 20.6 13.4 20.6 15.0 21.9"
        stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.72" />
      <Path d="M12 20.3 C13.6 21.1 12.9 22.5 12.0 22.9 C11.1 22.5 10.4 21.1 12.0 20.3"
        fill={color + "55"} stroke={color} strokeWidth="0.9" strokeLinecap="round" />
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
// DAILY ROUNDS — Handdrawn Calendar with Lotus Center
// Organic rounded-corner calendar, solid header, two binding rings drawn with
// bezier paths, 4-petal organic lotus, and day dots at bottom.
// ─────────────────────────────────────────────────────────────────────────────
export function DailyRoundsEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const bodyFill  = color + "28";
  const headFill  = color + "88";
  const petalFill = color + "72";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Calendar body — organic rounded corners */}
      <Path
        d="M2.2 5.3 C2.1 5.1 2.0 3.5 3.9 3.4
           C7.1 3.3 16.9 3.3 20.1 3.4
           C22.0 3.5 21.9 5.1 21.8 5.3
           C21.9 8.6 21.9 16.6 21.7 22.2
           C21.6 22.8 20.5 23.0 19.7 23.0
           C15.0 23.1 9.0 23.1 4.3 23.0
           C3.5 23.0 2.4 22.8 2.3 22.2
           C2.1 16.6 2.1 8.6 2.2 5.3 Z"
        stroke={color} strokeWidth="1.8" strokeLinejoin="round" fill={bodyFill}
      />
      {/* Header band — solid, organic edge */}
      <Path
        d="M2.2 5.3 C2.1 8.6 2.0 9.9 2.1 9.9 L21.9 9.9
           C22.0 9.9 21.9 8.6 21.8 5.3
           C21.9 5.1 22.0 3.5 20.1 3.4
           C16.9 3.3 7.1 3.3 3.9 3.4
           C2.0 3.5 2.1 5.1 2.2 5.3 Z"
        fill={headFill} stroke="none"
      />
      {/* Separator under header */}
      <Path d="M2.1 9.9 C8.0 9.7 16.0 9.7 21.9 9.9"
        stroke={color} strokeWidth="0.7" opacity="0.5" fill="none" />
      {/* Left binding ring — organic loop */}
      <Path
        d="M7.3 2.2 C8.1 2.1 9.3 2.2 9.3 2.4
           C9.4 3.6 9.4 5.9 9.3 7.1
           C9.3 7.4 8.0 7.5 7.3 7.4
           C6.6 7.3 5.9 7.1 5.9 6.9
           C5.8 5.6 5.9 3.4 6.0 2.4
           C6.0 2.2 6.5 2.3 7.3 2.2 Z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={bodyFill}
      />
      {/* Right binding ring */}
      <Path
        d="M14.9 2.2 C15.7 2.3 16.2 2.2 16.2 2.4
           C16.3 3.4 16.4 5.6 16.3 6.9
           C16.3 7.1 15.7 7.3 14.9 7.4
           C14.1 7.5 12.8 7.4 12.7 7.1
           C12.6 5.9 12.6 3.6 12.7 2.4
           C12.7 2.2 14.1 2.1 14.9 2.2 Z"
        stroke={color} strokeWidth="1.5" strokeLinejoin="round" fill={bodyFill}
      />
      {/* Day dots */}
      <Circle cx="6.5"  cy="20.3" r="1.1" fill={color} opacity="0.5" />
      <Circle cx="12"   cy="20.3" r="1.1" fill={color} opacity="0.5" />
      <Circle cx="17.5" cy="20.3" r="1.1" fill={color} opacity="0.5" />
      {/* Lotus bloom — 4 organic petals */}
      <Path d="M12 11.9 C13.9 13.8 13.6 16.0 12.0 16.5 C10.4 16.0 10.1 13.8 12.0 11.9"
        fill={petalFill} stroke={color} strokeWidth="1.3" strokeLinecap="round" />
      <Path d="M15.8 14.3 C14.1 15.7 12.6 15.2 12.0 16.0 C13.5 13.6 14.9 13.1 15.8 14.3"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Path d="M12.0 18.0 C10.1 16.1 10.4 14.1 12.0 13.9 C13.6 14.1 13.9 16.1 12.0 18.0"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Path d="M8.2 14.3 C9.1 13.1 10.5 13.6 12.0 16.0 C11.4 15.2 9.9 15.7 8.2 14.3"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Circle cx="12" cy="14.9" r="1.5" fill={color} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MILESTONES — Handdrawn Trophy Cup
// Organic U-shaped cup with asymmetric handles, rough stem + base, lotus inside.
// ─────────────────────────────────────────────────────────────────────────────
export function MilestonesEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const cupFill   = color + "38";
  const baseFill  = color + "5E";
  const petalFill = color + "72";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top rim flange — slightly tapered, organic */}
      <Path
        d="M6.3 1.9 C8.6 1.6 15.4 1.6 17.7 1.9
           C17.8 2.7 17.7 3.5 17.6 3.6
           C15.3 3.3 8.7 3.3 6.4 3.6
           C6.3 3.5 6.2 2.7 6.3 1.9 Z"
        fill={color} opacity="0.85"
      />
      {/* Cup body — organic U, slightly bowed sides */}
      <Path
        d="M7.3 3.6 C7.1 6.6 6.9 10.1 7.3 13.1
           C7.9 16.9 9.9 18.6 12.0 19.3
           C14.1 18.6 16.1 16.9 16.7 13.1
           C17.1 10.1 16.9 6.6 16.7 3.6
           C14.4 3.3 9.6 3.3 7.3 3.6 Z"
        stroke={color} strokeWidth="1.9" strokeLinejoin="round" fill={cupFill}
      />
      {/* Left handle — organic, slightly irregular arc */}
      <Path d="M7.3 5.3 C4.6 6.1 3.6 8.1 3.7 10.4 C3.8 12.6 5.1 13.6 7.3 13.3"
        stroke={color} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      {/* Right handle — slightly different (handdrawn asymmetry) */}
      <Path d="M16.7 5.3 C19.4 6.3 20.4 8.3 20.2 10.6 C20.0 12.8 18.7 13.8 16.7 13.3"
        stroke={color} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      {/* Stem — organic */}
      <Path
        d="M10.9 19.3 C11.1 20.3 11.1 21.1 10.9 21.6
           C11.6 21.7 12.4 21.7 13.1 21.6
           C12.9 21.1 12.9 20.3 13.1 19.3 Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={cupFill}
      />
      {/* Base — organic */}
      <Path
        d="M8.9 21.6 C10.1 21.4 13.9 21.4 15.1 21.6
           C15.2 22.4 15.1 23.1 15.0 23.3
           C13.4 23.2 10.6 23.2 9.0 23.3
           C8.9 23.1 8.8 22.4 8.9 21.6 Z"
        stroke={color} strokeWidth="1.2" strokeLinejoin="round" fill={baseFill}
      />
      {/* Lotus inside cup — 4 organic petals */}
      <Path d="M12 5.9 C13.9 7.7 13.6 9.9 12.0 10.4 C10.4 9.9 10.1 7.7 12 5.9"
        fill={petalFill} stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <Path d="M15.3 8.4 C13.9 9.7 12.6 9.3 12.0 9.9 C13.2 7.9 14.5 7.4 15.3 8.4"
        fill={petalFill} stroke={color} strokeWidth="1.0" strokeLinecap="round" />
      <Path d="M12 11.3 C10.4 9.6 10.6 7.9 12 7.9 C13.4 7.9 13.6 9.6 12 11.3"
        fill={petalFill} stroke={color} strokeWidth="1.0" strokeLinecap="round" />
      <Path d="M8.7 8.4 C9.5 7.4 10.8 7.9 12 9.9 C11.4 9.3 10.1 9.7 8.7 8.4"
        fill={petalFill} stroke={color} strokeWidth="1.0" strokeLinecap="round" />
      <Circle cx="12" cy="9.1" r="1.5" fill={color} />
    </Svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD EVENTS — Handdrawn Celestial Starburst Orb
// 8 organic tapered rays drawn as filled bezier diamonds, slightly wobbly
// central orb, inner glow ring, lotus rosette at center.
// ─────────────────────────────────────────────────────────────────────────────
export function WorldEventsEmblem({ size = 24, color = "#E8C868" }: EmblemProps) {
  const orbFill   = color + "32";
  const rayFill   = color + "60";
  const petalFill = color + "78";
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* 4 main organic rays — cardinal, tapered bezier diamonds */}
      <Path d="M12 1.0 C12.9 3.9 13.1 7.1 12.0 10.3 C10.9 7.1 11.1 3.9 12.0 1.0"
        fill={rayFill} stroke={color} strokeWidth="0.85" strokeLinecap="round" />
      <Path d="M23.0 12.0 C20.1 12.9 16.9 13.1 13.7 12.0 C16.9 10.9 20.1 11.1 23.0 12.0"
        fill={rayFill} stroke={color} strokeWidth="0.85" strokeLinecap="round" />
      <Path d="M12.0 23.0 C11.1 20.1 10.9 16.9 12.0 13.7 C13.1 16.9 12.9 20.1 12.0 23.0"
        fill={rayFill} stroke={color} strokeWidth="0.85" strokeLinecap="round" />
      <Path d="M1.0 12.0 C3.9 11.1 7.1 10.9 10.3 12.0 C7.1 13.1 3.9 12.9 1.0 12.0"
        fill={rayFill} stroke={color} strokeWidth="0.85" strokeLinecap="round" />
      {/* 4 diagonal shorter rays */}
      <Path d="M20.4 3.6 C18.3 6.1 16.3 8.0 13.9 10.3 C15.9 7.8 17.6 5.5 20.4 3.6"
        fill={color + "40"} stroke={color} strokeWidth="0.72" strokeLinecap="round" />
      <Path d="M20.4 20.4 C17.6 18.5 15.9 16.2 13.9 13.7 C16.3 16.0 18.3 17.9 20.4 20.4"
        fill={color + "40"} stroke={color} strokeWidth="0.72" strokeLinecap="round" />
      <Path d="M3.6 20.4 C5.7 17.9 7.7 16.0 10.1 13.7 C8.1 16.2 6.4 18.5 3.6 20.4"
        fill={color + "40"} stroke={color} strokeWidth="0.72" strokeLinecap="round" />
      <Path d="M3.6 3.6 C6.4 5.5 8.1 7.8 10.1 10.3 C7.7 8.0 5.7 6.1 3.6 3.6"
        fill={color + "40"} stroke={color} strokeWidth="0.72" strokeLinecap="round" />
      {/* Central orb — slightly wobbly, handdrawn circle */}
      <Path
        d="M12.0 6.1 C14.6 6.0 17.0 7.4 18.2 9.7
           C19.4 12.0 19.2 14.8 17.8 16.8
           C16.4 18.8 13.9 19.8 11.4 19.5
           C8.9 19.2 6.8 17.6 5.9 15.3
           C5.0 13.0 5.6 10.2 7.3 8.4
           C9.0 6.6 10.9 6.2 12.0 6.1 Z"
        stroke={color} strokeWidth="1.9" fill={orbFill}
      />
      {/* Inner glow ring — slightly offset for handdrawn feel */}
      <Path
        d="M12.0 7.6 C13.9 7.5 15.6 8.5 16.5 10.1
           C17.4 11.7 17.2 13.8 16.1 15.2
           C15.0 16.6 13.1 17.3 11.3 17.0
           C9.5 16.7 8.0 15.5 7.3 13.9
           C6.6 12.3 7.0 10.4 8.1 9.1
           C9.3 7.8 10.6 7.7 12.0 7.6 Z"
        stroke={color} strokeWidth="0.65" fill="none" opacity="0.44"
      />
      {/* Lotus rosette — 4 organic petals */}
      <Path d="M12 9.3 C13.7 10.7 13.5 12.7 12.0 13.3 C10.5 12.7 10.3 10.7 12 9.3"
        fill={petalFill} stroke={color} strokeWidth="1.1" strokeLinecap="round" />
      <Path d="M14.9 12.1 C13.7 13.7 12.3 13.1 12.0 13.3 C13.3 11.5 14.3 11.1 14.9 12.1"
        fill={petalFill} stroke={color} strokeWidth="0.95" strokeLinecap="round" />
      <Path d="M12.0 14.9 C10.3 13.5 10.5 12.1 12.0 12.1 C13.5 12.1 13.7 13.5 12.0 14.9"
        fill={petalFill} stroke={color} strokeWidth="0.95" strokeLinecap="round" />
      <Path d="M9.1 12.1 C9.7 11.1 10.7 11.5 12.0 13.3 C11.7 13.1 10.3 13.7 9.1 12.1"
        fill={petalFill} stroke={color} strokeWidth="0.95" strokeLinecap="round" />
      <Circle cx="12" cy="12" r="1.6" fill={color} />
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
  // Hub feature buttons
  "daily-rounds": DailyRoundsEmblem,
  milestones: MilestonesEmblem,
  "world-events": WorldEventsEmblem,
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
