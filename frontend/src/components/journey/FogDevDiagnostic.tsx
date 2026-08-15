/**
 * FogDevDiagnostic — DEV-ONLY fog layer alignment diagnostic + layer toggles
 *
 * __DEV__ ONLY.  This component must NEVER render in production.
 *
 * ── Layer dimension report ─────────────────────────────────────────────────────
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
 * ── Layer toggle buttons ───────────────────────────────────────────────────────
 *
 *   [B]  [M]  [E]  [W]  [MSK]
 *   ↑    ↑    ↑    ↑    ↑
 *   Base Mid  Edge Wisp Mask
 *
 * Tap a button to toggle that layer ON/OFF.  Use the test sequence:
 *
 *   A.  Base ON,  Mid OFF, Edge OFF, Wisp OFF  → baseline
 *   B.  Base ON,  Mid ON,  Edge OFF, Wisp OFF  → + Mid
 *   C.  Base ON,  Mid ON,  Edge ON,  Wisp OFF  → + Edge
 *   D.  All ON                                 → full stack
 *
 * Identify the first stage where a horizontal band, rectangular seam, or
 * unexpected opacity appears — that layer contains the compositing bug.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *
 *   Rendered inside HexMapLayer inside MapWorld, wrapped in {__DEV__ && ...}.
 *   zIndex: 19999 — topmost layer, above all fog and dev overlays.
 *   position: absolute, top-right corner of MapWorld.
 *   pointerEvents set on the panel itself — buttons are tappable; rest passes through.
 *
 *   Remove or gate-off once visual compositing is confirmed correct.
 */

import React, { useMemo } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';

import {
  calculateVisibleTileIds,
  getEffectiveVisionRadius,
  DEFAULT_PLAYER_VISION_STATS,
} from '@/src/game/journeyMap/fog/fogVision';
import type { HexMapTile } from '@/src/game/journeyMap/fixture';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FogLayerToggles {
  base: boolean;
  mid:  boolean;
  edge: boolean;
  wisp: boolean;
  mask: boolean;
}

export type FogLayerToggleKey = keyof FogLayerToggles;

export interface FogDevDiagnosticProps {
  /** All tiles in the active run. */
  tiles:       readonly HexMapTile[];
  worldWidth:  number;
  worldHeight: number;
  /** Current toggle state for each layer. */
  fogToggles:  FogLayerToggles;
  /** Called when the user taps a toggle button. */
  onToggle:    (layer: FogLayerToggleKey) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DIAG_Z = 19999;

// ── Component ─────────────────────────────────────────────────────────────────

export function FogDevDiagnostic({
  tiles,
  worldWidth,
  worldHeight,
  fogToggles,
  onToggle,
}: FogDevDiagnosticProps): React.ReactElement | null {
  if (!__DEV__) return null;
  if (Platform.OS !== 'web') return null;

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

  const W   = Math.round(worldWidth);
  const H   = Math.round(worldHeight);
  const dim = `${W} × ${H} @ 0,0`;

  const layerRows: Array<{ label: string; value: string }> = [
    { label: 'Background', value: dim },
    { label: 'Base',       value: dim },
    { label: 'Mid',        value: dim },
    { label: 'Edge',       value: dim },
    { label: 'Wisp',       value: dim },
  ];

  const toggleDefs: Array<{ key: FogLayerToggleKey; label: string }> = [
    { key: 'base', label: 'B' },
    { key: 'mid',  label: 'M' },
    { key: 'edge', label: 'E' },
    { key: 'wisp', label: 'W' },
    { key: 'mask', label: 'MSK' },
  ];

  return (
    <View
      style={{
        position:        'absolute',
        top:             8,
        right:           8,
        zIndex:          DIAG_Z,
        backgroundColor: 'rgba(0,0,0,0.82)',
        borderRadius:    6,
        padding:         8,
        minWidth:        210,
      }}
    >
      {/* Header */}
      <Text style={s.header}>FOG LAYERS</Text>

      {/* Layer dimension rows */}
      {layerRows.map(({ label, value }) => (
        <View key={label} style={s.row}>
          <Text style={s.label}>{label}:</Text>
          <Text style={s.value}>{value}</Text>
        </View>
      ))}

      <View style={s.divider} />

      {/* Tile counts */}
      <DiagRow
        label="Visible Now"
        value={String(visibleCount)}
        highlight={visibleCount === 7 ? 'good' : visibleCount > 0 ? 'warn' : 'bad'}
      />
      <DiagRow label="Explored"   value={String(exploredCount)} />
      <DiagRow label="Unexplored" value={String(unexploredCount)} />
      <DiagRow label="FOV"        value={String(fov)} />

      <View style={s.divider} />

      {/* Layer toggle buttons */}
      <Text style={s.toggleHeader}>TOGGLE LAYERS</Text>
      <View style={s.toggleRow}>
        {toggleDefs.map(({ key, label }) => {
          const on = fogToggles[key];
          return (
            <Pressable
              key={key}
              onPress={() => onToggle(key)}
              style={[s.toggleBtn, on ? s.toggleBtnOn : s.toggleBtnOff]}
            >
              <Text style={[s.toggleLabel, on ? s.toggleLabelOn : s.toggleLabelOff]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Sequence hint */}
      <Text style={s.hint}>A=B only  B=+M  C=+E  D=all</Text>
    </View>
  );
}

// ── DiagRow helper ─────────────────────────────────────────────────────────────

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
    <View style={s.row}>
      <Text style={s.label}>{label}:</Text>
      <Text style={[s.value, { color: valueColor }]}>{value}</Text>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  header: {
    color:         '#a0cfff',
    fontSize:      10,
    fontWeight:    '700' as const,
    letterSpacing: 1.2,
    marginBottom:  4,
    fontFamily:    'monospace',
  },
  row: {
    flexDirection:  'row' as const,
    justifyContent: 'space-between' as const,
    marginBottom:   2,
  },
  label: {
    color:       '#999',
    fontSize:    10,
    fontFamily:  'monospace',
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
  toggleHeader: {
    color:         '#a0cfff',
    fontSize:      9,
    fontWeight:    '700' as const,
    letterSpacing: 1.0,
    marginBottom:  4,
    fontFamily:    'monospace',
  },
  toggleRow: {
    flexDirection:  'row' as const,
    gap:            4,
    marginBottom:   4,
    flexWrap:       'wrap' as const,
  },
  toggleBtn: {
    paddingHorizontal: 6,
    paddingVertical:   3,
    borderRadius:      3,
    borderWidth:       1,
    minWidth:          28,
    alignItems:        'center' as const,
  },
  toggleBtnOn: {
    backgroundColor: 'rgba(64,200,140,0.25)',
    borderColor:     '#40c88c',
  },
  toggleBtnOff: {
    backgroundColor: 'rgba(255,80,80,0.15)',
    borderColor:     '#cc4444',
  },
  toggleLabel: {
    fontSize:   9,
    fontWeight: '700' as const,
    fontFamily: 'monospace',
  },
  toggleLabelOn: {
    color: '#40c88c',
  },
  toggleLabelOff: {
    color: '#cc6666',
  },
  hint: {
    color:      '#666',
    fontSize:   8,
    fontFamily: 'monospace',
  },
} as const;
