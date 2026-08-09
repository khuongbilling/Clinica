/**
 * journeyMap/chapterMapTemplate.types.ts — AUTHORED MAP ADJUSTMENT (Push 1)
 *
 * Shared types for the ChapterMapTemplate system.
 *
 * These types describe the STATIC authored layout of a chapter's hex map.
 * They are distinct from the runtime JourneyRun / JourneyTile types, which
 * carry per-run encounter assignments, fog state, and player progress.
 *
 * TILE ROLES
 * ──────────
 * start          — the tile where every run begins.
 * gate           — the Chapter Boss Gate tile.  One per chapter, always at
 *                  a meaningful graph distance from start.
 * normal         — an ordinary traversable tile with no fixed semantic.
 * storyReserved  — reserved for a future authored story beat or cutscene;
 *                  encounter generator treats it like 'normal' until wired.
 *
 * TILE TAGS  (optional, for future encounter-placement hints)
 * ─────────────────────────────────────────────────────────
 * Tags are guidance for the encounter generator, NOT enforced constraints.
 * A tile may carry zero or more tags.
 *
 * edge              — near the perimeter of the map footprint.
 * central           — near the geometric centre.
 * alcove            — reachable via only one neighbour (dead-end).
 * intersection      — has four or more neighbours (hub tile).
 * quiet             — preferred for non-combat encounters (treasure, merchant).
 * bossPreferred     — good candidate for an area-boss encounter.
 * treasurePreferred — good candidate for a treasure encounter.
 * merchantPreferred — good candidate for a traveling-merchant encounter.
 */

export type ChapterTileRole =
  | 'start'
  | 'gate'
  | 'normal'
  | 'storyReserved';

export type ChapterTileTag =
  | 'edge'
  | 'central'
  | 'alcove'
  | 'intersection'
  | 'quiet'
  | 'bossPreferred'
  | 'treasurePreferred'
  | 'merchantPreferred';

export interface ChapterMapTemplateTile {
  /** Canonical key for this tile: the string `"${q},${r}"`. */
  id: string;
  q:  number;
  r:  number;

  /** Semantic role of this tile in the authored layout. */
  role: ChapterTileRole;

  /** Optional placement hints for the encounter generator. */
  tags?: ChapterTileTag[];
}

/**
 * A fully validated, authored layout description for one Chapter.
 *
 * Invariants enforced by getChapterMapTemplate() before returning:
 *   • all tile ids are unique
 *   • all (q, r) coordinate pairs are unique
 *   • exactly one tile has role === 'start'
 *   • exactly one tile has role === 'gate'
 *   • every tile touches at least one other tile (no orphan nodes)
 *   • all playable tiles form one connected component
 *   • gate is reachable from start
 *   • tile count equals the canonical count for this chapter
 *     (30 / 35 / 40 / 45 / 50 … per the chapter band table)
 *   • startTileId and gateTileId reference tiles that exist in `tiles`
 */
export interface ChapterMapTemplate {
  /**
   * Chapter identifier as a string, matching the chapterId used throughout
   * the journey-run system (e.g. "1", "4", "10").
   */
  chapterId: string;

  /**
   * Overall footprint shape — descriptive label, not a strict geometric
   * classification.  'irregular' is the default for organically-grown maps.
   */
  shape: 'rectangular' | 'square' | 'circular' | 'irregular';

  /** All playable tiles in this chapter's fixed layout. */
  tiles: ChapterMapTemplateTile[];

  /** id of the tile with role === 'start'. */
  startTileId: string;

  /** id of the tile with role === 'gate'. */
  gateTileId: string;

  /**
   * Environment / biome identifier used for art and ambient selection.
   * Matched against the asset registry when per-environment artwork ships.
   */
  environmentId: string;
}
