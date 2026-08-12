/**
 * journeyMap/chapterMapTemplates.ts — AUTHORED MAP ADJUSTMENT (Push 1)
 *
 * CANONICAL RULE
 * ──────────────
 * Each Chapter owns ONE fixed authored hex-map template.  The following are
 * frozen per chapter and never change across attempts, rechallenges, shifts,
 * or regenerations:
 *   • exact hex coordinates     • overall map shape
 *   • total tile count          • starting tile
 *   • Chapter Boss Gate tile
 *
 * A new Chapter attempt randomizes ONLY the encounter layer — that continues
 * to come from the per-run secure seed via the existing canonical encounter
 * generator.  Geometry does NOT read the run seed.
 *
 * TWO PUBLIC EXPORTS
 * ──────────────────
 * getChapterMapTemplate(chapter)  → ChapterMapTemplate (new typed API)
 * getChapterHexTopology(chapter)  → HexTopology (used by run lifecycle / createRun)
 *
 * Both are fully validated on first access and cached.
 *
 * AUTHORED DATA vs PROCEDURAL FALLBACK
 * ─────────────────────────────────────
 * Chapters 1–10 (Book I) are CHECKED-IN LITERAL COORDINATE DATA — snapshotted
 * once so future generator / PRNG changes can never redraw a shipped map.
 * Chapters 11+ fall back to deterministic procedural generation from a fixed
 * per-chapter design seed (not a per-run seed) until they are authored and
 * added to AUTHORED_CHAPTER_MAPS.
 *
 * ⚠ NEVER edit an AUTHORED_CHAPTER_MAPS entry once shipped.
 */

import { generateHexTopology, bfsDistances } from './topology';
import { getChapterTerrainCellCount }         from './config';
import type { AxialCoord, HexTopology }      from './topology';
import type {
  ChapterMapTemplate,
  ChapterMapTemplateTile,
  ChapterTileRole,
  ChapterTileTag,
} from './chapterMapTemplate.types';

// ── Canonical environment ids (Book I) ────────────────────────────────────────
//
// Push 4: renamed to reflect each chapter's distinct tactical identity.
// These ids are matched against the art / ambient asset registry when
// per-environment artwork ships.  Only change ids here if the art team
// renames an environment — changing them silently breaks asset lookups.
//
//   Ch  1  Atrium Approach         — Introductory Central Courtyard
//   Ch  2  Teaching Ward           — University Teaching Ward
//   Ch  3  Procedure Hall          — Procedure / Training Hall
//   Ch  4  Emergency Simulation    — Code Rush / Emergency Simulation hub
//   Ch  5  Sanctuary Courtyard     — Sanctuary / Supply Courtyard
//   Ch  6  Outer Ward Transition   — First step beyond the core university
//   Ch  7  Outbreak Ward           — Fever Season / Outbreak clinical zone
//   Ch  8  Broken Handoff Floor    — Multi-wing transitional floor
//   Ch  9  Judgment Corridor       — Weight of Judgment irregular ward
//   Ch 10  First Oath Capstone     — Grand arena / University Era culmination

const CHAPTER_ENVIRONMENT_IDS: Readonly<Record<number, string>> = {
  1:  'atrium-approach',       // Ch 1 — kept from original; do not rename
  2:  'teaching-ward',         // Ch 2 — University Teaching Ward
  3:  'procedure-hall',        // Ch 3 — Procedure / Training Hall
  4:  'emergency-simulation',  // Ch 4 — Code Rush / Emergency Simulation hub
  5:  'sanctuary-courtyard',   // Ch 5 — Sanctuary / Supply Courtyard
  6:  'outer-ward-transition', // Ch 6 — Transition beyond the core university
  7:  'outbreak-ward',         // Ch 7 — Fever Season / Outbreak Ward
  8:  'broken-handoff-floor',  // Ch 8 — Broken Handoff multi-wing floor
  9:  'judgment-corridor',     // Ch 9 — Weight of Judgment
  10: 'first-oath-capstone',   // Ch 10 — First Oath Capstone arena
};

function environmentIdFor(chapter: number): string {
  return CHAPTER_ENVIRONMENT_IDS[chapter] ?? `chapter-${chapter}`;
}

// ── Authored geometry data (Book I, chapters 1–10) ───────────────────────────
// ⚠ NEVER edit a shipped entry — it redraws that chapter's canonical map.

interface AuthoredRawMap {
  readonly start: string;                                   // "q,r"
  readonly gate:  string;                                   // "q,r"
  readonly tiles: ReadonlyArray<readonly [number, number]>; // [q, r] pairs
}

const AUTHORED_CHAPTER_MAPS: Readonly<Record<number, AuthoredRawMap>> = {
  /**
   * Chapter 1 — "Atrium Approach"
   *
   * 30-cell dense hexagonal tactical battlefield.
   * Philosophy: Final Fantasy Tactics hex field — dense centre, curved perimeter,
   * interior cells offer multiple movement directions, no narrow corridors.
   *
   * Layout (axial portrait orientation, r increases downward):
   *
   *   r=-3 (top cap, 3)     ·  ·  ⬡  ⬡  ⬡        q= 0  1  2
   *   r=-2 (4)              · ⬡  ⬡  ⬡  ⬡         q=-1  0  1  2
   *   r=-1 (5)             ⬡  ⬡  ⬡  ⬡  ⬡         q=-1  0  1  2  3
   *   r= 0 (6, widest)   ⬡  ⬡  ⬡  ⬡  ⬡  ⬡        q=-2 -1  0  1  2  3
   *   r= 1 (5)            ⬡  ⬡  ⬡  ⬡  ⬡           q=-2 -1  0  1  2
   *   r= 2 (4)             ⬡  ⬡  ⬡  ⬡             q=-1  0  1  2
   *   r= 3 (bottom, 3)      ⬡  ⬡  ⬡               q=-1  0  1
   *
   * Tile counts per row: 3+4+5+6+5+4+3 = 30 ✓
   *
   * Shape properties:
   *   • 7 rows, 6-cell maximum width
   *   • Every cell has ≥3 in-set hex neighbours → no dead-ends, no corridors
   *
   * Start / Gate placement (Push 3 — locked):
   *
   *   Start  (−1, 2)  lower-left wing of the atrium floor, row r=2.
   *                   4 neighbours: (0,2) (−1,3) (−1,1) (0,1).
   *                   Player enters from an off-centre lower position with
   *                   3–4 immediate exploration directions.
   *
   *   Gate   ( 3, 0)  rightmost cell of the grand-hall row (r=0, widest).
   *                   3 neighbours: (2,0) (3,−1) (2,1).
   *                   The Chapter Boss Gate stands at the far-right terminus
   *                   of the atrium colonnade — visible from the hall floor,
   *                   sealed until 3/3 keys are claimed.
   *                   BFS distance from start: 4 hops.
   *                   Row r=0 is the architectural heart of the map —
   *                   gate is NOT auto-placed at the top cap (r=−3).
   *
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  1: {
    start: '-1,2',
    gate:  '3,0',
    tiles: [
      // Row r=-3 (top cap, 3 cells)
      [ 0,-3],[ 1,-3],[ 2,-3],
      // Row r=-2 (4 cells)
      [-1,-2],[ 0,-2],[ 1,-2],[ 2,-2],
      // Row r=-1 (5 cells)
      [-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],
      // Row r= 0 (widest, 6 cells)  Gate → (3,0)
      [-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],
      // Row r= 1 (5 cells)
      [-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],
      // Row r= 2 (4 cells)  Start → (-1,2)
      [-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],
      // Row r= 3 (bottom cap, 3 cells)
      [-1, 3],[ 0, 3],[ 1, 3],
    ],
  },
  /**
   * Chapter 2 — "Teaching Ward"
   *
   * 30-cell rounded-square tactical map.
   * Philosophy: organised rows of hexes — a controlled university clinical
   * floor where every bed bay is within sight of the central nursing station.
   * The rectangular silhouette contrasts with Chapter 1's circular atrium.
   *
   * Layout (portrait, r increases downward):
   *
   *   r=-2 (top strip, 4)    · ⬡ ⬡ ⬡ ⬡ ·      q= 1  2  3  4
   *   r=-1 (upper, 6)       ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q= 0  1  2  3  4  5
   *   r= 0 (6)              ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q= 0  1  2  3  4  5
   *   r= 1 (6)              ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q= 0  1  2  3  4  5
   *   r= 2 (5)              ⬡ ⬡ ⬡ ⬡ ⬡ ·       q= 0  1  2  3  4
   *   r= 3 (bottom, 3)      · ⬡ ⬡ ⬡ · ·       q= 1  2  3
   *
   * Tile counts: 4+6+6+6+5+3 = 30 ✓
   *
   * Start  (1, 3)   lower-left bed-bay, 3 exit directions.
   * Gate   (4,−2)   top-right ward door — secured senior-staff corridor.
   *                 BFS distance from start: 5 hops.
   *
   * Visual era (Chs 1–3): polished university / supervised training.
   * Bright, structured, safe.
   */
  2: {
    start: '1,3',
    gate:  '4,-2',
    tiles: [
      // Row r=-2 (top strip, 4 cells)  Gate → (4,−2)
      [ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],
      // Row r=-1 (upper corridor, 6 cells)
      [ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],
      // Row r= 0 (central corridor, 6 cells)
      [ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],
      // Row r= 1 (lower corridor, 6 cells)
      [ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],
      // Row r= 2 (approach, 5 cells)
      [ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],
      // Row r= 3 (entry bay, 3 cells)  Start → (1,3)
      [ 1, 3],[ 2, 3],[ 3, 3],
    ],
  },

  /**
   * Chapter 3 — "Procedure Hall"
   *
   * 30-cell wide horizontal oval.
   * Philosophy: a long lateral training hall — think skills lab or anatomy
   * suite.  The 4-row × 8-column footprint gives substantially more lateral
   * movement than vertical, contrasting with the portrait maps of Ch1-2.
   *
   * Layout (landscape, 4 rows):
   *
   *   r=-1 (7)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ·     q= 0  1  2  3  4  5  6
   *   r= 0 (8)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-1  0  1  2  3  4  5  6
   *   r= 1 (8)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-1  0  1  2  3  4  5  6
   *   r= 2 (7)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q= 0  1  2  3  4  5  6
   *
   * Tile counts: 7+8+8+7 = 30 ✓
   *
   * Start  (6, 2)   bottom-right procedure station.
   * Gate   (0,−1)   top-left secured exit — forces full hall traversal.
   *                 BFS distance from start: 9 hops.
   *
   * Visual era (Chs 1–3): polished university / supervised training.
   */
  3: {
    start: '6,2',
    gate:  '0,-1',
    tiles: [
      // Row r=-1 (upper hall, 7 cells)  Gate → (0,−1)
      [ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],
      // Row r= 0 (main procedure corridor, 8 cells)
      [-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],[ 6, 0],
      // Row r= 1 (procedure stations mirror, 8 cells)
      [-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],[ 6, 1],
      // Row r= 2 (lower hall, 7 cells)  Start → (6,2)
      [ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],[ 5, 2],[ 6, 2],
    ],
  },

  /**
   * Chapter 4 — "Emergency Simulation"
   *
   * 30-cell vertical diamond / radial hub.
   * Philosophy: an emergency simulation centre with a central triage corridor
   * (widest row r=0) radiating to a top bay and a bottom staging area.
   * The north–south elongation and single wide hub row create a "radial"
   * sense without needing literal arms — all movement funnels through the
   * central triage.  Chapter Boss Gate anchors the east terminus of the hub.
   *
   * Layout (portrait diamond, r=−3 → r=4):
   *
   *   r=-3 (top, 2)       · ⬡ ⬡ ·          q= 0  1
   *   r=-2 (4)           ⬡ ⬡ ⬡ ⬡           q=-1  0  1  2
   *   r=-1 (4)           ⬡ ⬡ ⬡ ⬡           q=-1  0  1  2
   *   r= 0 (hub, 6)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ →Gate  q=-2 -1  0  1  2  3
   *   r= 1 (5)          ⬡ ⬡ ⬡ ⬡ ⬡          q=-2 -1  0  1  2
   *   r= 2 (4)          ⬡ ⬡ ⬡ ⬡            q=-2 -1  0  1
   *   r= 3 (3)           ⬡ ⬡ ⬡              q=-1  0  1
   *   r= 4 (base, 2)      ⬡ ⬡               q= 0  1
   *
   * Tile counts: 2+4+4+6+5+4+3+2 = 30 ✓
   *
   * Start  (0, 4)   southern staging zone, 2 initial directions.
   * Gate   (3, 0)   east terminus of the central triage hub.
   *                 BFS distance from start: 4 hops (straight up the hub).
   *
   * Visual era (Chs 4–6): simulation facilities intensify — emergency
   * training, elaborate wards, late-shift environments.
   */
  4: {
    start: '0,4',
    gate:  '3,0',
    tiles: [
      // Row r=-3 (top cap, 2 cells)
      [ 0,-3],[ 1,-3],
      // Row r=-2 (4 cells)
      [-1,-2],[ 0,-2],[ 1,-2],[ 2,-2],
      // Row r=-1 (4 cells)
      [-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],
      // Row r= 0 (triage hub, widest, 6 cells)  Gate → (3,0)
      [-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],
      // Row r= 1 (5 cells)
      [-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],
      // Row r= 2 (4 cells)
      [-2, 2],[-1, 2],[ 0, 2],[ 1, 2],
      // Row r= 3 (3 cells)
      [-1, 3],[ 0, 3],[ 1, 3],
      // Row r= 4 (staging base, 2 cells)  Start → (0,4)
      [ 0, 4],[ 1, 4],
    ],
  },

  /**
   * Chapter 5 — "Sanctuary Courtyard"
   *
   * 30-cell asymmetric courtyard + garden footprint.
   * Philosophy: a supply courtyard with a walled garden annex.  The map
   * is neither circular nor rectangular — the upper section skews right
   * (supply wing) while the lower section skews left (garden corner).
   * This asymmetry gives two distinct spatial zones within one contiguous
   * terrain field.
   *
   * Layout (portrait, asymmetric skew):
   *
   *   r=-2 (garden alcove, 3)   · · ⬡ ⬡ ⬡      q= 2  3  4
   *   r=-1 (supply upper, 6)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡    q= 0..5  → Start (5,−1)
   *   r= 0 (courtyard, 7)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡   q=-1..5
   *   r= 1 (supply lower, 6)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡    q=-1..4
   *   r= 2 (garden, 5)     ⬡ ⬡ ⬡ ⬡ ⬡ ·        q=-2..-1..0..1..2
   *   r= 3 (corner, 3)      ⬡ ⬡ ⬡ ·            q=-2 -1  0
   *
   * Tile counts: 3+6+7+6+5+3 = 30 ✓
   *
   * Start  (5,−1)   upper-right supply entrance.
   * Gate   (−2, 3)  lower-left garden corner — concealed sanctuary gate.
   *                 BFS distance from start: 7 hops.
   *
   * Visual era (Chs 4–6): simulation facilities intensify.
   */
  5: {
    start: '5,-1',
    gate:  '-2,3',
    tiles: [
      // Row r=-2 (garden alcove, 3 cells)
      [ 2,-2],[ 3,-2],[ 4,-2],
      // Row r=-1 (supply upper, 6 cells)  Start → (5,−1)
      [ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],
      // Row r= 0 (main courtyard, 7 cells — widest)
      [-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],
      // Row r= 1 (lower supply, 6 cells)
      [-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],
      // Row r= 2 (garden, 5 cells)
      [-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],
      // Row r= 3 (garden corner, 3 cells)  Gate → (−2,3)
      [-2, 3],[-1, 3],[ 0, 3],
    ],
  },

  /**
   * Chapter 6 — "Outer Ward Transition"
   *
   * First 35-cell chapter.  Larger irregular footprint.
   * Philosophy: the player is stepping beyond the organised university core
   * into a less controlled clinical environment.  The upper section is
   * compact and ordered; the lower section opens into a wider, asymmetric
   * zone — a structural metaphor for leaving the supervised training ward.
   *
   * Layout (portrait, irregular):
   *
   *   r=-3 (3)          · ⬡ ⬡ ⬡ ·        q= 0  1  2
   *   r=-2 (4)          ⬡ ⬡ ⬡ ⬡ ·        q= 0  1  2  3
   *   r=-1 (5)         ⬡ ⬡ ⬡ ⬡ ⬡ ·      q=-1  0  1  2  3
   *   r= 0 (6, hub)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ →G   q=-1  0  1  2  3  4
   *   r= 1 (6)        ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q=-2 -1  0  1  2  3
   *   r= 2 (5)        ⬡ ⬡ ⬡ ⬡ ⬡ ·        q=-2 -1  0  1  2
   *   r= 3 (4)        ⬡ ⬡ ⬡ ⬡ ·           q=-2 -1  0  1
   *   r= 4 (2)        ⬡ ⬡ · ·              q=-2 -1  ← Start (−2,4)
   *
   * Tile counts: 3+4+5+6+6+5+4+2 = 35 ✓
   *
   * Start  (−2, 4)  lower-left tail — entering from the outer corridor.
   * Gate   ( 4, 0)  east terminus of the central hub row.
   *                 BFS distance from start: 6 hops.
   *
   * Visual era (Chs 4–6): simulation facilities intensify.
   */
  6: {
    start: '-2,4',
    gate:  '4,0',
    tiles: [
      // Row r=-3 (top, 3 cells)
      [ 0,-3],[ 1,-3],[ 2,-3],
      // Row r=-2 (4 cells)
      [ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],
      // Row r=-1 (5 cells)
      [-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],
      // Row r= 0 (hub, 6 cells)  Gate → (4,0)
      [-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],
      // Row r= 1 (6 cells)
      [-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],
      // Row r= 2 (5 cells)
      [-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],
      // Row r= 3 (4 cells)
      [-2, 3],[-1, 3],[ 0, 3],[ 1, 3],
      // Row r= 4 (tail, 2 cells)  Start → (−2,4)
      [-2, 4],[-1, 4],
    ],
  },

  /**
   * Chapter 7 — "Outbreak Ward"
   *
   * 35-cell dense irregular clinical zone with isolation extremities.
   * Philosophy: a fever-season ward that has grown under outbreak pressure.
   * The main body is a dense 6-row mass; isolated cells extend north
   * (quarantine bay r=−4) and south (containment tail r=4) — two "alcove"
   * dead-ends that evoke sealed isolation rooms.
   *
   * Layout (portrait, with isolation extremities):
   *
   *   r=-4 (quarantine tip, 1)        · ⬡ ·         q= 1
   *   r=-3 (isolation bay, 3)        ⬡ ⬡ ⬡          q= 0  1  2
   *   r=-2 (4)                      ⬡ ⬡ ⬡ ⬡         q= 0  1  2  3
   *   r=-1 (6, widest upper)        ⬡ ⬡ ⬡ ⬡ ⬡ ⬡    q=-1  0  1  2  3  4
   *   r= 0 (6)                     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡    q=-1  0  1  2  3  4
   *   r= 1 (6)                    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-2 -1  0  1  2  3
   *   r= 2 (5)                    ⬡ ⬡ ⬡ ⬡ ⬡        q=-2 -1  0  1  2
   *   r= 3 (containment, 3)       ⬡ ⬡ ⬡ ·           q=-2 -1  0
   *   r= 4 (containment tip, 1)   ⬡ · · ·            q=-2
   *
   * Tile counts: 1+3+4+6+6+6+5+3+1 = 35 ✓
   *
   * Start  (−2, 3)   lower containment wing, 4 neighbours (open zone).
   * Gate   ( 1,−3)   northern isolation bay — must traverse the full ward.
   *                  BFS distance from start: 6 hops.
   *
   * Visual era (Chs 7–9): simulations feel increasingly real and uncontrolled.
   * Isolation wards, outbreak environments, darker spaces.
   */
  7: {
    start: '-2,3',
    gate:  '1,-3',
    tiles: [
      // Row r=-4 (quarantine tip, 1 cell)
      [ 1,-4],
      // Row r=-3 (isolation bay, 3 cells)  Gate → (1,−3)
      [ 0,-3],[ 1,-3],[ 2,-3],
      // Row r=-2 (4 cells)
      [ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],
      // Row r=-1 (6 cells)
      [-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],
      // Row r= 0 (6 cells)
      [-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],
      // Row r= 1 (6 cells)
      [-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],
      // Row r= 2 (5 cells)
      [-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],
      // Row r= 3 (containment zone, 3 cells)  Start → (−2,3)
      [-2, 3],[-1, 3],[ 0, 3],
      // Row r= 4 (containment tip, 1 cell)
      [-2, 4],
    ],
  },

  /**
   * Chapter 8 — "Broken Handoff Floor"
   *
   * 35-cell multi-wing rectangular layout with a structural break.
   * Philosophy: a shift-handoff floor where two ward wings connect through
   * a narrow central junction.  The upper wing (r=−3 → r=0, all q ≥ 0)
   * and the lower wing (r=1 → r=4, all q ≤ 2) are offset — the "broken"
   * handoff is the diagonal seam between them.  Intersections and
   * corridors dominate the inner tiles.
   *
   * Upper wing (5 rows, right-biased):
   *   r=-3: q=0..3   r=-2: q=0..4   r=-1: q=0..4   r=0: q=0..4
   * Lower wing (4 rows, left-biased):
   *   r=1: q=−2..2   r=2: q=−3..1   r=3: q=−3..0   r=4: q=−3..−2
   *
   * Tile counts: 4+5+5+5+5+5+4+2 = 35 ✓
   *
   * Start  (4,−2)   top-right of the upper wing — entering the day shift.
   * Gate   (−3, 4)  bottom-left corner of the lower wing.
   *                 BFS distance from start: 7 hops.
   *
   * Visual era (Chs 7–9): simulations feel increasingly real and uncontrolled.
   */
  8: {
    start: '4,-2',
    gate:  '-3,4',
    tiles: [
      // Row r=-3 (upper wing top, 4 cells)
      [ 0,-3],[ 1,-3],[ 2,-3],[ 3,-3],
      // Row r=-2 (5 cells)  Start → (4,−2)
      [ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],
      // Row r=-1 (5 cells)
      [ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],
      // Row r= 0 (junction row, 5 cells)
      [ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],
      // Row r= 1 (handoff seam, 5 cells — left shift begins)
      [-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],
      // Row r= 2 (5 cells)
      [-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],
      // Row r= 3 (lower wing, 4 cells)
      [-3, 3],[-2, 3],[-1, 3],[ 0, 3],
      // Row r= 4 (lower wing tail, 2 cells)  Gate → (−3,4)
      [-3, 4],[-2, 4],
    ],
  },

  /**
   * Chapter 9 — "Weight of Judgment"
   *
   * 35-cell asymmetric irregular map.
   * Philosophy: a simulation environment where the spatial logic begins to
   * break down — familiar ward geometry twisted into an unpredictable
   * diagonal.  The upper-right section (q > 0) and the lower-left section
   * (q < 0) are BOTH occupied but pulled in opposite diagonal directions,
   * making the map feel off-balance and harder to read at a glance.
   *
   * Layout (diagonal skew, upper-right to lower-left):
   *
   *   r=-3 (3, top-right)       · · ⬡ ⬡ ⬡    q= 2  3  4
   *   r=-2 (5)              ⬡ ⬡ ⬡ ⬡ ⬡        q= 0  1  2  3  4  ← Start
   *   r=-1 (6)             ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q=-1  0  1  2  3  4
   *   r= 0 (6)            ⬡ ⬡ ⬡ ⬡ ⬡ ⬡        q=-2 -1  0  1  2  3
   *   r= 1 (6)           ⬡ ⬡ ⬡ ⬡ ⬡ ⬡          q=-3 -2 -1  0  1  2
   *   r= 2 (5)          ⬡ ⬡ ⬡ ⬡ ⬡              q=-3 -2 -1  0  1
   *   r= 3 (4, lower-left) ⬡ ⬡ ⬡ ⬡             q=-4 -3 -2 -1  ← Gate
   *
   * Tile counts: 3+5+6+6+6+5+4 = 35 ✓
   *
   * Start  ( 4,−2)   upper-right edge — a controlled entry point.
   * Gate   (−4, 3)   lower-left corner — the judgment seat.
   *                  BFS distance from start: 8 hops.
   *
   * Visual era (Chs 7–9): simulations feel increasingly real and uncontrolled.
   */
  9: {
    start: '4,-2',
    gate:  '-4,3',
    tiles: [
      // Row r=-3 (upper-right, 3 cells)
      [ 2,-3],[ 3,-3],[ 4,-3],
      // Row r=-2 (5 cells)  Start → (4,−2)
      [ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],
      // Row r=-1 (6 cells)
      [-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],
      // Row r= 0 (6 cells)
      [-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],
      // Row r= 1 (6 cells)
      [-3, 1],[-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],
      // Row r= 2 (5 cells)
      [-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],
      // Row r= 3 (lower-left, 4 cells)  Gate → (−4,3)
      [-4, 3],[-3, 3],[-2, 3],[-1, 3],
    ],
  },

  /**
   * Chapter 10 — "First Oath Capstone"
   *
   * 35-cell grand arena — University Era culmination.
   * Philosophy: a prestigious examination arena that blends academy grandeur
   * with clinical pressure.  The widest row (r=0, 7 cells) is the grand
   * hall floor; a north gallery (r=−3, 2 cells) frames the ceremonial gate;
   * a south gallery (r=4, 2 cells) mirrors it.  The arena is broader and
   * more symmetric than any earlier map, intentionally evoking ceremony.
   *
   * Layout (portrait with gallery wings):
   *
   *   r=-3 (north gallery, 2)    · ⬡ ⬡ · ·        q= 1  2  ← Gate
   *   r=-2 (4)                  ⬡ ⬡ ⬡ ⬡ ·         q= 0  1  2  3
   *   r=-1 (5)                 ⬡ ⬡ ⬡ ⬡ ⬡ ·       q=-1  0  1  2  3
   *   r= 0 (grand hall, 7)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q=-2 -1  0  1  2  3  4
   *   r= 1 (6)               ⬡ ⬡ ⬡ ⬡ ⬡ ⬡          q=-2 -1  0  1  2  3
   *   r= 2 (5)                ⬡ ⬡ ⬡ ⬡ ⬡             q=-1  0  1  2  3
   *   r= 3 (4)                 ⬡ ⬡ ⬡ ⬡               q= 0  1  2  3
   *   r= 4 (south gallery, 2)   · ⬡ ⬡ ·               q= 1  2  ← Start
   *
   * Tile counts: 2+4+5+7+6+5+4+2 = 35 ✓
   *
   * Start  (2, 4)   south gallery — entering the ceremony from the rear.
   * Gate   (1,−3)   north gallery — the First Oath archway.
   *                 BFS distance from start: 8 hops.
   *
   * Visual era (Ch 10): prestigious capstone — academy grandeur meets
   * serious clinical pressure.  A blend of Chs 1–3 order and Chs 7–9 weight.
   */
  10: {
    start: '2,4',
    gate:  '1,-3',
    tiles: [
      // Row r=-3 (north gallery, 2 cells)  Gate → (1,−3)
      [ 1,-3],[ 2,-3],
      // Row r=-2 (4 cells)
      [ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],
      // Row r=-1 (5 cells)
      [-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],
      // Row r= 0 (grand hall, 7 cells — widest)
      [-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],
      // Row r= 1 (6 cells)
      [-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],
      // Row r= 2 (5 cells)
      [-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],
      // Row r= 3 (4 cells)
      [ 0, 3],[ 1, 3],[ 2, 3],[ 3, 3],
      // Row r= 4 (south gallery, 2 cells)  Start → (2,4)
      [ 1, 4],[ 2, 4],
    ],
  },
};

// ── Deterministic fallback seed for unauth'd chapters ────────────────────────

function templateSeedFor(chapter: number): string {
  return `clinica-authored-ch${chapter}`;
}

// ── Axial hex helpers ─────────────────────────────────────────────────────────

function axialKey(q: number, r: number): string { return `${q},${r}`; }

const AXIAL_DIRS: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1],
];

function buildAdjacency(tileSet: Set<string>): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const k of tileSet) {
    const comma = k.indexOf(',');
    const q = Number(k.slice(0, comma));
    const r = Number(k.slice(comma + 1));
    adj.set(k, AXIAL_DIRS.map(([dq, dr]) => axialKey(q + dq, r + dr)).filter(nk => tileSet.has(nk)));
  }
  return adj;
}

// ── Tag computation from graph structure ──────────────────────────────────────

function computeTags(
  key:       string,
  neighbors: string[],
  tileSet:   Set<string>,
  centroidQ: number,
  centroidR: number,
): ChapterTileTag[] {
  const comma = key.indexOf(',');
  const q = Number(key.slice(0, comma));
  const r = Number(key.slice(comma + 1));

  const tags: ChapterTileTag[] = [];
  const n = neighbors.length;

  // Structural tags.
  if (n === 1) tags.push('alcove');
  if (n >= 4)  tags.push('intersection');

  // Edge: at least one of the six neighbor positions is absent from the map.
  const hexNeighborCount = AXIAL_DIRS.filter(([dq, dr]) => tileSet.has(axialKey(q + dq, r + dr))).length;
  if (hexNeighborCount < 6) tags.push('edge');

  // Central: within 1.5 units of the geometric centroid (in axial distance).
  const dq = Math.abs(q - centroidQ);
  const dr = Math.abs(r - centroidR);
  if (dq <= 1.5 && dr <= 1.5) tags.push('central');

  // Placement preference hints.
  if (n === 1) tags.push('treasurePreferred', 'merchantPreferred'); // alcoves suit quiet events
  if (n >= 4)  tags.push('bossPreferred');                          // hubs suit boss encounters
  if (n <= 2 && hexNeighborCount < 6) tags.push('quiet');

  return tags;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateTemplate(
  chapter:     number,
  tiles:       ChapterMapTemplateTile[],
  startTileId: string,
  gateTileId:  string,
): void {
  const expectedCount = getChapterTerrainCellCount(chapter);

  // 1. Tile count.
  if (tiles.length !== expectedCount) {
    throw new Error(
      `chapterMapTemplates ch${chapter}: expected ${expectedCount} tiles, got ${tiles.length}`,
    );
  }

  // 2. Unique ids.
  const idSet = new Set(tiles.map(t => t.id));
  if (idSet.size !== tiles.length) {
    throw new Error(`chapterMapTemplates ch${chapter}: duplicate tile ids`);
  }

  // 3. Unique coordinates.
  const coordSet = new Set(tiles.map(t => axialKey(t.q, t.r)));
  if (coordSet.size !== tiles.length) {
    throw new Error(`chapterMapTemplates ch${chapter}: duplicate tile coordinates`);
  }

  // 4. Exactly one start, exactly one gate.
  const starts = tiles.filter(t => t.role === 'start');
  const gates  = tiles.filter(t => t.role === 'gate');
  if (starts.length !== 1) throw new Error(`chapterMapTemplates ch${chapter}: expected 1 start tile, got ${starts.length}`);
  if (gates.length  !== 1) throw new Error(`chapterMapTemplates ch${chapter}: expected 1 gate tile, got ${gates.length}`);

  // 5. startTileId / gateTileId reference existing tiles.
  if (!idSet.has(startTileId)) throw new Error(`chapterMapTemplates ch${chapter}: startTileId '${startTileId}' not found`);
  if (!idSet.has(gateTileId))  throw new Error(`chapterMapTemplates ch${chapter}: gateTileId '${gateTileId}' not found`);
  if (starts[0].id !== startTileId) throw new Error(`chapterMapTemplates ch${chapter}: startTileId mismatch`);
  if (gates[0].id  !== gateTileId)  throw new Error(`chapterMapTemplates ch${chapter}: gateTileId mismatch`);

  // 6. Every tile touches at least one other tile, and all form one connected component.
  const adjacency     = buildAdjacency(coordSet);
  const graphDistances = bfsDistances(adjacency, startTileId);

  for (const [k, neighbors] of adjacency) {
    if (neighbors.length === 0) {
      throw new Error(`chapterMapTemplates ch${chapter}: tile '${k}' has no neighbors (orphan)`);
    }
  }

  if (graphDistances.size !== tiles.length) {
    throw new Error(`chapterMapTemplates ch${chapter}: map is not a single connected footprint`);
  }

  // 7. Gate is reachable from start.
  if (!graphDistances.has(gateTileId)) {
    throw new Error(`chapterMapTemplates ch${chapter}: gate '${gateTileId}' unreachable from start '${startTileId}'`);
  }
}

// ── Build ChapterMapTemplate from authored raw data ───────────────────────────

function buildFromAuthoredData(chapter: number, data: AuthoredRawMap): ChapterMapTemplate {
  const rawPairs = data.tiles;
  const tileSet  = new Set(rawPairs.map(([q, r]) => axialKey(q, r)));

  // Compute centroid for tag calculation.
  const sumQ = rawPairs.reduce((s, [q]) => s + q, 0) / rawPairs.length;
  const sumR = rawPairs.reduce((s, [, r]) => s + r, 0) / rawPairs.length;

  const adjacency = buildAdjacency(tileSet);

  const tiles: ChapterMapTemplateTile[] = rawPairs.map(([q, r]) => {
    const id        = axialKey(q, r);
    const role: ChapterTileRole =
      id === data.start ? 'start' :
      id === data.gate  ? 'gate'  : 'normal';
    const neighbors = adjacency.get(id) ?? [];
    const tags      = computeTags(id, neighbors, tileSet, sumQ, sumR);
    return { id, q, r, role, tags };
  });

  const template: ChapterMapTemplate = {
    chapterId:   String(chapter),
    shape:       'irregular',
    tiles,
    startTileId: data.start,
    gateTileId:  data.gate,
    environmentId: environmentIdFor(chapter),
  };

  validateTemplate(chapter, tiles, data.start, data.gate);
  return template;
}

// ── Build ChapterMapTemplate from procedural generator (fallback) ─────────────

function buildFromProcedural(chapter: number): ChapterMapTemplate {
  const topology = generateHexTopology({ chapter, seed: templateSeedFor(chapter) });
  const tileSet  = new Set(topology.tiles.map(t => axialKey(t.q, t.r)));

  const sumQ = topology.tiles.reduce((s, t) => s + t.q, 0) / topology.tiles.length;
  const sumR = topology.tiles.reduce((s, t) => s + t.r, 0) / topology.tiles.length;

  const adjacency = buildAdjacency(tileSet);

  const tiles: ChapterMapTemplateTile[] = topology.tiles.map(coord => {
    const id   = axialKey(coord.q, coord.r);
    const role: ChapterTileRole =
      id === topology.startTileId  ? 'start' :
      id === topology.gateAnchorId ? 'gate'  : 'normal';
    const neighbors = adjacency.get(id) ?? [];
    const tags      = computeTags(id, neighbors, tileSet, sumQ, sumR);
    return { id, q: coord.q, r: coord.r, role, tags };
  });

  const template: ChapterMapTemplate = {
    chapterId:   String(chapter),
    shape:       'irregular',
    tiles,
    startTileId: topology.startTileId,
    gateTileId:  topology.gateAnchorId,
    environmentId: environmentIdFor(chapter),
  };

  validateTemplate(chapter, tiles, topology.startTileId, topology.gateAnchorId);
  return template;
}

// ── Internal HexTopology builder (used by run lifecycle / createRun) ──────────

function buildHexTopologyFromTemplate(
  chapter:  number,
  template: ChapterMapTemplate,
): HexTopology {
  const coords: AxialCoord[] = template.tiles.map(t => ({ q: t.q, r: t.r }));
  const tileSet = new Set(template.tiles.map(t => t.id));
  const adjacency = buildAdjacency(tileSet);
  const graphDistances = bfsDistances(adjacency, template.startTileId);
  return {
    chapter,
    seed:           `authored-ch${chapter}`,
    tiles:          coords,
    startTileId:    template.startTileId,
    gateAnchorId:   template.gateTileId,
    graphDistances,
  };
}

// ── Caches ────────────────────────────────────────────────────────────────────

const templateCache  = new Map<number, ChapterMapTemplate>();
const topologyCache  = new Map<number, HexTopology>();

function masterTemplate(chapter: number): ChapterMapTemplate {
  const cached = templateCache.get(chapter);
  if (cached) return cached;

  const authored = AUTHORED_CHAPTER_MAPS[chapter];
  const template = authored
    ? buildFromAuthoredData(chapter, authored)
    : buildFromProcedural(chapter);

  templateCache.set(chapter, template);
  return template;
}

// ── Production-authored chapter gate ─────────────────────────────────────────

/**
 * Chapters whose authored geometry has been deployed to production.
 *
 * MIGRATION GATE — add a chapter here only after its template has been:
 *   1. designed and reviewed (tile coordinates, start, gate)
 *   2. snapshot-tested
 *   3. accepted for production use
 *
 * Chapters NOT in this set fall back to the procedural topology generator
 * (generateHexTopology with the per-run seed) so their geometry still varies
 * between attempts while they await authoring.
 *
 * ⚠ Do NOT add a chapter number here until its AUTHORED_CHAPTER_MAPS entry
 *   has been reviewed and locked — adding it prematurely fixes all existing
 *   in-progress runs for that chapter to the authored geometry.
 */
const PRODUCTION_AUTHORED_CHAPTERS = new Set<number>([
  // Push 4: all Book I chapters authored, validated, and locked.
  // ⚠ Never remove a chapter from this set once players have runs on it.
  1,  // "Atrium Approach"       — Ch 1, 30 cells, circular courtyard
  2,  // "Teaching Ward"         — Ch 2, 30 cells, rounded-square
  3,  // "Procedure Hall"        — Ch 3, 30 cells, wide horizontal oval
  4,  // "Emergency Simulation"  — Ch 4, 30 cells, vertical diamond / radial hub
  5,  // "Sanctuary Courtyard"   — Ch 5, 30 cells, asymmetric courtyard + garden
  6,  // "Outer Ward Transition" — Ch 6, 35 cells, irregular transition
  7,  // "Outbreak Ward"         — Ch 7, 35 cells, dense + isolation extremities
  8,  // "Broken Handoff Floor"  — Ch 8, 35 cells, multi-wing offset rectangle
  9,  // "Weight of Judgment"    — Ch 9, 35 cells, asymmetric diagonal skew
  10, // "First Oath Capstone"   — Ch10, 35 cells, grand ceremonial arena
]);

/**
 * Returns true when a chapter's geometry should come from the fixed authored
 * template rather than the procedural topology generator.
 *
 * Use this at every run-creation entry point to route geometry selection.
 * When false, callers must continue using generateHexTopology({ chapter, seed })
 * with the per-run seed so encounter variation is preserved.
 */
export function isAuthoredChapter(chapter: number): boolean {
  return PRODUCTION_AUTHORED_CHAPTERS.has(chapter);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return the fixed authored ChapterMapTemplate for a chapter.
 *
 * Validated on first access; returns the same (immutable) master object on
 * every subsequent call.  Do NOT mutate the returned value.
 *
 * The run seed is NOT an input — geometry is fixed per chapter.
 */
export function getChapterMapTemplate(chapter: number): ChapterMapTemplate {
  return masterTemplate(chapter);
}

/**
 * Return a HexTopology for the chapter's fixed authored geometry.
 *
 * Used internally by journeyRunLifecycle and createRun so they do not need
 * to depend on ChapterMapTemplate directly.  Returns a defensive copy so
 * callers can mutate it freely without poisoning the cache.
 *
 * The procedural topology generator remains available as a fallback for
 * unauth'd chapters (11+) via buildFromProcedural.
 */
export function getChapterHexTopology(chapter: number): HexTopology {
  const cached = topologyCache.get(chapter);
  if (cached) {
    // Return defensive copy.
    return {
      chapter:        cached.chapter,
      seed:           cached.seed,
      tiles:          cached.tiles.map(t => ({ q: t.q, r: t.r })),
      startTileId:    cached.startTileId,
      gateAnchorId:   cached.gateAnchorId,
      graphDistances: new Map(cached.graphDistances),
    };
  }

  const topology = buildHexTopologyFromTemplate(chapter, masterTemplate(chapter));
  topologyCache.set(chapter, topology);

  return {
    chapter:        topology.chapter,
    seed:           topology.seed,
    tiles:          topology.tiles.map(t => ({ q: t.q, r: t.r })),
    startTileId:    topology.startTileId,
    gateAnchorId:   topology.gateAnchorId,
    graphDistances: new Map(topology.graphDistances),
  };
}
