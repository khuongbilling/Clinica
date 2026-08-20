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
import { getChapterHexLayout }                from './chapterHexLayout';
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

/**
 * Chapter 1 is rendered through the modern fixed-layout pipeline. This adapter
 * keeps the older JourneyRun topology API on that same canonical coordinate
 * set, rather than maintaining a second hand-authored campus footprint.
 */
function getChapterOneCampusRawMap(): AuthoredRawMap {
  const layout = getChapterHexLayout(1);
  return {
    start: `${layout.startCell.q},${layout.startCell.r}`,
    gate:  `${layout.gateCell.q},${layout.gateCell.r}`,
    tiles: layout.cells.map(cell => [cell.q, cell.r] as const),
  };
}

const AUTHORED_CHAPTER_MAPS: Readonly<Record<number, AuthoredRawMap>> = {
  /**
   * Chapter 1 — "Atrium Approach"
   *
   * 60-cell large circular atrium — radius-4 hexagon minus one corner.
   * All (q,r) where max(|q|,|r|,|q+r|) ≤ 4, with corner (4,0) removed.
   *
   * Layout (r=−4 → r=4):
   *
   *   r=-4 (5)   · · ⬡ ⬡ ⬡ ⬡ ⬡           q= 0  1  2  3  4
   *   r=-3 (6)   · ⬡ ⬡ ⬡ ⬡ ⬡ ⬡          q=-1  0  1  2  3  4
   *   r=-2 (7)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ·         q=-2 -1  0  1  2  3  4
   *   r=-1 (8) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡          q=-3 -2 -1  0  1  2  3  4
   *   r= 0 (8) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡  [−]    q=-4 -3 -2 -1  0  1  2  3  (corner 4,0 dropped)
   *   r= 1 (8) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡          q=-4 -3 -2 -1  0  1  2  3
   *   r= 2 (7)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡            q=-4 -3 -2 -1  0  1  2
   *   r= 3 (6)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡             q=-4 -3 -2 -1  0  1  ← Start (0,3)
   *   r= 4 (5)    ⬡ ⬡ ⬡ ⬡ ⬡              q=-4 -3 -2 -1  0
   *
   * Tile counts: 5+6+7+8+8+8+7+6+5 = 60 ✓
   *
   * Start  ( 0, 3)  lower-centre of the atrium floor. 6 neighbours.
   * Gate   ( 0,−4)  top-centre cap — ceremonial entrance arch.
   *                 BFS distance from start: 7 hops.
   *
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  1: {
    start: '0,3',
    gate:  '0,-4',
    tiles: [
      // Row r=-4 (top cap, 5 cells)  Gate → (0,−4)
      [ 0,-4],[ 1,-4],[ 2,-4],[ 3,-4],[ 4,-4],
      // Row r=-3 (6 cells)
      [-1,-3],[ 0,-3],[ 1,-3],[ 2,-3],[ 3,-3],[ 4,-3],
      // Row r=-2 (7 cells)
      [-2,-2],[-1,-2],[ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],
      // Row r=-1 (8 cells)
      [-3,-1],[-2,-1],[-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],
      // Row r= 0 (8 cells — corner (4,0) removed)
      [-4, 0],[-3, 0],[-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],
      // Row r= 1 (8 cells)
      [-4, 1],[-3, 1],[-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],
      // Row r= 2 (7 cells)
      [-4, 2],[-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],
      // Row r= 3 (6 cells)  Start → (0,3)
      [-4, 3],[-3, 3],[-2, 3],[-1, 3],[ 0, 3],[ 1, 3],
      // Row r= 4 (bottom cap, 5 cells)
      [-4, 4],[-3, 4],[-2, 4],[-1, 4],[ 0, 4],
    ],
  },

  /**
   * Chapter 2 — "Teaching Ward"
   *
   * 60-cell wide rounded-rectangle clinical floor.
   * Philosophy: expanded multi-bay teaching ward — broader corridors and
   * more bed bays than the introductory atrium.
   *
   * Layout (r=−4 → r=4):
   *
   *   r=-4 (4)   · ⬡ ⬡ ⬡ ⬡ ·        q= 0  1  2  3
   *   r=-3 (7)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q=-1  0  1  2  3  4  5
   *   r=-2 (8) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-1  0  1  2  3  4  5  6
   *   r=-1 (8) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-1  0  1  2  3  4  5  6
   *   r= 0 (8) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-1  0  1  2  3  4  5  6
   *   r= 1 (8) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-1  0  1  2  3  4  5  6
   *   r= 2 (7)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q= 0  1  2  3  4  5  6
   *   r= 3 (6)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡         q= 1  2  3  4  5  6
   *   r= 4 (4)    ⬡ ⬡ ⬡ ⬡             q= 2  3  4  5  ← Start (3,4)
   *
   * Tile counts: 4+7+8+8+8+8+7+6+4 = 60 ✓
   *
   * Start  (3, 4)  lower entry bay — 3 immediate exit directions.
   * Gate   (2,−4)  top-left secured ward door.
   *                BFS distance from start: 9 hops.
   *
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  2: {
    start: '3,4',
    gate:  '2,-4',
    tiles: [
      // Row r=-4 (top strip, 4 cells)  Gate → (2,−4)
      [ 0,-4],[ 1,-4],[ 2,-4],[ 3,-4],
      // Row r=-3 (7 cells)
      [-1,-3],[ 0,-3],[ 1,-3],[ 2,-3],[ 3,-3],[ 4,-3],[ 5,-3],
      // Row r=-2 (8 cells)
      [-1,-2],[ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],[ 5,-2],[ 6,-2],
      // Row r=-1 (8 cells)
      [-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],
      // Row r= 0 (8 cells)
      [-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],[ 6, 0],
      // Row r= 1 (8 cells)
      [-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],[ 6, 1],
      // Row r= 2 (7 cells)
      [ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],[ 5, 2],[ 6, 2],
      // Row r= 3 (6 cells)
      [ 1, 3],[ 2, 3],[ 3, 3],[ 4, 3],[ 5, 3],[ 6, 3],
      // Row r= 4 (entry bay, 4 cells)  Start → (3,4)
      [ 2, 4],[ 3, 4],[ 4, 4],[ 5, 4],
    ],
  },

  /**
   * Chapter 3 — "Procedure Hall"
   *
   * 60-cell wide horizontal corridor.
   * Philosophy: expanded lateral training hall — a long skills lab spanning
   * five main rows plus a southern workbench alcove.
   *
   * Layout (r=−2 → r=3):
   *
   *   r=-2 (10)   · ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ·    q= 1..10  Gate (2,−2)
   *   r=-1 (12)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q= 0..11
   *   r= 0 (12)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q= 0..11
   *   r= 1 (12)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q= 0..11  Start (11,1)
   *   r= 2 (10)   · ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ·    q= 1..10
   *   r= 3 (4)     · · ⬡ ⬡ ⬡ ⬡ · · · ·          q= 2..5
   *
   * Tile counts: 10+12+12+12+10+4 = 60 ✓
   *
   * Start  (11, 1)  far-right of the main corridor.
   * Gate   ( 2,−2)  upper-left procedure bay.
   *                 BFS distance from start: 12 hops — full hall traversal.
   *
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  3: {
    start: '11,1',
    gate:  '2,-2',
    tiles: [
      // Row r=-2 (upper hall, 10 cells)  Gate → (2,−2)
      [ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],[ 5,-2],[ 6,-2],[ 7,-2],[ 8,-2],[ 9,-2],[10,-2],
      // Row r=-1 (12 cells)
      [ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],[ 7,-1],[ 8,-1],[ 9,-1],[10,-1],[11,-1],
      // Row r= 0 (12 cells)
      [ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],[ 6, 0],[ 7, 0],[ 8, 0],[ 9, 0],[10, 0],[11, 0],
      // Row r= 1 (main corridor, 12 cells)  Start → (11,1)
      [ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],[ 6, 1],[ 7, 1],[ 8, 1],[ 9, 1],[10, 1],[11, 1],
      // Row r= 2 (lower hall, 10 cells)
      [ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],[ 5, 2],[ 6, 2],[ 7, 2],[ 8, 2],[ 9, 2],[10, 2],
      // Row r= 3 (workbench alcove, 4 cells)
      [ 2, 3],[ 3, 3],[ 4, 3],[ 5, 3],
    ],
  },

  /**
   * Chapter 4 — "Emergency Simulation"
   *
   * 60-cell tall vertical diamond / radial hub.
   * Philosophy: an expanded emergency simulation centre — the triage hub
   * (r=0, 8 cells) now radiates into a deep northern bay and a long
   * southern staging corridor.
   *
   * Layout (r=−5 → r=6):
   *
   *   r=-5 (2)       · ⬡ ⬡ ·                   q= 0  1
   *   r=-4 (4)      ⬡ ⬡ ⬡ ⬡                   q=-1  0  1  2
   *   r=-3 (6)     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡               q=-2 -1  0  1  2  3
   *   r=-2 (6)     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡               q=-2 -1  0  1  2  3
   *   r=-1 (7)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡             q=-3 -2 -1  0  1  2  3
   *   r= 0 (8)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ →Gate    q=-3 -2 -1  0  1  2  3  4
   *   r= 1 (7)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡             q=-3 -2 -1  0  1  2  3
   *   r= 2 (6)     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡               q=-3 -2 -1  0  1  2
   *   r= 3 (6)     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡               q=-2 -1  0  1  2  3
   *   r= 4 (4)      ⬡ ⬡ ⬡ ⬡                   q=-1  0  1  2
   *   r= 5 (2)       ⬡ ⬡                        q= 0  1
   *   r= 6 (2)       ⬡ ⬡  ← Start (0,6)        q= 0  1
   *
   * Tile counts: 2+4+6+6+7+8+7+6+6+4+2+2 = 60 ✓
   *
   * Start  (0, 6)  southern staging base.
   * Gate   (4, 0)  east terminus of the central triage hub.
   *                BFS distance from start: 6 hops.
   *
   * Visual era (Chs 4–6): simulation facilities intensify.
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  4: {
    start: '0,6',
    gate:  '4,0',
    tiles: [
      // Row r=-5 (top cap, 2 cells)
      [ 0,-5],[ 1,-5],
      // Row r=-4 (4 cells)
      [-1,-4],[ 0,-4],[ 1,-4],[ 2,-4],
      // Row r=-3 (6 cells)
      [-2,-3],[-1,-3],[ 0,-3],[ 1,-3],[ 2,-3],[ 3,-3],
      // Row r=-2 (6 cells)
      [-2,-2],[-1,-2],[ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],
      // Row r=-1 (7 cells)
      [-3,-1],[-2,-1],[-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],
      // Row r= 0 (triage hub, 8 cells)  Gate → (4,0)
      [-3, 0],[-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],
      // Row r= 1 (7 cells)
      [-3, 1],[-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],
      // Row r= 2 (6 cells)
      [-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],
      // Row r= 3 (6 cells)
      [-2, 3],[-1, 3],[ 0, 3],[ 1, 3],[ 2, 3],[ 3, 3],
      // Row r= 4 (4 cells)
      [-1, 4],[ 0, 4],[ 1, 4],[ 2, 4],
      // Row r= 5 (2 cells)
      [ 0, 5],[ 1, 5],
      // Row r= 6 (staging base, 2 cells)  Start → (0,6)
      [ 0, 6],[ 1, 6],
    ],
  },

  /**
   * Chapter 5 — "Sanctuary Courtyard"
   *
   * 60-cell asymmetric courtyard + extended garden footprint.
   * Philosophy: the supply wing now spans a wider diagonal sweep — the
   * upper section skews right and the lower section skews left further,
   * creating two distinct spatial zones in a larger contiguous field.
   *
   * Layout (r=−3 → r=4):
   *
   *   r=-3 (5)          · · ⬡ ⬡ ⬡ ⬡ ⬡ ·      q= 2..6   → Start (6,−1 is in r=-1)
   *   r=-2 (7)         · ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q= 1..7
   *   r=-1 (9)        ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡    q= 0..8  → Start (6,−1)
   *   r= 0 (10)      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡  q=-1..8
   *   r= 1 (9)       ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-2..6
   *   r= 2 (9)      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q=-3..5
   *   r= 3 (7)     ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ·           q=-4..2
   *   r= 4 (4)    ⬡ ⬡ ⬡ ⬡ ·                    q=-4..-1  Gate (−4,4)
   *
   * Tile counts: 5+7+9+10+9+9+7+4 = 60 ✓
   *
   * Start  (6,−1)  upper-right supply entrance.
   * Gate   (−4, 4) lower-left garden corner — concealed sanctuary gate.
   *                BFS distance from start: 10 hops.
   *
   * Visual era (Chs 4–6): simulation facilities intensify.
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  5: {
    start: '6,-1',
    gate:  '-4,4',
    tiles: [
      // Row r=-3 (upper alcove, 5 cells)
      [ 2,-3],[ 3,-3],[ 4,-3],[ 5,-3],[ 6,-3],
      // Row r=-2 (7 cells)
      [ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],[ 5,-2],[ 6,-2],[ 7,-2],
      // Row r=-1 (supply upper, 9 cells)  Start → (6,−1)
      [ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],[ 7,-1],[ 8,-1],
      // Row r= 0 (main courtyard, 10 cells — widest)
      [-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],[ 6, 0],[ 7, 0],[ 8, 0],
      // Row r= 1 (lower supply, 9 cells)
      [-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],[ 6, 1],
      // Row r= 2 (garden, 9 cells)
      [-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],[ 5, 2],
      // Row r= 3 (lower garden, 7 cells)
      [-4, 3],[-3, 3],[-2, 3],[-1, 3],[ 0, 3],[ 1, 3],[ 2, 3],
      // Row r= 4 (garden corner, 4 cells)  Gate → (−4,4)
      [-4, 4],[-3, 4],[-2, 4],[-1, 4],
    ],
  },

  /**
   * Chapter 6 — "Outer Ward Transition"
   *
   * First 70-cell chapter.  Large irregular footprint.
   * Philosophy: the player steps beyond the university core into a wider,
   * less controlled environment.  The upper section is compact; the lower
   * opens into a broad asymmetric zone.
   *
   * Layout (r=−4 → r=4):
   *
   *   r=-4 (4)    · ⬡ ⬡ ⬡ ⬡ ·           q= 0..3   Gate (2,−4)
   *   r=-3 (6)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ·         q=-1..4
   *   r=-2 (8)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡        q=-2..5
   *   r=-1 (9)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-2..6
   *   r= 0 (10) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡  q=-2..7
   *   r= 1 (10) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡  q=-3..6
   *   r= 2 (10) ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡  q=-4..5
   *   r= 3 (8)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ·      q=-4..3
   *   r= 4 (5)  ⬡ ⬡ ⬡ ⬡ ⬡ ·              q=-4..0  ← Start (−4,4)
   *
   * Tile counts: 4+6+8+9+10+10+10+8+5 = 70 ✓
   *
   * Start  (−4, 4)  lower-left tail.
   * Gate   ( 2,−4)  upper-right secured exit.
   *                 BFS distance from start: 8 hops.
   *
   * Visual era (Chs 4–6): simulation facilities intensify.
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  6: {
    start: '-4,4',
    gate:  '2,-4',
    tiles: [
      // Row r=-4 (top, 4 cells)  Gate → (2,−4)
      [ 0,-4],[ 1,-4],[ 2,-4],[ 3,-4],
      // Row r=-3 (6 cells)
      [-1,-3],[ 0,-3],[ 1,-3],[ 2,-3],[ 3,-3],[ 4,-3],
      // Row r=-2 (8 cells)
      [-2,-2],[-1,-2],[ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],[ 5,-2],
      // Row r=-1 (9 cells)
      [-2,-1],[-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],
      // Row r= 0 (10 cells)
      [-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],[ 6, 0],[ 7, 0],
      // Row r= 1 (10 cells)
      [-3, 1],[-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],[ 6, 1],
      // Row r= 2 (10 cells)
      [-4, 2],[-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],[ 5, 2],
      // Row r= 3 (8 cells)
      [-4, 3],[-3, 3],[-2, 3],[-1, 3],[ 0, 3],[ 1, 3],[ 2, 3],[ 3, 3],
      // Row r= 4 (tail, 5 cells)  Start → (−4,4)
      [-4, 4],[-3, 4],[-2, 4],[-1, 4],[ 0, 4],
    ],
  },

  /**
   * Chapter 7 — "Outbreak Ward"
   *
   * 70-cell dense irregular clinical zone with quarantine extremities.
   * Philosophy: a fever-season ward grown under outbreak pressure.
   * A single quarantine cell (r=−6) and a broader containment tail at the
   * south form sealed isolation zones bookending the main ward body.
   *
   * Layout (r=−6 → r=4):
   *
   *   r=-6 (1)              · ⬡ ·                q= 1  (quarantine tip)
   *   r=-5 (3)             ⬡ ⬡ ⬡                q= 0..2  Gate (1,−5)
   *   r=-4 (5)            ⬡ ⬡ ⬡ ⬡ ⬡            q=-1..3
   *   r=-3 (7)           ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡        q=-1..5
   *   r=-2 (8)          ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q=-2..5
   *   r=-1 (9)         ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-2..6
   *   r= 0 (9)        ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q=-3..5
   *   r= 1 (9)       ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q=-3..5
   *   r= 2 (8)       ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡          q=-3..4
   *   r= 3 (7)       ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡             q=-3..3  Start (−3,3)
   *   r= 4 (4)        ⬡ ⬡ ⬡ ⬡ ·                q=-2..1
   *
   * Tile counts: 1+3+5+7+8+9+9+9+8+7+4 = 70 ✓
   *
   * Start  (−3, 3)  lower containment wing.
   * Gate   ( 1,−5)  northern isolation bay.
   *                 BFS distance from start: 8 hops.
   *
   * Visual era (Chs 7–9): increasingly real and uncontrolled simulations.
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  7: {
    start: '-3,3',
    gate:  '1,-5',
    tiles: [
      // Row r=-6 (quarantine tip, 1 cell)
      [ 1,-6],
      // Row r=-5 (isolation bay, 3 cells)  Gate → (1,−5)
      [ 0,-5],[ 1,-5],[ 2,-5],
      // Row r=-4 (5 cells)
      [-1,-4],[ 0,-4],[ 1,-4],[ 2,-4],[ 3,-4],
      // Row r=-3 (7 cells)
      [-1,-3],[ 0,-3],[ 1,-3],[ 2,-3],[ 3,-3],[ 4,-3],[ 5,-3],
      // Row r=-2 (8 cells)
      [-2,-2],[-1,-2],[ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],[ 5,-2],
      // Row r=-1 (9 cells)
      [-2,-1],[-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],
      // Row r= 0 (9 cells)
      [-3, 0],[-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],
      // Row r= 1 (9 cells)
      [-3, 1],[-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],
      // Row r= 2 (8 cells)
      [-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],
      // Row r= 3 (containment zone, 7 cells)  Start → (−3,3)
      [-3, 3],[-2, 3],[-1, 3],[ 0, 3],[ 1, 3],[ 2, 3],[ 3, 3],
      // Row r= 4 (containment tail, 4 cells)
      [-2, 4],[-1, 4],[ 0, 4],[ 1, 4],
    ],
  },

  /**
   * Chapter 8 — "Broken Handoff Floor"
   *
   * 70-cell multi-wing layout with a structural break at r=0/r=1.
   * Philosophy: an expanded shift-handoff floor — the right-biased upper
   * wing (r=−4 → r=0) and the left-biased lower wing (r=1 → r=6) connect
   * through a wide central seam.
   *
   * Upper wing (5 rows, right-biased): 5+6+7+8+7 = 33 cells
   *   r=-4: q=1..5   r=-3: q=0..5   r=-2: q=0..6   r=-1: q=0..7   r=0: q=0..6
   * Lower wing (6 rows, left-biased): 7+8+8+7+6+1 = 37 cells
   *   r=1: q=−3..3   r=2: q=−4..3   r=3: q=−5..2   r=4: q=−5..1   r=5: q=−5..0
   *   r=6: q=−4      (gate stub)
   *
   * Tile counts: 33+37 = 70 ✓
   *
   * Start  (7,−1)  top-right of the upper wing — entering the day shift.
   * Gate   (−4, 6) bottom-left stub of the lower wing.
   *                BFS distance from start: 11 hops.
   *
   * Visual era (Chs 7–9): simulations increasingly real and uncontrolled.
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  8: {
    start: '7,-1',
    gate:  '-4,6',
    tiles: [
      // ── Upper wing ────────────────────────────────────────────────────
      // Row r=-4 (5 cells)
      [ 1,-4],[ 2,-4],[ 3,-4],[ 4,-4],[ 5,-4],
      // Row r=-3 (6 cells)
      [ 0,-3],[ 1,-3],[ 2,-3],[ 3,-3],[ 4,-3],[ 5,-3],
      // Row r=-2 (7 cells)
      [ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],[ 5,-2],[ 6,-2],
      // Row r=-1 (8 cells)  Start → (7,−1)
      [ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],[ 7,-1],
      // Row r= 0 (junction, 7 cells)
      [ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],[ 6, 0],
      // ── Lower wing ────────────────────────────────────────────────────
      // Row r= 1 (handoff seam, 7 cells)
      [-3, 1],[-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],
      // Row r= 2 (8 cells)
      [-4, 2],[-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],
      // Row r= 3 (8 cells)
      [-5, 3],[-4, 3],[-3, 3],[-2, 3],[-1, 3],[ 0, 3],[ 1, 3],[ 2, 3],
      // Row r= 4 (7 cells)
      [-5, 4],[-4, 4],[-3, 4],[-2, 4],[-1, 4],[ 0, 4],[ 1, 4],
      // Row r= 5 (6 cells)
      [-5, 5],[-4, 5],[-3, 5],[-2, 5],[-1, 5],[ 0, 5],
      // Row r= 6 (gate stub, 1 cell)  Gate → (−4,6)
      [-4, 6],
    ],
  },

  /**
   * Chapter 9 — "Weight of Judgment"
   *
   * 70-cell asymmetric diagonal skew — NE to SW.
   * Philosophy: a simulation environment where spatial logic fractures.
   * The map sweeps from the upper-right (q=3..6, r=−4) to the lower-left
   * (q=−6..−5, r=5), making orientation deliberately disorienting.
   *
   * Layout (r=−4 → r=5):
   *
   *   r=-4 (4)                · · · ⬡ ⬡ ⬡ ⬡ ·  q= 3..6  ← Start (6,−4)
   *   r=-3 (5)              · · ⬡ ⬡ ⬡ ⬡ ⬡ ·    q= 2..6
   *   r=-2 (7)           · ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q= 1..7
   *   r=-1 (9)         ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q= 0..8
   *   r= 0 (10)      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q=-1..8
   *   r= 1 (10)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡         q=-3..6
   *   r= 2 (9)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡             q=-4..4
   *   r= 3 (8)   ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡                q=-5..2
   *   r= 4 (6)  ⬡ ⬡ ⬡ ⬡ ⬡ ⬡                      q=-6..-1
   *   r= 5 (2)  ⬡ ⬡                                q=-6..-5  Gate (−6,5)
   *
   * Tile counts: 4+5+7+9+10+10+9+8+6+2 = 70 ✓
   *
   * Start  ( 6,−4)  upper-right edge.
   * Gate   (−6, 5)  lower-left corner — the judgment seat.
   *                 BFS distance from start: 12 hops.
   *
   * Visual era (Chs 7–9): simulations increasingly real and uncontrolled.
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  9: {
    start: '6,-4',
    gate:  '-6,5',
    tiles: [
      // Row r=-4 (upper-right, 4 cells)  Start → (6,−4)
      [ 3,-4],[ 4,-4],[ 5,-4],[ 6,-4],
      // Row r=-3 (5 cells)
      [ 2,-3],[ 3,-3],[ 4,-3],[ 5,-3],[ 6,-3],
      // Row r=-2 (7 cells)
      [ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],[ 5,-2],[ 6,-2],[ 7,-2],
      // Row r=-1 (9 cells)
      [ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],[ 7,-1],[ 8,-1],
      // Row r= 0 (10 cells)
      [-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],[ 6, 0],[ 7, 0],[ 8, 0],
      // Row r= 1 (10 cells)
      [-3, 1],[-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],[ 6, 1],
      // Row r= 2 (9 cells)
      [-4, 2],[-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],
      // Row r= 3 (8 cells)
      [-5, 3],[-4, 3],[-3, 3],[-2, 3],[-1, 3],[ 0, 3],[ 1, 3],[ 2, 3],
      // Row r= 4 (6 cells)
      [-6, 4],[-5, 4],[-4, 4],[-3, 4],[-2, 4],[-1, 4],
      // Row r= 5 (lower-left, 2 cells)  Gate → (−6,5)
      [-6, 5],[-5, 5],
    ],
  },

  /**
   * Chapter 10 — "First Oath Capstone"
   *
   * 70-cell grand ceremonial arena — University Era culmination.
   * Philosophy: a prestigious examination arena.  The widest row (r=0,
   * 10 cells) is the grand hall floor; north and south galleries frame
   * the ceremonial gate and the player entrance.
   *
   * Layout (r=−5 → r=5):
   *
   *   r=-5 (2)          · ⬡ ⬡ ·             q= 1..2   Gate (1,−5)
   *   r=-4 (4)         ⬡ ⬡ ⬡ ⬡ ·           q= 0..3
   *   r=-3 (6)        ⬡ ⬡ ⬡ ⬡ ⬡ ⬡          q=-1..4
   *   r=-2 (8)       ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q=-2..5
   *   r=-1 (9)      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q=-2..6
   *   r= 0 (10)    ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡     q=-3..6
   *   r= 1 (9)      ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡      q=-3..5
   *   r= 2 (8)       ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡       q=-3..4
   *   r= 3 (7)        ⬡ ⬡ ⬡ ⬡ ⬡ ⬡ ⬡         q=-2..4
   *   r= 4 (4)          ⬡ ⬡ ⬡ ⬡              q=-1..2
   *   r= 5 (3)           ⬡ ⬡ ⬡               q= 0..2   Start (1,5)
   *
   * Tile counts: 2+4+6+8+9+10+9+8+7+4+3 = 70 ✓
   *
   * Start  (1, 5)   south gallery entrance.
   * Gate   (1,−5)   north gallery archway — the First Oath seal.
   *                 BFS distance from start: 10 hops.
   *
   * Visual era (Ch 10): prestigious capstone — academy grandeur meets
   * serious clinical pressure.
   * ⚠ DO NOT EDIT start / gate / tile coordinates once shipped.
   */
  10: {
    start: '1,5',
    gate:  '1,-5',
    tiles: [
      // Row r=-5 (north gallery, 2 cells)  Gate → (1,−5)
      [ 1,-5],[ 2,-5],
      // Row r=-4 (4 cells)
      [ 0,-4],[ 1,-4],[ 2,-4],[ 3,-4],
      // Row r=-3 (6 cells)
      [-1,-3],[ 0,-3],[ 1,-3],[ 2,-3],[ 3,-3],[ 4,-3],
      // Row r=-2 (8 cells)
      [-2,-2],[-1,-2],[ 0,-2],[ 1,-2],[ 2,-2],[ 3,-2],[ 4,-2],[ 5,-2],
      // Row r=-1 (9 cells)
      [-2,-1],[-1,-1],[ 0,-1],[ 1,-1],[ 2,-1],[ 3,-1],[ 4,-1],[ 5,-1],[ 6,-1],
      // Row r= 0 (grand hall, 10 cells — widest)
      [-3, 0],[-2, 0],[-1, 0],[ 0, 0],[ 1, 0],[ 2, 0],[ 3, 0],[ 4, 0],[ 5, 0],[ 6, 0],
      // Row r= 1 (9 cells)
      [-3, 1],[-2, 1],[-1, 1],[ 0, 1],[ 1, 1],[ 2, 1],[ 3, 1],[ 4, 1],[ 5, 1],
      // Row r= 2 (8 cells)
      [-3, 2],[-2, 2],[-1, 2],[ 0, 2],[ 1, 2],[ 2, 2],[ 3, 2],[ 4, 2],
      // Row r= 3 (7 cells)
      [-2, 3],[-1, 3],[ 0, 3],[ 1, 3],[ 2, 3],[ 3, 3],[ 4, 3],
      // Row r= 4 (4 cells)
      [-1, 4],[ 0, 4],[ 1, 4],[ 2, 4],
      // Row r= 5 (south gallery, 3 cells)  Start → (1,5)
      [ 0, 5],[ 1, 5],[ 2, 5],
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

  const authored = chapter === 1
    ? getChapterOneCampusRawMap()
    : AUTHORED_CHAPTER_MAPS[chapter];
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
  // Push 1 (doubled footprints): all Book I chapters authored, validated, and locked.
  // ⚠ Never remove a chapter from this set once players have runs on it.
  1,  // "Atrium Approach"       — Ch 1,  60 cells, radius-4 circular courtyard
  2,  // "Teaching Ward"         — Ch 2,  60 cells, wide rounded-rectangle
  3,  // "Procedure Hall"        — Ch 3,  60 cells, wide horizontal corridor
  4,  // "Emergency Simulation"  — Ch 4,  60 cells, tall vertical diamond / radial hub
  5,  // "Sanctuary Courtyard"   — Ch 5,  60 cells, asymmetric courtyard + extended garden
  6,  // "Outer Ward Transition" — Ch 6,  70 cells, large irregular transition
  7,  // "Outbreak Ward"         — Ch 7,  70 cells, dense + quarantine extremities
  8,  // "Broken Handoff Floor"  — Ch 8,  70 cells, multi-wing offset layout
  9,  // "Weight of Judgment"    — Ch 9,  70 cells, asymmetric NE→SW diagonal skew
  10, // "First Oath Capstone"   — Ch10,  70 cells, grand ceremonial arena
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
