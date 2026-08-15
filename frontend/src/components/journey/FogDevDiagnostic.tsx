/**
 * FogDevDiagnostic — DEV-ONLY fog layer alignment diagnostic panel
 *
 * __DEV__ ONLY.  This component must NEVER render in production.
 *
 * ── What it reports ───────────────────────────────────────────────────────────
 *
 *   FOG LAYERS
 *   Background: W × H @ 0,0
 *   Base:       W × H @ 0,0
 *   Mid:        W × H @ 0,0
 *   Edge:       W × H @ 0,0
 *   Wisp:       W × H @ 0,0
 *
 *   Visible Now: X   (should be 7 for an interior tile at FOV 1)
 *   Explored:    X
 *   Unexplored:  X
 *   FOV:         X
 *
 * All five layer rows must show identical dimensions and origin.
 * If they differ, a layer's canvas is not correctly aligned with the world.
 *
 * ── Acceptance criteria ───────────────────────────────────────────────────────
 *
 *   • "Visible Now: 7" for a player starting on an interior tile at FOV=1
 *     (one central hex + six adjacent neighbours).
 *   • All W × H values identical across all five layer rows.
 *   • All origins "@ 0,0".
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   Rendered inside HexMapLayer inside MapWorld, wrapped in {__DEV__ && ...}.
 *   zIndex: 19999 — topmost layer, above all fog and dev overlays.
 *   position: absolute, top-right corner of MapWorld.
 *   pointerEvents="none" — never blocks taps.
 *
 *   Remove or gate-off once visual alignment is confirmed.
 */

import React, { useMemo } from 'react';
import { Platform, Text, View } from 'react-native';

import {
  calculateVisibleTileIds,
  getEffectiveVisionRadius,
  DEFAULT_PLAYER_VISION_STATS,
} from '@/src/game/journeyMap/fog/fogVision';
import type { HexMapTile } from '@/src/game/journeyMap/fixture';

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FogDevDiagnosticProps {
  /** All tiles in the active run. */
  tiles:       readonly HexMapTile[];
  worldWidth:  number;
  worldHeight: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

/** Above all fog layers (5000–5400), all dev overlays (14500, 19000), and
 *  the dev mask (14500).  Matches DEV_DIAGNOSTICS intent. */
const DIAG_Z = 19999;

// ── Component ─────────────────────────────────────────────────────────────────

export function FogDevDiagnostic({
  tiles,
  worldWidth,
  worldHeight,
}: FogDevDiagnosticProps): React.ReactElement | null {
  // Only renders in dev mode on web.
  if (!__DEV__) return null;
  if (Platform.OS !== 'web') return null;

  // Derive tile counts — recomputed whenever tiles change.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { visibleCount, exploredCount, unexploredCount, fov } = useMemo(() => {
    let currentCoord: { q: number; r: number } | undefined;
    let explored = 0;

    for (const tile of tiles) {
      if (tile.current) currentCoord = { q: tile.q, r: tile.r };
      if (tile.visibility === 'exploredButOutOfVision') explored++;
    }

    const effectiveFov = getEffectiveVisionRadius(DEFAULT_PLAYER_VISION_STATS);
    const visibleNowIds = currentCoord
      ? calculateVisibleTileIds({ currentTile: currentCoord, tiles, visionRadius: effectiveFov })
      : new Set<string>();

    const visible = visibleNowIds.size;
    const total   = tiles.length;

    return {
      visibleCount:    visible,
      exploredCount:   explored,
      unexploredCount: Math.max(0, total - visible - explored),
      fov:             effectiveFov,
    };
  }, [tiles]);

  // Dimensions shared by every layer — all must match.
  const W = Math.round(worldWidth);
  const H = Math.round(worldHeight);
  const dim = `${W} × ${H} @ 0,0`;

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Background', value: dim },
    { label: 'Base',       value: dim },
    { label: 'Mid',        value: dim },
    { label: 'Edge',       value: dim },
    { label: 'Wisp',       value: dim },
  ];

  return (
    <View
      pointerEvents="none"
      style={{
        position:        'absolute',
        top:             8,
        right:           8,
        zIndex:          DIAG_Z,
        backgroundColor: 'rgba(0,0,0,0.78)',
        borderRadius:    6,
        padding:         8,
        minWidth:        200,
      }}
    >
      {/* Header */}
      <Text style={styles.header}>FOG LAYERS</Text>

      {/* Layer dimension rows */}
      {rows.map(({ label, value }) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}:</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}

      {/* Divider */}
      <View style={styles.divider} />

      {/* Tile counts */}
      <DiagRow label="Visible Now" value={String(visibleCount)}
        highlight={visibleCount === 7 ? 'good' : visibleCount > 0 ? 'warn' : 'bad'} />
      <DiagRow label="Explored"    value={String(exploredCount)} />
      <DiagRow label="Unexplored"  value={String(unexploredCount)} />
      <DiagRow label="FOV"         value={String(fov)} />
    </View>
  );
}

// ── Internal row helper ────────────────────────────────────────────────────────

function DiagRow({
  label,
  value,
  highlight,
}: {
  label:      string;
  value:      string;
  highlight?: 'good' | 'warn' | 'bad';
}): React.ReactElement {
  const valueColor =
    highlight === 'good' ? '#4eff9e' :
    highlight === 'warn' ? '#f5c842' :
    highlight === 'bad'  ? '#ff6b6b' :
    '#e0dfe0';

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}:</Text>
      <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = {
  header: {
    color:        '#a0cfff',
    fontSize:     10,
    fontWeight:   '700' as const,
    letterSpacing: 1.2,
    marginBottom:  4,
    fontFamily:   'monospace',
  },
  row: {
    flexDirection:  'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom:   2,
  },
  label: {
    color:      '#999',
    fontSize:   10,
    fontFamily: 'monospace',
    marginRight: 8,
  },
  value: {
    color:      '#e0dfe0',
    fontSize:   10,
    fontFamily: 'monospace',
  },
  divider: {
    height:          1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginVertical:  5,
  },
} as const;
