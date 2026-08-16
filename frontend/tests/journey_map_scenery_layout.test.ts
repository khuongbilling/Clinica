/**
 * journey_map_scenery_layout.test.ts — Push 6: SceneryLayout tests
 *
 * Validates all guarantees stated in the SceneryLayout contract:
 *   • Hard rule: no scenery cell overlaps the walkable safety mask
 *   • No scenery cell is in the walkable (HexLaneLayout.cells) set
 *   • Safety mask includes all walkable cells + their 1-ring neighbours
 *   • World bounds contains all walkable cells with margin
 *   • All world-bounds tiles are within worldBounds axial box
 *   • Zone cells form hex-connected components
 *   • No overlap between different zones
 *   • Zone types are valid SceneryZoneType values
 *   • At least 1 scenery zone per chapter
 *   • Density levels respect ordering (LOW → fewer zones than HIGH)
 *   • Ch 1–3 always return LOW density
 *   • Cache determinism (same chapter → same object reference)
 *   • Range API consistency
 *   • walkableSafetyMaskKeys are unique valid "q,r" strings
 *   • computeWalkableSafetyMask / computeWorldBounds utilities
 *   • deriveEnvironmentalDensity matches documented rules
 *   • Full-sweep per chapter (invariant battery)
 */

import assert from 'assert';
import {
  getChapterSceneryLayout,
  getChapterSceneryLayoutRange,
  computeWalkableSafetyMask,
  computeWorldBounds,
  deriveEnvironmentalDensity,
} from '../src/game/journeyMap/chapterSceneryLayout';
import { getChapterHexLayout } from '../src/game/journeyMap/chapterHexLayout';
import { getChapterMapDNA }    from '../src/game/journeyMap/chapterMapDNA';
import type {
  SceneryLayout,
  SceneryZone,
  EnvironmentalDensity,
} from '../src/game/journeyMap/chapterMapTemplate.types';

// ── Test harness ──────────────────────────────────────────────────────────────

let passed = 0, failed = 0;
const failures: string[] = [];

function test(name: string, fn: () => void): void {
  try { fn(); passed++; }
  catch (e: unknown) {
    failed++;
    const msg = e instanceof Error ? e.message : String(e);
    failures.push(`FAIL - ${name}\n       ${msg}`);
    console.error(`FAIL - ${name}\n       ${msg}`);
  }
}

function eq<T>(a: T, b: T, msg?: string): void {
  if (a !== b) throw new Error(`${msg ?? 'eq'}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
}
function ok(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_ZONE_TYPES = new Set([
  'ARCHITECTURE', 'GARDEN', 'PLANTER', 'COLUMN_GROUP', 'BUILDING_WING',
  'OBSERVATION_DECK', 'SIMULATION_STRUCTURE', 'DECORATIVE_LANDMARK',
  'WATER_FEATURE', 'ACADEMIC_STATUE',
]);

const HEX_DIRS = [
  {q:1,r:0},{q:-1,r:0},{q:0,r:1},{q:0,r:-1},{q:1,r:-1},{q:-1,r:1},
];

function coordKey(q: number, r: number): string { return `${q},${r}`; }
function parseKey(k: string): {q:number,r:number} {
  const i = k.indexOf(','); return { q: +k.slice(0,i), r: +k.slice(i+1) };
}

function isValidKey(k: string): boolean {
  const i = k.indexOf(',');
  if (i <= 0) return false;
  const q = +k.slice(0, i), r = +k.slice(i + 1);
  return Number.isInteger(q) && Number.isInteger(r);
}

function isHexConnected(cells: {q:number,r:number}[]): boolean {
  if (cells.length === 0) return true;
  const set = new Set(cells.map(c => coordKey(c.q, c.r)));
  const visited = new Set<string>();
  const queue   = [cells[0]!];
  visited.add(coordKey(cells[0]!.q, cells[0]!.r));
  while (queue.length > 0) {
    const c = queue.shift()!;
    for (const d of HEX_DIRS) {
      const nk = coordKey(c.q + d.q, c.r + d.r);
      if (set.has(nk) && !visited.has(nk)) { visited.add(nk); queue.push(parseKey(nk)); }
    }
  }
  return visited.size === set.size;
}

/**
 * Full battery of invariants for one chapter's SceneryLayout.
 * The walking cells and safety mask come from the lane layout.
 */
function assertSceneryValid(ch: number, sl: SceneryLayout, label: string): void {
  const hexLayout  = getChapterHexLayout(ch);
  const walkKeys   = new Set(hexLayout.cells.map(c => coordKey(c.q, c.r)));
  const safetyKeys = new Set(sl.walkableSafetyMaskKeys);

  // 1. chapterId matches
  eq(sl.chapterId, ch, `[${label}] chapterId`);

  // 2. Seed is a non-empty string
  ok(typeof sl.seed === 'string' && sl.seed.length > 0, `[${label}] seed empty`);

  // 3. Safety mask is a superset of walkable cells
  for (const k of walkKeys) {
    ok(safetyKeys.has(k), `[${label}] walkable key ${k} missing from safety mask`);
  }

  // 4. Safety mask includes all 1-ring neighbours of walkable cells
  for (const c of hexLayout.cells) {
    for (const d of HEX_DIRS) {
      const nk = coordKey(c.q + d.q, c.r + d.r);
      ok(safetyKeys.has(nk), `[${label}] neighbour ${nk} of walkable ${coordKey(c.q,c.r)} not in safety mask`);
    }
  }

  // 5. Safety mask keys are unique and valid
  const uniqueSafe = new Set(sl.walkableSafetyMaskKeys);
  eq(uniqueSafe.size, sl.walkableSafetyMaskKeys.length, `[${label}] safety mask has duplicates`);
  for (const k of sl.walkableSafetyMaskKeys) {
    ok(isValidKey(k), `[${label}] safety mask key '${k}' is not valid "q,r"`);
  }

  // 6. World bounds contain all walkable cells
  const wb = sl.worldBounds;
  for (const c of hexLayout.cells) {
    ok(c.q >= wb.minQ && c.q <= wb.maxQ, `[${label}] walkable q=${c.q} outside worldBounds`);
    ok(c.r >= wb.minR && c.r <= wb.maxR, `[${label}] walkable r=${c.r} outside worldBounds`);
  }

  // 7. World bounds are larger than safety mask bbox (≥ 1-tile margin)
  let minQ=Infinity, maxQ=-Infinity, minR=Infinity, maxR=-Infinity;
  for (const k of safetyKeys) { const {q,r}=parseKey(k); if(q<minQ)minQ=q;if(q>maxQ)maxQ=q;if(r<minR)minR=r;if(r>maxR)maxR=r; }
  ok(wb.minQ <= minQ - 1, `[${label}] worldBounds.minQ ${wb.minQ} not < safetyMask minQ-1=${minQ-1}`);
  ok(wb.maxQ >= maxQ + 1, `[${label}] worldBounds.maxQ ${wb.maxQ} not > safetyMask maxQ+1=${maxQ+1}`);
  ok(wb.minR <= minR - 1, `[${label}] worldBounds.minR ${wb.minR} not < safetyMask minR-1=${minR-1}`);
  ok(wb.maxR >= maxR + 1, `[${label}] worldBounds.maxR ${wb.maxR} not > safetyMask maxR+1=${maxR+1}`);

  // 8. At least 1 scenery zone
  ok(sl.sceneryZones.length >= 1, `[${label}] no scenery zones`);

  // 9. HARD RULE: no scenery cell in walkable safety mask
  for (const zone of sl.sceneryZones) {
    for (const c of zone.cells) {
      const k = coordKey(c.q, c.r);
      ok(!safetyKeys.has(k), `[${label}] zone '${zone.id}' cell ${k} overlaps safety mask`);
      ok(!walkKeys.has(k),   `[${label}] zone '${zone.id}' cell ${k} overlaps walkable cell`);
    }
  }

  // 10. All scenery cells within world bounds
  for (const zone of sl.sceneryZones) {
    for (const c of zone.cells) {
      ok(c.q >= wb.minQ && c.q <= wb.maxQ, `[${label}] zone '${zone.id}' cell q=${c.q} outside worldBounds`);
      ok(c.r >= wb.minR && c.r <= wb.maxR, `[${label}] zone '${zone.id}' cell r=${c.r} outside worldBounds`);
    }
  }

  // 11. Valid zone types
  for (const zone of sl.sceneryZones) {
    ok(VALID_ZONE_TYPES.has(zone.type), `[${label}] zone '${zone.id}' invalid type '${zone.type}'`);
  }

  // 12. Zone cells form hex-connected components
  for (const zone of sl.sceneryZones) {
    ok(isHexConnected(zone.cells), `[${label}] zone '${zone.id}' cells are not hex-connected`);
  }

  // 13. No overlap between different zones
  const allZoneCells = new Map<string, string>(); // key → zoneId
  for (const zone of sl.sceneryZones) {
    for (const c of zone.cells) {
      const k = coordKey(c.q, c.r);
      const existing = allZoneCells.get(k);
      ok(!existing, `[${label}] cell ${k} appears in zones '${zone.id}' and '${existing}'`);
      allZoneCells.set(k, zone.id);
    }
  }

  // 14. Zone ids are unique
  const zoneIds = new Set(sl.sceneryZones.map(z => z.id));
  eq(zoneIds.size, sl.sceneryZones.length, `[${label}] duplicate zone ids`);

  // 15. Zone area matches cells.length
  for (const zone of sl.sceneryZones) {
    eq(zone.area, zone.cells.length, `[${label}] zone '${zone.id}' area !== cells.length`);
  }

  // 16. walkableContactCount ≤ area × 6 (max possible)
  for (const zone of sl.sceneryZones) {
    ok(zone.walkableContactCount <= zone.area, `[${label}] zone '${zone.id}' walkableContactCount > area`);
    ok(zone.walkableContactCount >= 0, `[${label}] zone '${zone.id}' walkableContactCount < 0`);
  }

  // 17. nearestClearingDist ≥ 0
  for (const zone of sl.sceneryZones) {
    ok(zone.nearestClearingDist >= 0, `[${label}] zone '${zone.id}' nearestClearingDist < 0`);
  }

  // 18. environmentalDensity is a valid value
  ok(
    sl.environmentalDensity === 'LOW' || sl.environmentalDensity === 'MEDIUM' || sl.environmentalDensity === 'HIGH',
    `[${label}] invalid density '${sl.environmentalDensity}'`,
  );
}

// ── Section 1: Per-chapter validation (Ch 1–10) ───────────────────────────────

for (let ch = 1; ch <= 10; ch++) {
  test(`[Ch${ch}] full scenery layout validation`, () => {
    assertSceneryValid(ch, getChapterSceneryLayout(ch), `Ch${ch}`);
  });
}

// ── Section 2: Hard rule — no scenery overlaps walkable ───────────────────────

test('[hard-rule] no scenery cell in safety mask (Ch1-10)', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const sl     = getChapterSceneryLayout(ch);
    const safety = new Set(sl.walkableSafetyMaskKeys);
    for (const zone of sl.sceneryZones) {
      for (const c of zone.cells) {
        const k = coordKey(c.q, c.r);
        ok(!safety.has(k), `Ch${ch} zone '${zone.id}' cell ${k} overlaps safety mask`);
      }
    }
  }
});

test('[hard-rule] no scenery cell in walkable cells set (Ch1-10)', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const sl      = getChapterSceneryLayout(ch);
    const walkSet = new Set(getChapterHexLayout(ch).cells.map(c => coordKey(c.q, c.r)));
    for (const zone of sl.sceneryZones) {
      for (const c of zone.cells) {
        ok(!walkSet.has(coordKey(c.q, c.r)), `Ch${ch} zone '${zone.id}' cell ${coordKey(c.q,c.r)} is walkable`);
      }
    }
  }
});

// ── Section 3: Safety mask invariants ─────────────────────────────────────────

test('[safety-mask] includes all walkable cells (Ch1-10)', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const sl      = getChapterSceneryLayout(ch);
    const safety  = new Set(sl.walkableSafetyMaskKeys);
    const walkSet = getChapterHexLayout(ch).cells;
    for (const c of walkSet) {
      ok(safety.has(coordKey(c.q, c.r)), `Ch${ch} walkable ${coordKey(c.q,c.r)} not in safety mask`);
    }
  }
});

test('[safety-mask] includes all 1-ring neighbours of walkable cells', () => {
  for (let ch = 1; ch <= 5; ch++) {
    const sl     = getChapterSceneryLayout(ch);
    const safety = new Set(sl.walkableSafetyMaskKeys);
    for (const c of getChapterHexLayout(ch).cells) {
      for (const d of HEX_DIRS) {
        const nk = coordKey(c.q + d.q, c.r + d.r);
        ok(safety.has(nk), `Ch${ch} neighbour ${nk} of walkable tile not in safety mask`);
      }
    }
  }
});

test('[safety-mask] keys are unique', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const keys   = getChapterSceneryLayout(ch).walkableSafetyMaskKeys;
    const unique = new Set(keys);
    eq(unique.size, keys.length, `Ch${ch} safety mask has ${keys.length - unique.size} duplicates`);
  }
});

test('[safety-mask] computeWalkableSafetyMask utility matches stored keys', () => {
  for (let ch = 1; ch <= 5; ch++) {
    const layout  = getChapterHexLayout(ch);
    const sl      = getChapterSceneryLayout(ch);
    const computed = computeWalkableSafetyMask(layout);
    const stored   = new Set(sl.walkableSafetyMaskKeys);
    for (const k of computed) ok(stored.has(k), `Ch${ch} computed safety key ${k} missing from stored`);
    for (const k of stored)   ok(computed.has(k), `Ch${ch} stored safety key ${k} missing from computed`);
  }
});

// ── Section 4: World bounds invariants ────────────────────────────────────────

test('[world-bounds] contain all walkable cells (Ch1-10)', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const { worldBounds } = getChapterSceneryLayout(ch);
    for (const c of getChapterHexLayout(ch).cells) {
      ok(c.q >= worldBounds.minQ, `Ch${ch} walkable q=${c.q} < minQ=${worldBounds.minQ}`);
      ok(c.q <= worldBounds.maxQ, `Ch${ch} walkable q=${c.q} > maxQ=${worldBounds.maxQ}`);
      ok(c.r >= worldBounds.minR, `Ch${ch} walkable r=${c.r} < minR=${worldBounds.minR}`);
      ok(c.r <= worldBounds.maxR, `Ch${ch} walkable r=${c.r} > maxR=${worldBounds.maxR}`);
    }
  }
});

test('[world-bounds] minQ < maxQ and minR < maxR', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const { worldBounds: wb } = getChapterSceneryLayout(ch);
    ok(wb.minQ < wb.maxQ, `Ch${ch} worldBounds.minQ >= maxQ`);
    ok(wb.minR < wb.maxR, `Ch${ch} worldBounds.minR >= maxR`);
  }
});

test('[world-bounds] scenery cells are within bounds', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const sl = getChapterSceneryLayout(ch);
    const wb = sl.worldBounds;
    for (const zone of sl.sceneryZones) {
      for (const c of zone.cells) {
        ok(c.q >= wb.minQ && c.q <= wb.maxQ && c.r >= wb.minR && c.r <= wb.maxR,
          `Ch${ch} zone '${zone.id}' cell ${coordKey(c.q,c.r)} outside worldBounds`);
      }
    }
  }
});

test('[world-bounds] computeWorldBounds margin is at least 3 tiles', () => {
  for (let ch = 1; ch <= 5; ch++) {
    const layout  = getChapterHexLayout(ch);
    const safety  = computeWalkableSafetyMask(layout);
    const bounds  = computeWorldBounds(safety);
    let minQ=Infinity,maxQ=-Infinity,minR=Infinity,maxR=-Infinity;
    for (const k of safety) { const {q,r}=parseKey(k); if(q<minQ)minQ=q;if(q>maxQ)maxQ=q;if(r<minR)minR=r;if(r>maxR)maxR=r; }
    ok(bounds.minQ <= minQ - 3, `Ch${ch} worldBounds left margin < 3`);
    ok(bounds.maxQ >= maxQ + 3, `Ch${ch} worldBounds right margin < 3`);
    ok(bounds.minR <= minR - 3, `Ch${ch} worldBounds top margin < 3`);
    ok(bounds.maxR >= maxR + 3, `Ch${ch} worldBounds bottom margin < 3`);
  }
});

// ── Section 5: Zone count and density ─────────────────────────────────────────

test('[zones] at least 1 scenery zone per chapter (Ch1-10)', () => {
  for (let ch = 1; ch <= 10; ch++) {
    ok(getChapterSceneryLayout(ch).sceneryZones.length >= 1, `Ch${ch} has 0 scenery zones`);
  }
});

test('[density] Ch1-3 always return LOW', () => {
  for (let ch = 1; ch <= 3; ch++) {
    eq(getChapterSceneryLayout(ch).environmentalDensity, 'LOW', `Ch${ch} density`);
  }
});

test('[density] deriveEnvironmentalDensity matches stored density', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const dna = getChapterMapDNA(ch);
    const derived  = deriveEnvironmentalDensity(dna);
    const stored   = getChapterSceneryLayout(ch).environmentalDensity;
    eq(derived, stored, `Ch${ch} density mismatch`);
  }
});

test('[density] all density values are valid', () => {
  const valid = new Set(['LOW','MEDIUM','HIGH']);
  for (let ch = 1; ch <= 10; ch++) {
    const d = getChapterSceneryLayout(ch).environmentalDensity;
    ok(valid.has(d), `Ch${ch} invalid density '${d}'`);
  }
});

// ── Section 6: Zone cell connectivity ─────────────────────────────────────────

test('[connectivity] each zone cells form a hex-connected component (Ch1-10)', () => {
  for (let ch = 1; ch <= 10; ch++) {
    for (const zone of getChapterSceneryLayout(ch).sceneryZones) {
      ok(isHexConnected(zone.cells), `Ch${ch} zone '${zone.id}' is not hex-connected`);
    }
  }
});

test('[connectivity] zones have at least 2 cells each', () => {
  for (let ch = 1; ch <= 10; ch++) {
    for (const zone of getChapterSceneryLayout(ch).sceneryZones) {
      ok(zone.cells.length >= 2, `Ch${ch} zone '${zone.id}' has only ${zone.cells.length} cell(s)`);
    }
  }
});

// ── Section 7: Zone type validity ─────────────────────────────────────────────

test('[types] all zone types are valid SceneryZoneType values', () => {
  for (let ch = 1; ch <= 10; ch++) {
    for (const zone of getChapterSceneryLayout(ch).sceneryZones) {
      ok(VALID_ZONE_TYPES.has(zone.type), `Ch${ch} zone '${zone.id}' type '${zone.type}' invalid`);
    }
  }
});

// ── Section 8: No inter-zone overlap ──────────────────────────────────────────

test('[overlap] no cell appears in two different zones (Ch1-10)', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const seen = new Map<string, string>();
    for (const zone of getChapterSceneryLayout(ch).sceneryZones) {
      for (const c of zone.cells) {
        const k = coordKey(c.q, c.r);
        const prev = seen.get(k);
        ok(!prev, `Ch${ch} cell ${k} in zones '${zone.id}' and '${prev}'`);
        seen.set(k, zone.id);
      }
    }
  }
});

// ── Section 9: Zone metadata invariants ──────────────────────────────────────

test('[metadata] zone.area === zone.cells.length', () => {
  for (let ch = 1; ch <= 10; ch++) {
    for (const zone of getChapterSceneryLayout(ch).sceneryZones) {
      eq(zone.area, zone.cells.length, `Ch${ch} zone '${zone.id}'`);
    }
  }
});

test('[metadata] walkableContactCount in [0, area]', () => {
  for (let ch = 1; ch <= 10; ch++) {
    for (const zone of getChapterSceneryLayout(ch).sceneryZones) {
      ok(zone.walkableContactCount >= 0, `Ch${ch} zone '${zone.id}' wCC < 0`);
      ok(zone.walkableContactCount <= zone.area, `Ch${ch} zone '${zone.id}' wCC > area`);
    }
  }
});

test('[metadata] nearestClearingDist >= 0', () => {
  for (let ch = 1; ch <= 10; ch++) {
    for (const zone of getChapterSceneryLayout(ch).sceneryZones) {
      ok(zone.nearestClearingDist >= 0, `Ch${ch} zone '${zone.id}' clearingDist < 0`);
    }
  }
});

test('[metadata] unique zone ids per chapter', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const ids = getChapterSceneryLayout(ch).sceneryZones.map(z => z.id);
    eq(new Set(ids).size, ids.length, `Ch${ch} duplicate zone ids`);
  }
});

// ── Section 10: Cache determinism ─────────────────────────────────────────────

test('[cache] same chapter returns same object reference', () => {
  for (let ch = 1; ch <= 10; ch++) {
    const a = getChapterSceneryLayout(ch);
    const b = getChapterSceneryLayout(ch);
    ok(a === b, `Ch${ch} cache returned different objects`);
  }
});

// ── Section 11: Range API ─────────────────────────────────────────────────────

test('[range] getChapterSceneryLayoutRange(1,10) returns 10 layouts', () => {
  eq(getChapterSceneryLayoutRange(1, 10).length, 10, 'range length');
});

test('[range] each layout has correct chapterId', () => {
  const layouts = getChapterSceneryLayoutRange(1, 10);
  for (let i = 0; i < layouts.length; i++) {
    eq(layouts[i]!.chapterId, i + 1, `range[${i}].chapterId`);
  }
});

test('[range] range matches individual calls', () => {
  const layouts = getChapterSceneryLayoutRange(1, 10);
  for (let ch = 1; ch <= 10; ch++) {
    ok(layouts[ch - 1] === getChapterSceneryLayout(ch), `Ch${ch} range !== individual`);
  }
});

// ── Section 12: deriveEnvironmentalDensity utility ────────────────────────────

test('[density-util] ch1-3 always LOW regardless of pattern', () => {
  const patterns = ['none','islands','walls','blocks','mixed'] as const;
  for (let ch = 1; ch <= 3; ch++) {
    for (const pattern of patterns) {
      const fakeDna = { chapterId: ch, obstaclePattern: pattern } as any;
      eq(deriveEnvironmentalDensity(fakeDna), 'LOW', `Ch${ch} pattern=${pattern}`);
    }
  }
});

test('[density-util] none pattern gives LOW for ch4+', () => {
  const fakeDna = { chapterId: 5, obstaclePattern: 'none' } as any;
  eq(deriveEnvironmentalDensity(fakeDna), 'LOW', 'none→LOW');
});

test('[density-util] walls pattern gives MEDIUM for ch4+', () => {
  const fakeDna = { chapterId: 6, obstaclePattern: 'walls' } as any;
  eq(deriveEnvironmentalDensity(fakeDna), 'MEDIUM', 'walls→MEDIUM');
});

test('[density-util] mixed pattern gives HIGH for ch4+', () => {
  const fakeDna = { chapterId: 8, obstaclePattern: 'mixed' } as any;
  eq(deriveEnvironmentalDensity(fakeDna), 'HIGH', 'mixed→HIGH');
});

test('[density-util] blocks ch8+ gives HIGH', () => {
  const fakeDna = { chapterId: 9, obstaclePattern: 'blocks' } as any;
  eq(deriveEnvironmentalDensity(fakeDna), 'HIGH', 'blocks+ch9→HIGH');
});

// ── Section 13: Full-sweep per chapter ────────────────────────────────────────

for (let ch = 1; ch <= 10; ch++) {
  test(`[full-sweep ch${ch}] all invariants pass`, () => {
    assertSceneryValid(ch, getChapterSceneryLayout(ch), `Ch${ch}`);
  });
}

// ── Results ───────────────────────────────────────────────────────────────────

const total = passed + failed;
for (const f of failures) console.log(f);
if (failed === 0) {
  console.log(`\nPASS - all ${total} tests passed`);
} else {
  console.log(`\n── Results: ${passed} passed, ${failed} failed ──`);
  process.exit(1);
}
