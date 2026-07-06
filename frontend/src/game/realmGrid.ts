// Realm Grid Engine — Push 5.5 structural correction.
//
// This file replaces the old fixed-plot / painted-map Realm system with a real
// data-driven plot-cell grid: a rectangular grid of cells, each with a plot type,
// terrain, lock status, and district. Buildings are separate placeable objects
// with footprints (width x height in cells) that occupy multiple cells. Roads are
// derived automatically from the current layout (never baked into background art).
//
// Nothing here renders UI — app/(tabs)/kingdom.tsx consumes these pure functions.

import type { DistrictId, PlotType } from "./realm";

export const GRID_ROWS = 20;
export const GRID_COLS = 14;
export const CELL_PX = 34;

// Push 5.5 correction — terrain is purely a visual/texture concern now.
// "meadow" and "path" were added so the terrain reads as painterly, varied
// grassland instead of one flat green; none of these gate placement — only
// `plotType` (buildable/decoration/blocked) does that (see canPlaceBuilding).
export type TerrainType = "grass" | "meadow" | "stone" | "path" | "water" | "forest" | "mountain";

export interface PlotCell {
  id: string;
  row: number;
  col: number;
  plotType: PlotType;
  // Cosmetic theme tag only (e.g. for Realm Harmony flavor) — never a
  // placement requirement. Any building may be placed on any buildable cell
  // regardless of its districtId.
  districtId: DistrictId | null;
  terrain: TerrainType;
  // Expansion plots are otherwise-normal buildable cells gated behind a higher
  // Atrium level — they exist so Move/Build have visible room to grow into.
  isExpansion: boolean;
  expansionAtriumLevel: number;
}

export function cellId(row: number, col: number): string {
  return `r${row}_c${col}`;
}

export function parseCellId(id: string): { row: number; col: number } | null {
  const m = /^r(\d+)_c(\d+)$/.exec(id);
  if (!m) return null;
  return { row: parseInt(m[1], 10), col: parseInt(m[2], 10) };
}

export function isValidCellId(id: string | undefined | null): boolean {
  if (!id) return false;
  const p = parseCellId(id);
  return !!p && p.row >= 0 && p.row < GRID_ROWS && p.col >= 0 && p.col < GRID_COLS;
}

interface ZoneRect {
  rowStart: number; rowEnd: number; colStart: number; colEnd: number;
  plotType: PlotType; districtId: DistrictId | null; terrain: TerrainType;
  expansionCols?: number[]; // absolute column indices within this rect treated as expansion
}

// Push 5.5 correction — zones no longer hard-gate WHAT can be built here; they
// only vary the terrain texture (grass/meadow/stone courtyard) for visual
// richness, and carry a cosmetic districtId used solely for Realm Harmony
// flavor tags. Any unlocked, empty "buildable" cell accepts any building
// whose footprint fits (see canPlaceBuilding below). Small water/forest
// accent rects are listed FIRST so `.find` matches them before the larger
// buildable rect they sit inside of, carving out a few intuitive blockers
// (a pond, a small grove) without needing a bespoke tile grid.
const ZONES: ZoneRect[] = [
  // --- small intuitive blockers (checked first) ---
  { rowStart: 9, rowEnd: 9, colStart: 5, colEnd: 6, plotType: "blocked", districtId: null, terrain: "water" },
  { rowStart: 16, rowEnd: 17, colStart: 10, colEnd: 11, plotType: "blocked", districtId: null, terrain: "forest" },
  // --- decoration walkways ---
  { rowStart: 7, rowEnd: 7, colStart: 1, colEnd: 12, plotType: "decoration", districtId: null, terrain: "path" },
  { rowStart: 14, rowEnd: 14, colStart: 1, colEnd: 12, plotType: "decoration", districtId: null, terrain: "path" },
  // --- open buildable ground, terrain-varied only ---
  { rowStart: 1, rowEnd: 6, colStart: 1, colEnd: 6, plotType: "buildable", districtId: "scholar", terrain: "grass", expansionCols: [1] },
  { rowStart: 1, rowEnd: 6, colStart: 7, colEnd: 12, plotType: "buildable", districtId: "care", terrain: "meadow", expansionCols: [12] },
  { rowStart: 8, rowEnd: 13, colStart: 1, colEnd: 4, plotType: "buildable", districtId: "diplomacy", terrain: "grass", expansionCols: [1] },
  { rowStart: 8, rowEnd: 13, colStart: 5, colEnd: 9, plotType: "buildable", districtId: "sanctuary", terrain: "stone" },
  { rowStart: 8, rowEnd: 13, colStart: 10, colEnd: 12, plotType: "buildable", districtId: "defense", terrain: "meadow", expansionCols: [12] },
  { rowStart: 15, rowEnd: 18, colStart: 1, colEnd: 6, plotType: "buildable", districtId: "wellness", terrain: "grass", expansionCols: [1] },
  { rowStart: 15, rowEnd: 18, colStart: 7, colEnd: 12, plotType: "buildable", districtId: "commerce", terrain: "meadow", expansionCols: [12] },
];

const EXPANSION_ATRIUM_LEVEL = 4;

function buildGrid(): PlotCell[] {
  const cells: PlotCell[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      if (row === 0 || row === GRID_ROWS - 1 || col === 0 || col === GRID_COLS - 1) {
        cells.push({
          id: cellId(row, col), row, col,
          plotType: "blocked", districtId: null, terrain: row === 0 || row === GRID_ROWS - 1 ? "mountain" : "water",
          isExpansion: false, expansionAtriumLevel: 0,
        });
        continue;
      }
      const zone = ZONES.find((z) => row >= z.rowStart && row <= z.rowEnd && col >= z.colStart && col <= z.colEnd);
      if (!zone) {
        cells.push({
          id: cellId(row, col), row, col,
          plotType: "blocked", districtId: null, terrain: "forest",
          isExpansion: false, expansionAtriumLevel: 0,
        });
        continue;
      }
      const isExpansion = !!zone.expansionCols?.includes(col);
      cells.push({
        id: cellId(row, col), row, col,
        plotType: zone.plotType, districtId: zone.districtId, terrain: zone.terrain,
        isExpansion, expansionAtriumLevel: isExpansion ? EXPANSION_ATRIUM_LEVEL : 0,
      });
    }
  }
  return cells;
}

// Push 5.5 correction — replaces the old district-locked plot-type label. A
// cell's label now describes its actual terrain/plot state, never a district
// requirement, matching the "any unlocked buildable ground works" rule.
export function getCellLabel(cell: PlotCell): string {
  if (cell.plotType === "blocked") {
    if (cell.terrain === "water") return "Water Cell";
    if (cell.terrain === "mountain") return "Border Cell";
    if (cell.terrain === "forest") return "Forest Cell";
    return "Blocked Cell";
  }
  if (cell.plotType === "decoration") return "Decoration Cell";
  if (cell.terrain === "meadow") return "Buildable Meadow";
  if (cell.terrain === "stone") return "Buildable Stone Courtyard";
  return "Buildable Grass";
}

export const GRID_CELLS: PlotCell[] = buildGrid();
const CELL_BY_ID = new Map(GRID_CELLS.map((c) => [c.id, c]));

// ---------------------------------------------------------------------------
// Push 5.6 — per-player RANDOM terrain. Every player gets a unique-looking
// Realm generated deterministically from their `realm_seed`. This only remaps
// each cell's cosmetic `terrain` texture — it NEVER changes `plotType`, so
// what/where a building can be placed stays identical for every player (fair
// progression). Buildable ground varies across grass/meadow only (worn dirt
// shows up solely as the auto-generated roads between buildings, so open fields
// stay coherent). Inland natural blockers are ponds (water) and groves (forest)
// only — never rock — so no stray "stone block in a field of grass". Rock/
// mountain appears only as the top/bottom border ridge framing the map. All of
// it is driven by smooth value-noise so features cluster naturally instead of
// looking like random static.
// ---------------------------------------------------------------------------

function hash2(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Smooth 2D value noise in [0,1] sampled at a chosen frequency, so terrain
// forms soft blobs/regions rather than per-cell speckle.
function valueNoise(row: number, col: number, seed: number, freq: number): number {
  const fx = col / freq;
  const fy = row / freq;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}

// Returns a map of cellId -> terrain texture for the given player seed.
// Callers overlay this onto GRID_CELLS (overriding only `terrain`).
export function generatePlayerTerrain(seed: number): Record<string, TerrainType> {
  const s = seed && seed > 0 ? seed >>> 0 : 1;
  const map: Record<string, TerrainType> = {};
  for (const cell of GRID_CELLS) {
    if (cell.plotType === "buildable") {
      if (cell.terrain === "stone") {
        // Keep the central courtyard reading as one coherent paved plaza.
        map[cell.id] = "stone";
      } else {
        // Open ground: soft flowery-meadow regions melting into plain grass.
        // No stray dirt patches — those only ever appear as real roads.
        const n = valueNoise(cell.row, cell.col, s, 4.5);
        map[cell.id] = n > 0.58 ? "meadow" : "grass";
      }
    } else if (cell.plotType === "decoration") {
      map[cell.id] = "path";
    } else {
      // Blocked cells: a coherent water/mountain frame around the edge, with
      // inland blockers limited to natural ponds and groves.
      const onBorder =
        cell.row === 0 || cell.row === GRID_ROWS - 1 || cell.col === 0 || cell.col === GRID_COLS - 1;
      if (onBorder) {
        // Top/bottom edges form a mountain ridge (with the odd tree line), the
        // side edges stay a clean water moat — a coherent frame, no rogue rocks
        // poking into the water.
        const edgeNoise = valueNoise(cell.row, cell.col, s ^ 0x51ed270b, 4);
        if (cell.row === 0 || cell.row === GRID_ROWS - 1) {
          map[cell.id] = edgeNoise > 0.72 ? "forest" : "mountain";
        } else {
          map[cell.id] = "water";
        }
      } else {
        // Inland blockers are natural features only — ponds and groves that
        // cluster smoothly. Never rock, so nothing reads as a random stone
        // block dropped into the greenery.
        const n = valueNoise(cell.row, cell.col, s ^ 0x27d4eb2f, 3.0);
        map[cell.id] = n > 0.5 ? "water" : "forest";
      }
    }
  }
  return map;
}

// Applies a generated terrain map onto the static grid, returning a fresh
// PlotCell[] with only `terrain` overridden (plotType/lock/district intact).
export function cellsWithTerrain(terrain: Record<string, TerrainType>): PlotCell[] {
  return GRID_CELLS.map((c) => {
    const t = terrain[c.id];
    return t && t !== c.terrain ? { ...c, terrain: t } : c;
  });
}

export function getCell(row: number, col: number): PlotCell | undefined {
  return CELL_BY_ID.get(cellId(row, col));
}

export function getCellById(id: string): PlotCell | undefined {
  return CELL_BY_ID.get(id);
}

export function isCellUnlocked(cell: PlotCell, atriumLevel: number): boolean {
  if (cell.plotType === "blocked") return false;
  if (cell.isExpansion) return atriumLevel >= cell.expansionAtriumLevel;
  return true;
}

export interface Footprint { w: number; h: number; }

export const BUILDING_FOOTPRINTS: Record<string, Footprint> = {
  grand_ward_atrium: { w: 4, h: 4 },
  clinica_university: { w: 3, h: 3 },
  research_library: { w: 2, h: 2 },
  hospital_ward: { w: 3, h: 3 },
  hall_of_heroes: { w: 2, h: 2 },
  apothecary: { w: 2, h: 2 },
  sanctuary_bank: { w: 2, h: 2 },
  sanctuary_bazaar: { w: 3, h: 2 },
  nutrition_garden: { w: 2, h: 3 },
  ward_defense_tower: { w: 2, h: 2 },
  faction_embassy: { w: 3, h: 3 },
};

export const DECORATION_FOOTPRINT: Footprint = { w: 1, h: 1 };

export function getFootprint(buildingId: string): Footprint {
  return BUILDING_FOOTPRINTS[buildingId] || { w: 1, h: 1 };
}

// Default Atrium origin — the anchor landmark. Chosen so its 4x4 footprint
// fits entirely inside the central Sanctuary zone (rows 9-12, cols 6-9).
export const DEFAULT_ATRIUM_ORIGIN = { row: 9, col: 6 };

// Default Clinica University origin — auto-placed by the guided-onboarding pass
// just to the LEFT of the Atrium. Its 3x3 footprint occupies rows 9-11, cols
// 2-4: all buildable, unlocked grass in the diplomacy zone (cols 1-4), clear of
// the Atrium's 4x4 footprint (cols 6-9) and the central water cells at r9 c5-6.
export const DEFAULT_UNIVERSITY_ORIGIN = { row: 9, col: 2 };

export function getFootprintCells(origin: { row: number; col: number }, footprint: Footprint): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let dr = 0; dr < footprint.h; dr++) {
    for (let dc = 0; dc < footprint.w; dc++) {
      out.push({ row: origin.row + dr, col: origin.col + dc });
    }
  }
  return out;
}

// Occupied cells derived from the current layout (buildingId -> origin cellId).
export function getOccupiedCellMap(layout: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [buildingId, originId] of Object.entries(layout)) {
    const origin = parseCellId(originId);
    if (!origin) continue;
    const footprint = getFootprint(buildingId);
    for (const c of getFootprintCells(origin, footprint)) {
      map.set(cellId(c.row, c.col), buildingId);
    }
  }
  return map;
}

export interface PlacementCheck { ok: boolean; reason?: string; cells: { row: number; col: number }[]; }

// Push 5.5 correction — placement is no longer district-gated. Any unlocked,
// empty, "buildable" cell accepts any building whose footprint fits. The only
// intuitive blockers left are water/forest/mountain/border terrain, locked
// expansion ground, and cells already occupied by another building.
export function canPlaceBuilding(params: {
  footprint: Footprint;
  origin: { row: number; col: number };
  occupiedCellMap: Map<string, string>;
  atriumLevel: number;
  unlocked: boolean;
  ignoreBuildingId?: string;
}): PlacementCheck {
  const { footprint, origin, occupiedCellMap, atriumLevel, unlocked, ignoreBuildingId } = params;
  const cells = getFootprintCells(origin, footprint);
  if (!unlocked) return { ok: false, reason: "This building isn't unlocked yet.", cells };
  for (const { row, col } of cells) {
    const cell = getCell(row, col);
    if (!cell) return { ok: false, reason: "That footprint falls outside the Realm grid.", cells };
    if (cell.plotType !== "buildable") {
      return { ok: false, reason: "This ground isn't buildable — try open grass, meadow, or stone courtyard.", cells };
    }
    if (!isCellUnlocked(cell, atriumLevel)) return { ok: false, reason: "This ground is a locked Expansion Plot.", cells };
    const occupant = occupiedCellMap.get(cell.id);
    if (occupant && occupant !== ignoreBuildingId) return { ok: false, reason: "Overlaps an existing building.", cells };
  }
  return { ok: true, cells };
}

// Returns every origin cell (row, col) on the grid where the given footprint
// could legally be placed right now — used to highlight ALL valid cells
// during placement mode, not just the single hovered target.
export function findAllValidOrigins(params: {
  footprint: Footprint;
  occupiedCellMap: Map<string, string>;
  atriumLevel: number;
  unlocked: boolean;
  ignoreBuildingId?: string;
}): { row: number; col: number }[] {
  const { footprint, occupiedCellMap, atriumLevel, unlocked, ignoreBuildingId } = params;
  if (!unlocked) return [];
  const valid: { row: number; col: number }[] = [];
  for (let row = 0; row <= GRID_ROWS - footprint.h; row++) {
    for (let col = 0; col <= GRID_COLS - footprint.w; col++) {
      const check = canPlaceBuilding({ footprint, origin: { row, col }, occupiedCellMap, atriumLevel, unlocked, ignoreBuildingId });
      if (check.ok) valid.push({ row, col });
    }
  }
  return valid;
}

export function canPlaceDecoration(params: {
  origin: { row: number; col: number };
  occupiedCellMap: Map<string, string>;
  decorOccupied: Set<string>;
}): PlacementCheck {
  const cells = getFootprintCells(params.origin, DECORATION_FOOTPRINT);
  const [{ row, col }] = cells;
  const cell = getCell(row, col);
  if (!cell) return { ok: false, reason: "Outside the Realm grid.", cells };
  if (cell.plotType !== "decoration") return { ok: false, reason: "Decorations need a Decoration Plot.", cells };
  if (params.occupiedCellMap.get(cell.id)) return { ok: false, reason: "A building already stands here.", cells };
  if (params.decorOccupied.has(cell.id)) return { ok: false, reason: "Already decorated.", cells };
  return { ok: true, cells };
}

// ---------------------------------------------------------------------------
// Auto-generated roads. Roads are a derived overlay recomputed from scratch
// every time the layout changes — never persisted, never baked into terrain.
// Each non-Atrium building's footprint is BFS-connected to the Atrium footprint
// or to the growing road network, walking only through free (non-building,
// non-blocked) cells.
// ---------------------------------------------------------------------------

function neighborCells(row: number, col: number): { row: number; col: number }[] {
  return [
    { row: row - 1, col }, { row: row + 1, col },
    { row, col: col - 1 }, { row, col: col + 1 },
  ];
}

function adjacentTo(cells: { row: number; col: number }[]): Set<string> {
  const set = new Set<string>();
  for (const c of cells) {
    for (const n of neighborCells(c.row, c.col)) {
      const cell = getCell(n.row, n.col);
      if (cell) set.add(cell.id);
    }
  }
  return set;
}

export function computeRoads(layout: Record<string, string>, atriumBuildingId = "grand_ward_atrium"): Set<string> {
  const roadSet = new Set<string>();
  const occupiedCellMap = getOccupiedCellMap(layout);
  const atriumOriginId = layout[atriumBuildingId];
  const atriumOrigin = atriumOriginId ? parseCellId(atriumOriginId) : null;
  const atriumCells = atriumOrigin ? getFootprintCells(atriumOrigin, getFootprint(atriumBuildingId)) : [];
  const targetSet = adjacentTo(atriumCells);

  const buildingEntries = Object.entries(layout).filter(([id]) => id !== atriumBuildingId);

  for (const [buildingId, originId] of buildingEntries) {
    const origin = parseCellId(originId);
    if (!origin) continue;
    const footprint = getFootprint(buildingId);
    const buildingCells = getFootprintCells(origin, footprint);
    const buildingCellIds = new Set(buildingCells.map((c) => cellId(c.row, c.col)));
    const starts = adjacentTo(buildingCells);

    // Combined target: Atrium doorstep OR any existing road tile.
    const isTarget = (id: string) => targetSet.has(id) || roadSet.has(id);

    // BFS from any start cell to the nearest target/road, walking only through
    // free, non-blocked, non-building cells (a start cell may itself already be
    // a target, in which case the path is trivially empty).
    const startArr = Array.from(starts).filter((id) => !buildingCellIds.has(id));
    let found = false;
    for (const s of startArr) {
      if (isTarget(s)) { roadSet.add(s); found = true; break; }
    }
    if (found) continue;

    const visited = new Set<string>(startArr);
    const queue: { id: string; path: string[] }[] = startArr.map((id) => ({ id, path: [id] }));
    let qi = 0;
    let result: string[] | null = null;
    while (qi < queue.length) {
      const { id, path } = queue[qi++];
      const parsed = parseCellId(id);
      if (!parsed) continue;
      for (const n of neighborCells(parsed.row, parsed.col)) {
        const cell = getCell(n.row, n.col);
        if (!cell) continue;
        if (cell.id === id) continue;
        if (visited.has(cell.id)) continue;
        if (buildingCellIds.has(cell.id)) continue;
        const occupant = occupiedCellMap.get(cell.id);
        if (occupant && occupant !== buildingId) continue; // another building blocks the path
        if (cell.plotType === "blocked") continue;
        const nextPath = [...path, cell.id];
        if (isTarget(cell.id)) { result = nextPath; break; }
        visited.add(cell.id);
        queue.push({ id: cell.id, path: nextPath });
      }
      if (result) break;
    }
    if (result) {
      for (const id of result) roadSet.add(id);
    }
  }

  return roadSet;
}
