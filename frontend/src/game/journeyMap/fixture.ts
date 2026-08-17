/**
 * journeyMap/fixture.ts — PUSH 4 / updated PUSH 9
 *
 * Defines the canonical `HexMapTile` type used by the hex renderer, plus:
 *   • A static 30-tile development fixture (JOURNEY_MAP_FIXTURE) for the
 *     legacy Push-4 layout — kept for reference/tests.
 *   • `generateDebugFixture(N)` — organic BFS cluster for camera/drag testing.
 *     Returns `HexMapTile[]` in axial q,r coordinates.
 *
 * Coordinate convention (all exports)
 * ─────────────────────────────────────
 * All tiles now use AXIAL q,r coords (flat-top):
 *   pixel_left = q * 0.75 * sz + ox
 *   pixel_top  = (r * 0.866 + q * 0.433) * sz + oy
 *
 * The legacy FixtureTile type (col/row offset) is preserved for internal
 * JOURNEY_MAP_FIXTURE construction but is NOT exported.
 */

import type { EncounterType, ChestTier, TileVisibility, TerrainVisualVariant, WardEventSubtype } from './types';

// ── HexMapTile — canonical rendering type (Push 9) ───────────────────────────

/**
 * Rendering-ready tile descriptor consumed by HexMapLayer.
 * Uses axial q,r coordinates (flat-top hexes).
 */
export interface HexMapTile {
  /** Stable unique identifier, e.g. "0,3". */
  id:          string;
  /** Axial hex column. */
  q:           number;
  /** Axial hex row. */
  r:           number;
  /** Fog visibility level. */
  visibility:  TileVisibility;
  /** Player token is on this tile. */
  current:     boolean;
  /** Encounter type (do NOT render icons for non-revealed tiles). */
  encounter:   EncounterType;
  /** Only set when encounter === 'treasure'. */
  chestTier?:  ChestTier;
  /**
   * Push 20: only set when encounter === 'wardEvent'.
   * Drives which ward-event world-object prop is rendered by encounterMapNode().
   */
  wardEventSubtype?: WardEventSubtype;
  /** True for the chapter-boss gate anchor tile. */
  isGate?:     boolean;
  /**
   * Cosmetic surface variant — only set on 'none' encounter tiles.
   * No gameplay effect; used by the terrain renderer for visual variety.
   */
  visualVariant?: TerrainVisualVariant;

  /**
   * Push 5: blueprint zone classification from the canonical map pipeline.
   * Forwarded from JourneyTile so the MAP BLUEPRINT dev overlay in HexMapLayer
   * can colour each tile by its role without knowing about the pipeline.
   * Absent for non-pipeline chapters and legacy runs.
   */
  zoneType?: 'lane' | 'clearing' | 'transition';
}

// ── Legacy types (internal only) ─────────────────────────────────────────────

/** Offset coordinate tile used by the legacy 30-tile fixture. Not exported. */
interface FixtureTile {
  id:        string;
  col:       number;  // offset column
  row:       number;  // offset row
  visibility: TileVisibility;
  isCurrent: boolean;
  encounter:  EncounterType;
  chestTier:  ChestTier | null;
}

/**
 * Convert flat-top odd-q offset (col, row) → axial (q, r).
 *   q = col
 *   r = row − ⌊col / 2⌋
 */
function offsetToAxial(col: number, row: number): { q: number; r: number } {
  return { q: col, r: row - Math.floor(col / 2) };
}

// ── 30-tile static fixture (legacy, offset coords) ────────────────────────────

/** Raw offset tiles for the Push-4 layout. */
const RAW_FIXTURE: readonly FixtureTile[] = [
  // col 0 (rows 3–5)
  { id:'t00', col:0, row:3, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t01', col:0, row:4, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'battle',   chestTier:null      },
  { id:'t02', col:0, row:5, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'treasure', chestTier:'gold'    },
  // col 1 (rows 2–5)
  { id:'t03', col:1, row:2, visibility:'exploredButOutOfVision', isCurrent:true,  encounter:'none',     chestTier:null      },
  { id:'t04', col:1, row:3, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'battle',   chestTier:null      },
  { id:'t05', col:1, row:4, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'treasure', chestTier:'bronze'  },
  { id:'t06', col:1, row:5, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'merchant', chestTier:null      },
  // col 2 (rows 1–5)
  // Push 9: visibleNow treasure tile — exercises the frontier-chest exception.
  // Silver tier shows the cool blue glow pool in the debug ?debug=N view.
  { id:'t07', col:2, row:1, visibility:'visibleNow', isCurrent:false, encounter:'treasure', chestTier:'silver'  },
  { id:'t08', col:2, row:2, visibility:'visibleNow', isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t09', col:2, row:3, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'battle',   chestTier:null      },
  { id:'t10', col:2, row:4, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'treasure', chestTier:'silver'  },
  { id:'t11', col:2, row:5, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'none',     chestTier:null      },
  // col 3 (rows 0–5)
  { id:'t12', col:3, row:0, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t13', col:3, row:1, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t14', col:3, row:2, visibility:'visibleNow',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t15', col:3, row:3, visibility:'visibleNow',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t16', col:3, row:4, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'areaBoss', chestTier:null      },
  { id:'t17', col:3, row:5, visibility:'exploredButOutOfVision', isCurrent:false, encounter:'none',     chestTier:null      },
  // col 4 (rows 0–4)
  { id:'t18', col:4, row:0, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t19', col:4, row:1, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t20', col:4, row:2, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t21', col:4, row:3, visibility:'visibleNow',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t22', col:4, row:4, visibility:'visibleNow',  isCurrent:false, encounter:'none',     chestTier:null      },
  // col 5 (rows 1–4)
  { id:'t23', col:5, row:1, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t24', col:5, row:2, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t25', col:5, row:3, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t26', col:5, row:4, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  // col 6 (rows 2–4)
  { id:'t27', col:6, row:2, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t28', col:6, row:3, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
  { id:'t29', col:6, row:4, visibility:'unexplored',  isCurrent:false, encounter:'none',     chestTier:null      },
] as const;

/**
 * Push-4 static 30-tile fixture converted to axial HexMapTile.
 * Kept for snapshot tests; the live screen now uses the generated run.
 */
export const JOURNEY_MAP_FIXTURE: readonly HexMapTile[] = RAW_FIXTURE.map(t => {
  const { q, r } = offsetToAxial(t.col, t.row);
  return {
    id:         t.id,
    q,
    r,
    visibility: t.visibility,
    current:    t.isCurrent,
    encounter:  t.encounter,
    chestTier:  t.chestTier ?? undefined,
  };
});

// ── Debug fixture generator ───────────────────────────────────────────────────

/** Flat-top hex neighbours in odd-q offset coords. */
function hexNeighborsFlatTop(col: number, row: number): Array<[number, number]> {
  return col % 2 === 0
    ? [[col-1,row-1],[col-1,row],[col,row-1],[col,row+1],[col+1,row-1],[col+1,row]]
    : [[col-1,row],[col-1,row+1],[col,row-1],[col,row+1],[col+1,row],[col+1,row+1]];
}

const ENC_CYCLE: Array<{ enc: EncounterType; tier: ChestTier | undefined }> = [
  { enc: 'none',     tier: undefined  },
  { enc: 'battle',   tier: undefined  },
  { enc: 'none',     tier: undefined  },
  { enc: 'treasure', tier: 'bronze'   },
  { enc: 'battle',   tier: undefined  },
  { enc: 'treasure', tier: 'silver'   },
  { enc: 'merchant', tier: undefined  },
  { enc: 'battle',   tier: undefined  },
  { enc: 'treasure', tier: 'gold'     },
  { enc: 'areaBoss', tier: undefined  },
];

/**
 * Generate an organic BFS hex cluster of `count` tiles for camera/drag testing.
 *
 * Returns HexMapTile[] in axial q,r coordinates so it can be passed directly
 * to HexMapLayer without conversion. Useful for testing camera bounds at
 * 30, 35, 40, 45, 50, and 55 tiles.
 */
export function generateDebugFixture(count: number): readonly HexMapTile[] {
  // Start from a large centre to allow BFS in all directions.
  const C0 = 8;
  const R0 = 8;
  const seen  = new Set<string>([`${C0},${R0}`]);
  const queue: Array<[number, number]> = [[C0, R0]];
  const raw:   Array<[number, number]> = [];

  while (queue.length > 0 && raw.length < count) {
    const [col, row] = queue.shift()!;
    raw.push([col, row]);
    for (const [nc, nr] of hexNeighborsFlatTop(col, row)) {
      const key = `${nc},${nr}`;
      if (!seen.has(key)) { seen.add(key); queue.push([nc, nr]); }
    }
  }

  // Normalise offset coords so min col = 0, min row = 0.
  const minC = Math.min(...raw.map(([c]) => c));
  const minR = Math.min(...raw.map(([, r]) => r));
  const normed = raw.map(([c, r]) => [c - minC, r - minR] as [number, number]);

  const PLAYER_IDX = Math.floor(count * 0.28);

  return normed.map(([col, row], i) => {
    const { q, r } = offsetToAxial(col, row);
    const pct = i / count;
    const visibility: TileVisibility =
      pct < 0.38 ? 'exploredButOutOfVision' : pct < 0.50 ? 'visibleNow' : 'unexplored';
    const { enc, tier } = visibility === 'exploredButOutOfVision'
      ? ENC_CYCLE[i % ENC_CYCLE.length]
      : { enc: 'none' as EncounterType, tier: undefined };
    return {
      id:        `d${String(i).padStart(2, '0')}`,
      q,
      r,
      visibility,
      current:   i === PLAYER_IDX,
      encounter: enc,
      chestTier: tier,
    };
  });
}
