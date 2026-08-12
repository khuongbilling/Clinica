/**
 * JourneyMapDiagnosticsPanel — Push 0 (dev-only)
 *
 * Floating overlay that exposes the full terrain / visibility / world diagnostic
 * data for the active Journey chapter map.  Production builds must never render
 * this component — the parent must guard with `if (!__DEV__) return null`.
 *
 * Sections:
 *   RUN       — chapterId, timeOfDay, run id, attemptNumber, seed
 *   TERRAIN   — expected / template / runtime / rendered / encounterEligible counts
 *   VISIBILITY — visibleNow / explored / unexplored tile counts
 *   WORLD     — worldW/H, viewportW/H, cameraX/Y
 *   SPECIAL   — startTileId, gateTileId, areaBoss count, boss keys
 *   OVERLAY   — toggle checkboxes for each per-tile debug overlay
 */

import React, { useCallback, useReducer, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { HexMapDevOverlay, HexMapWorldMetrics } from '../HexMapLayer';
import type { JourneyRun } from '../../../game/journeyMap/types';

// Re-export so fog-map.tsx has a single import point for dev types.
export type { HexMapDevOverlay, HexMapWorldMetrics };

// ── Props ─────────────────────────────────────────────────────────────────────

export interface JourneyMapDiagnosticsProps {
  chapterId:                string;
  chNum:                    number;
  timeOfDay:                string | undefined;
  run:                      JourneyRun | null;
  /** From getChapterTerrainCellCount(chNum) */
  expectedTerrainCellCount: number;
  /** From getChapterMapTemplate(chNum).tiles.length — may be null if template throws */
  templateTerrainCellCount: number | null;
  /** mapTiles.length — what was actually passed to HexMapLayer */
  renderedTerrainCellCount: number;
  viewportWidth:            number;
  viewportHeight:           number;
  /** run-level + chapter-level reconciled key count */
  keysCollected:            number;
  areaBossCount:            number;
  /** Written by HexMapLayer after its useLayoutEffect; read on refresh */
  worldMetricsRef:          React.RefObject<HexMapWorldMetrics | null>;
  overlay:                  HexMapDevOverlay;
  onOverlayChange:          (next: HexMapDevOverlay) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function JourneyMapDiagnosticsPanel(props: JourneyMapDiagnosticsProps) {
  const {
    chapterId, chNum, timeOfDay, run,
    expectedTerrainCellCount, templateTerrainCellCount,
    renderedTerrainCellCount,
    viewportWidth, viewportHeight,
    keysCollected, areaBossCount,
    worldMetricsRef, overlay, onOverlayChange,
  } = props;

  const [open, setOpen] = useState(false);
  // Incrementing this forces the panel to re-read worldMetricsRef.current.
  const [, refresh] = useReducer((n: number) => n + 1, 0);

  const metrics = worldMetricsRef.current;

  // ── Derived terrain counts ─────────────────────────────────────────────────
  const tiles        = run?.tiles ?? [];
  const runtimeCount = tiles.length;

  // Push 5: "Rendered terrain" = the count from inside HexMapLayer's render
  // loop (worldMetricsRef.current.renderedTileCount), not mapTiles.length from
  // the parent.  Both equal tiles.length when no filtering occurs — using the
  // HexMapLayer value is the more semantically correct source.
  // Falls back to renderedTerrainCellCount prop (= mapTiles.length) until the
  // first useLayoutEffect in HexMapLayer fires (requires containerWidth ≥ 10).
  const renderedInMapWorld =
    metrics?.renderedTileCount ?? renderedTerrainCellCount;

  const visibleNowCount   = tiles.filter(t => t.visibility === 'visibleNow').length;
  const exploredCount     = tiles.filter(t => t.visibility === 'exploredButOutOfVision').length;
  const unexploredCount   = tiles.filter(t => t.visibility === 'unexplored').length;

  // Start + gate are not encounter-eligible.
  // Primary match: tile id against the run's startTileId / gateAnchorTileId.
  // Fallback: t.encounter === 'boss' catches the gate tile when gateAnchorTileId
  // is null on a legacy run (prevents the count showing 29 instead of 28).
  const nonEncounterRoles = tiles.filter(
    t =>
      t.id === run?.startTileId ||
      t.id === run?.gateAnchorTileId ||
      t.encounter === 'boss',
  ).length;
  const encounterEligible = Math.max(0, runtimeCount - nonEncounterRoles);

  // ── Status colours ────────────────────────────────────────────────────────
  const countColor = (actual: number, expected: number) =>
    actual === expected ? '#4ade80' : '#f87171';

  // ── Toggle helper ─────────────────────────────────────────────────────────
  const toggle = useCallback((key: keyof HexMapDevOverlay) => {
    onOverlayChange({ ...overlay, [key]: !overlay[key] });
  }, [overlay, onOverlayChange]);

  // ── Collapsed state — show a small "DIAG" pill ────────────────────────────
  if (!open) {
    return (
      <Pressable
        style={ds.pill}
        onPress={() => setOpen(true)}
        testID="diag-pill"
      >
        <Text style={ds.pillText}>DIAG</Text>
      </Pressable>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <View style={ds.panel} testID="diag-panel">
      {/* Header */}
      <View style={ds.header}>
        <Text style={ds.headerTitle}>MAP DIAGNOSTICS</Text>
        <View style={ds.headerButtons}>
          <Pressable style={ds.headerBtn} onPress={refresh} testID="diag-refresh">
            <Text style={ds.headerBtnText}>↺</Text>
          </Pressable>
          <Pressable style={ds.headerBtn} onPress={() => setOpen(false)} testID="diag-close">
            <Text style={ds.headerBtnText}>✕</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={ds.scroll} contentContainerStyle={ds.scrollContent}>

        {/* ── RUN ────────────────────────────────────────────────────────── */}
        <Section title="RUN">
          <Row label="chapterId"    value={chapterId} />
          <Row label="chNum"        value={String(chNum)} />
          <Row label="timeOfDay"    value={timeOfDay ?? '—'} />
          <Row label="run.id"       value={run?.id ?? '—'} mono />
          <Row label="attemptNumber" value={run ? String(run.attemptNumber) : '—'} />
          <Row label="seed"         value={run?.seed ?? '—'} mono />
        </Section>

        {/* ── TERRAIN ────────────────────────────────────────────────────── */}
        {/* Push 1A: labels now use human-readable terminology:
          *   Terrain cells (total) = canonical count incl. start + gate
          *   Encounter eligible    = total minus start and gate (should be 28 for Ch1)
          *   template / runtime / rendered rows kept for debugging            */}
        <Section title="TERRAIN">
          <Row
            label="Terrain cells (canonical)"
            value={`${expectedTerrainCellCount} / ${expectedTerrainCellCount}`}
            valueColor="#e2e8f0"
          />
          <Row
            label="template cell count"
            value={templateTerrainCellCount != null ? String(templateTerrainCellCount) : 'ERR'}
            valueColor={
              templateTerrainCellCount != null
                ? countColor(templateTerrainCellCount, expectedTerrainCellCount)
                : '#f87171'
            }
          />
          <Row
            label="runtime cell count"
            value={String(runtimeCount)}
            valueColor={countColor(runtimeCount, expectedTerrainCellCount)}
          />
          {/* Push 5: "Rendered terrain: 30 / 30"
            * Source: worldMetricsRef.current.renderedTileCount (from inside
            * HexMapLayer's render loop) — falls back to renderedTerrainCellCount
            * prop until first HexMapLayer useLayoutEffect fires.             */}
          <Row
            label="Rendered terrain"
            value={`${renderedInMapWorld} / ${expectedTerrainCellCount}`}
            valueColor={countColor(renderedInMapWorld, expectedTerrainCellCount)}
          />
          <Row
            label="Encounter eligible (excl. start+gate)"
            value={String(encounterEligible)}
            valueColor="#e2e8f0"
          />
          {/* Assertion status */}
          {runtimeCount !== expectedTerrainCellCount && (
            <View style={ds.assertionFail}>
              <Text style={ds.assertionText}>
                ⚠ ASSERTION FAIL: runtime {runtimeCount} ≠ expected {expectedTerrainCellCount}
              </Text>
            </View>
          )}
        </Section>

        {/* ── VISIBILITY ─────────────────────────────────────────────────── */}
        <Section title="VISIBILITY">
          <Row label="visibleNowCount"  value={String(visibleNowCount)} />
          <Row label="exploredCount"    value={String(exploredCount)} />
          <Row label="unexploredCount"  value={String(unexploredCount)} />
          <Row
            label="total (vis check)"
            value={String(visibleNowCount + exploredCount + unexploredCount)}
            valueColor={countColor(
              visibleNowCount + exploredCount + unexploredCount,
              runtimeCount,
            )}
          />
        </Section>

        {/* ── WORLD ──────────────────────────────────────────────────────── */}
        <Section title="WORLD">
          <Row label="worldWidth"     value={metrics ? String(metrics.worldW)   : '—'} />
          <Row label="worldHeight"    value={metrics ? String(metrics.worldH)   : '—'} />
          <Row label="viewportWidth"  value={String(viewportWidth)} />
          <Row label="viewportHeight" value={String(viewportHeight)} />
          <Row label="cameraX"        value={metrics ? String(Math.round(metrics.cameraX)) : '—'} />
          <Row label="cameraY"        value={metrics ? String(Math.round(metrics.cameraY)) : '—'} />
          <Row label="tileSize (sz)"  value={metrics ? String(metrics.tileSize) : '—'} />
          {!metrics && (
            <Text style={ds.dimText}>Tap ↺ after map renders to populate.</Text>
          )}
        </Section>

        {/* ── SPECIAL ────────────────────────────────────────────────────── */}
        <Section title="SPECIAL">
          <Row label="startTileId"  value={run?.startTileId ?? '—'} mono />
          <Row label="gateTileId"   value={run?.gateAnchorTileId ?? '—'} mono />
          <Row label="areaBossCount" value={String(areaBossCount)} />
          <Row
            label="keysCollected"
            value={`${keysCollected} / 3`}
            valueColor={keysCollected >= 3 ? '#4ade80' : '#e2e8f0'}
          />
        </Section>

        {/* ── OVERLAY TOGGLES ────────────────────────────────────────────── */}
        <Section title="OVERLAYS">
          <ToggleRow label="world bounds"      active={!!overlay.worldBounds}      onToggle={() => toggle('worldBounds')} />
          <ToggleRow label="viewport bounds"   active={!!overlay.viewportBounds}   onToggle={() => toggle('viewportBounds')} />
          <ToggleRow label="tile IDs"          active={!!overlay.tileIds}          onToggle={() => toggle('tileIds')} />
          <ToggleRow label="axial q/r"         active={!!overlay.axialCoords}      onToggle={() => toggle('axialCoords')} />
          <ToggleRow label="tile centers"      active={!!overlay.tileCenters}      onToggle={() => toggle('tileCenters')} />
          <ToggleRow label="encounter anchors" active={!!overlay.encounterAnchors} onToggle={() => toggle('encounterAnchors')} />
          <ToggleRow label="visibility state"  active={!!overlay.visibilityState}  onToggle={() => toggle('visibilityState')} />
          <ToggleRow label="fog (all)"          active={!!overlay.fogLayer}         onToggle={() => toggle('fogLayer')} />
          <ToggleRow label="back fog"          active={!!overlay.fogBack}          onToggle={() => toggle('fogBack')} />
          <ToggleRow label="front fog"         active={!!overlay.fogFront}         onToggle={() => toggle('fogFront')} />
          <ToggleRow label="fog mask"          active={!!overlay.fogMask}          onToggle={() => toggle('fogMask')} />
          <ToggleRow label="visibleNow tiles"  active={!!overlay.showVisibleNow}   onToggle={() => toggle('showVisibleNow')} />
          <ToggleRow label="explored tiles"    active={!!overlay.showExplored}     onToggle={() => toggle('showExplored')} />
          <ToggleRow label="unexplored tiles"  active={!!overlay.showUnexplored}   onToggle={() => toggle('showUnexplored')} />
          <ToggleRow label="sprite anchors"    active={!!overlay.spriteAnchors}    onToggle={() => toggle('spriteAnchors')} />
        </Section>

      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={ds.section}>
      <Text style={ds.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({
  label,
  value,
  mono = false,
  valueColor,
}: {
  label:       string;
  value:       string;
  mono?:       boolean;
  valueColor?: string;
}) {
  return (
    <View style={ds.row}>
      <Text style={ds.rowLabel} numberOfLines={1}>{label}</Text>
      <Text
        style={[ds.rowValue, mono && ds.mono, valueColor ? { color: valueColor } : null]}
        numberOfLines={1}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

function ToggleRow({
  label,
  active,
  onToggle,
}: {
  label:    string;
  active:   boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={ds.toggleRow} onPress={onToggle}>
      <View style={[ds.checkbox, active && ds.checkboxActive]}>
        {active && <Text style={ds.checkmark}>✓</Text>}
      </View>
      <Text style={[ds.toggleLabel, active && ds.toggleLabelActive]}>{label}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const BG       = '#0a1220EE';
const BORDER   = '#2a3a50';
const JADE     = '#3DC4A8';
const TEXT     = '#c8d8e8';
const DIM      = '#7a90a8';
const WARN     = '#f87171';
const SECTION_TITLE = '#8ab4cc';

const ds = StyleSheet.create({
  pill: {
    position:        'absolute',
    bottom:          72,
    left:            10,
    paddingHorizontal: 10,
    paddingVertical:   5,
    backgroundColor: BG,
    borderWidth:     1,
    borderColor:     JADE + '88',
    borderRadius:    12,
    zIndex:          19999,
  },
  pillText: {
    color:     JADE,
    fontSize:  10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },

  panel: {
    position:        'absolute',
    bottom:          72,
    left:            6,
    width:           280,
    maxHeight:       460,
    backgroundColor: BG,
    borderWidth:     1,
    borderColor:     BORDER,
    borderRadius:    10,
    zIndex:          19999,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: 4 },
    shadowOpacity:   0.6,
    shadowRadius:    8,
    elevation:       16,
  },

  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 10,
    paddingVertical:   7,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor:   '#0e1a2c',
  },
  headerTitle: {
    color:       JADE,
    fontSize:    10,
    fontWeight:  '700',
    letterSpacing: 1.5,
  },
  headerButtons: {
    flexDirection: 'row',
    gap:           8,
  },
  headerBtn: {
    paddingHorizontal: 6,
    paddingVertical:   2,
  },
  headerBtnText: {
    color:    TEXT,
    fontSize: 14,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },

  section: {
    paddingHorizontal: 10,
    paddingTop:         8,
    paddingBottom:      4,
    borderBottomWidth:  1,
    borderBottomColor:  BORDER,
  },
  sectionTitle: {
    color:         SECTION_TITLE,
    fontSize:      9,
    fontWeight:    '700',
    letterSpacing: 1.8,
    marginBottom:  4,
  },

  row: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'center',
    paddingVertical: 1.5,
    gap:             6,
  },
  rowLabel: {
    color:     DIM,
    fontSize:  10,
    flex:      1,
  },
  rowValue: {
    color:     TEXT,
    fontSize:  10,
    fontWeight: '600',
    maxWidth:  160,
    textAlign:  'right',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize:    9,
  },

  assertionFail: {
    marginTop:       4,
    padding:         6,
    backgroundColor: WARN + '22',
    borderRadius:    4,
    borderWidth:     1,
    borderColor:     WARN + '66',
  },
  assertionText: {
    color:    WARN,
    fontSize: 9,
    fontWeight: '600',
  },

  dimText: {
    color:      DIM,
    fontSize:   9,
    fontStyle:  'italic',
    marginTop:  4,
  },

  toggleRow: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingVertical: 2.5,
    gap:             7,
  },
  checkbox: {
    width:        14,
    height:       14,
    borderWidth:   1,
    borderColor:   BORDER,
    borderRadius:  3,
    alignItems:    'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: JADE + '33',
    borderColor:     JADE,
  },
  checkmark: {
    color:    JADE,
    fontSize:  9,
    lineHeight: 13,
  },
  toggleLabel: {
    color:    DIM,
    fontSize: 10,
  },
  toggleLabelActive: {
    color: TEXT,
  },
});
