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

export type TerrainType = "grass" | "dirt" | "water" | "mountain" | "stone";

export interface PlotCell {
  id: string;
  row: number;
  col: number;
  plotType: PlotType;
  districtId: DistrictId | null;
  terrain: TerrainType;
  // Expansion plots are otherwise-normal district cells gated behind a higher
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

const ZONES: ZoneRect[] = [
  { rowStart: 1, rowEnd: 6, colStart: 1, colEnd: 6, plotType: "scholar", districtId: "scholar", terrain: "grass", expansionCols: [1] },
  { rowStart: 1, rowEnd: 6, colStart: 7, colEnd: 12, plotType: "care", districtId: "care", terrain: "grass", expansionCols: [12] },
  { rowStart: 7, rowEnd: 7, colStart: 1, colEnd: 12, plotType: "decoration", districtId: null, terrain: "dirt" },
  { rowStart: 8, rowEnd: 13, colStart: 1, colEnd: 4, plotType: "diplomacy", districtId: "diplomacy", terrain: "grass", expansionCols: [1] },
  { rowStart: 8, rowEnd: 13, colStart: 5, colEnd: 9, plotType: "sanctuary", districtId: "sanctuary", terrain: "grass" },
  { rowStart: 8, rowEnd: 13, colStart: 10, colEnd: 12, plotType: "support", districtId: "defense", terrain: "grass", expansionCols: [12] },
  { rowStart: 14, rowEnd: 14, colStart: 1, colEnd: 12, plotType: "decoration", districtId: null, terrain: "dirt" },
  { rowStart: 15, rowEnd: 18, colStart: 1, colEnd: 6, plotType: "wellness", districtId: "wellness", terrain: "grass", expansionCols: [1] },
  { rowStart: 15, rowEnd: 18, colStart: 7, colEnd: 12, plotType: "commerce", districtId: "commerce", terrain: "grass", expansionCols: [12] },
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
          plotType: "blocked", districtId: null, terrain: "stone",
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

export const GRID_CELLS: PlotCell[] = buildGrid();
const CELL_BY_ID = new Map(GRID_CELLS.map((c) => [c.id, c]));

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

// Default Atrium origin — the only building placed automatically. Chosen so its
// 4x4 footprint fits entirely inside the central Sanctuary zone.
export const DEFAULT_ATRIUM_ORIGIN = { row: 9, col: 6 };

export function getFootprintCells(origin: { row: number; col: number }, footprint: Footprint): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let dr = 0; dr < footprint.h; dr++) {
    for (let dc = 0; dc < footprint.w; dc++) {
      out.push({ row: origin.row + dr, col: origin.col + dc });
    }
  }
  return out;
}

export function districtToPlotType(district: DistrictId): PlotType {
  return district === "defense" ? "support" : (district as PlotType);
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

export function canPlaceBuilding(params: {
  districtId: DistrictId;
  footprint: Footprint;
  origin: { row: number; col: number };
  occupiedCellMap: Map<string, string>;
  atriumLevel: number;
  unlocked: boolean;
  ignoreBuildingId?: string;
}): PlacementCheck {
  const { districtId, footprint, origin, occupiedCellMap, atriumLevel, unlocked, ignoreBuildingId } = params;
  const cells = getFootprintCells(origin, footprint);
  if (!unlocked) return { ok: false, reason: "This building isn't unlocked yet.", cells };
  const requiredType = districtToPlotType(districtId);
  for (const { row, col } of cells) {
    const cell = getCell(row, col);
    if (!cell) return { ok: false, reason: "That footprint falls outside the Realm grid.", cells };
    if (cell.plotType !== requiredType) return { ok: false, reason: `Needs a ${requiredType} plot — this ground is incompatible.`, cells };
    if (!isCellUnlocked(cell, atriumLevel)) return { ok: false, reason: "This ground is a locked Expansion Plot.", cells };
    const occupant = occupiedCellMap.get(cell.id);
    if (occupant && occupant !== ignoreBuildingId) return { ok: false, reason: "Overlaps an existing building.", cells };
  }
  return { ok: true, cells };
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
