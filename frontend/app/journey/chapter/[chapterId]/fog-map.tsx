/**
 * /journey/chapter/:chapterId/fog-map  — PUSH 9
 *
 * Renders the persisted JourneyRun for the current chapter.
 *
 * This screen is the primary in-app chapter map; journey.tsx redirects here
 * unconditionally on load.
 *
 * What is NOT implemented (future pushes):
 *   - Tile movement / path validation
 *   - Stamina consumption on movement
 *   - Encounter resolution (battle / treasure / merchant / area-boss)
 *   - Key fragment collection
 *
 * Visibility contract (enforced here AND in HexMapLayer/HexTile):
 *   hidden   → fog art only; encounter not shown, not named, not in DOM
 *   frontier → dim silhouette; same privacy rules as hidden
 *   revealed → full tile art + encounter icon
 *   current  → special frame art + encounter icon (if any)
 *
 * Gate unlock logic (Push 22):
 *   Gate ALWAYS requires CHAPTER_BOSS_KEY_REQUIREMENT (3) accumulated chapter-level
 *   keys — there is no auto-unlock shortcut for zero-boss maps.
 *   When areaBossCount === 0 an informational note is shown ("No Area Bosses
 *   detected on this attempt.") but the key requirement is unchanged.
 */

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HexMapLayer, hexFacingFromDelta } from '@/src/components/journey/HexMapLayer';
import type { HexMapTile, HexMapWorldMetrics, HexMapDevOverlay, FacingDir } from '@/src/components/journey/HexMapLayer';
import { AUTHORED_MAP_TILE_SZ }            from '@/src/components/journey/hexWorldCoords';
import { JourneyMapDiagnosticsPanel }     from '@/src/components/journey/dev/JourneyMapDiagnosticsPanel';
import { CHAPTERS }                        from '@/src/game/chapterJourney';
import { generateDebugFixture, JOURNEY_MAP_FIXTURE } from '@/src/game/journeyMap/fixture';
import { loadOrCreateJourneyRun, challengeChapter, rechallengeMap } from '@/src/game/journeyMap/journeyRunLifecycle';
import { resolveRunShift, isCanonicalChoiceChapter } from '@/src/game/journeyMap/chapterShiftRules';
import type { TimeOfDay } from '@/src/game/journeyMap/types';
import {
  checkRechallengeEligibility,
  claimAreaBossKey,
  createChapterBossKeyState,
  RECHALLENGE_MAP_LABEL,
  CHAPTER_BOSS_KEY_REQUIREMENT,
} from '@/src/game/journeyMap/chapterBossKeys';
import { journeyRunRepository }            from '@/src/game/journeyMap/journeyRunRepository';
import { validateMove, applyMoveToRun, MOVE_STAMINA_COST } from '@/src/game/journeyMap/movement';
import { calculateVisibleTileIds }         from '@/src/game/journeyMap/fogCalculator';
import {
  resolveVisionBonuses,
  computeEffectiveVisionRadius,
} from '@/src/game/journeyMap/visionConfig';
import {
  resolveNone, resolveBattleWin, resolveAreaBossWin,
  resolveTreasureClaim, resolveMerchantVisit, resolveChapterBossWin,
  deriveEnemyId, getAreaBossEnemyId, getChapterBossEnemyId,
  TREASURE_REWARDS,
  type TreasureReward,
} from '@/src/game/journeyMap/encounterResolution';
import { claimChapterBossKeyOnServer } from '@/src/game/journeyMap/journeyRunRepository';
import {
  enqueuePendingBossKeyClaim,
  getPendingBossKeyClaims,
  removePendingBossKeyClaims,
} from '@/src/game/journeyMap/pendingBossKeyClaims';
import type { JourneyRun, JourneyTile } from '@/src/game/journeyMap/types';
import { TreasureModal }                  from '@/src/components/journey/TreasureModal';
import { MerchantModal }                  from '@/src/components/journey/MerchantModal';
// dynRoute is only used in result.tsx for the return-to-fog-map routing.
import { ENCOUNTER_COST, useLiveStamina } from '@/src/game/stamina';
import { usePlayer }                       from '@/src/game/store';
import { playerLevelFromXp }               from '@/src/game/progression';
import { buildChapterUiSummary }           from '@/src/features/journey/ui/journeyVisibility';
import { ChapterCompletion }               from '@/src/features/journey/ui/ChapterCompletion';
import { SERIF, UI }                       from '@/src/theme/ui';
import { getExplorationAvatar }             from '@/src/game/explorationAvatar';
import { MAP_SPRITE }                        from '@/src/game/illustratedAssets';
import { getChapterMapVisuals, DEV_FALLBACK_VISUALS } from '@/src/game/journeyMap/chapterMapVisuals';
import { getChapterTerrainCellCount, BLUEPRINT_PIPELINE_CHAPTERS } from '@/src/game/journeyMap/config';
import { getChapterMapTemplate }                      from '@/src/game/journeyMap/chapterMapTemplates';
import {
  compareRunGeometryToCanonicalArtifact,
  getCanonicalChapterMapArtifact,
}                                                     from '@/src/game/journeyMap/canonicalMapArtifact';
import { getBackgroundAuthoringManifests }           from '@/src/game/journeyMap/backgroundAuthoringManifest';
import { isBlockingSceneryZone }                      from '@/src/game/journeyMap/sceneryClassification';
import { computeHexWorldCoords }                      from '@/src/components/journey/hexWorldCoords';
import { computeSceneryProps }                        from '@/src/game/journeyMap/sceneryPropPlacer';
import { SceneryPropLayerView }                       from '@/src/components/journey/SceneryPropLayerView';

// ── Journey raster assets ────────────────────────────────────────────────────
// Map backgrounds and terrain tiles are now resolved through getChapterMapVisuals()
// (chapterMapVisuals.ts) so callers never hard-code asset paths.  The three
// mapBg* references have been removed from this object; use chapterVisuals.background.
const ASSET = {
  keyFragment:    require('@/assets/ui/journey/gate/key-fragment.webp')               as number,
  gateLocked:     require('@/assets/ui/journey/gate/chapter-boss-gate-locked.webp')   as number,
  gateUnlocked:   require('@/assets/ui/journey/gate/chapter-boss-gate-unlocked.webp') as number,
  legendBattle:   require('@/assets/ui/journey/legend/battle.webp')                   as number,
  legendTreasure: require('@/assets/ui/journey/legend/treasure.webp')                 as number,
  legendMerchant: require('@/assets/ui/journey/legend/merchant.webp')                 as number,
  legendBoss:     require('@/assets/ui/journey/legend/area-boss.webp')                as number,
  // Chapter summary artwork
  chapterArt:     require('@/assets/ui/journey/chapter/chapter-art-placeholder.webp') as number,
  rewardFrame:    require('@/assets/ui/journey/chapter/chapter-reward-frame.webp')    as number,
};

const STAMINA_EMBLEM = require('@/assets/ui-icons/hub/stamina-emblem.png') as number;

const TAB_ICONS = {
  journey: require('@/assets/ui-icons/tab-journey-3d.png')  as number,
  heroes:  require('@/assets/ui-icons/tab-heroes-3d.png')   as number,
  home:    require('@/assets/ui-icons/tab-hub-3d.png')       as number,
  bag:     require('@/assets/ui-icons/tab-inventory-3d.png') as number,
  shop:    require('@/assets/ui-icons/tab-shop-3d.png')      as number,
};

// ── Static data ───────────────────────────────────────────────────────────────

const LEGEND_ITEMS = [
  { key: 'battle',   src: ASSET.legendBattle,   label: 'Battle',    desc: 'Defeat a clinical enemy to progress.' },
  { key: 'treasure', src: ASSET.legendTreasure,  label: 'Treasure',  desc: 'Loot a chest and claim a reward.'     },
  { key: 'merchant', src: ASSET.legendMerchant,  label: 'Merchant',  desc: 'Trade with a traveling apothecary.'   },
  { key: 'boss',     src: ASSET.legendBoss,       label: 'Area Boss', desc: 'Elite enemy — defeat to earn a key.' },
] as const;

const TABS = [
  { key: 'journey', label: 'JOURNEY', icon: TAB_ICONS.journey, active: true,  route: '/(tabs)/journey' as const },
  { key: 'heroes',  label: 'HEROES',  icon: TAB_ICONS.heroes,  active: false, route: '/(tabs)/heroes'  as const },
  { key: 'home',    label: 'HOME',    icon: TAB_ICONS.home,    active: false, route: '/(tabs)'         as const },
  { key: 'bag',     label: 'BAG',     icon: TAB_ICONS.bag,     active: false, route: '/item-bag'       as const },
  { key: 'shop',    label: 'SHOP',    icon: TAB_ICONS.shop,    active: false, route: '/(tabs)/shop'    as const },
] as const;

// ── Derived helpers ───────────────────────────────────────────────────────────

/**
 * Convert a JourneyTile (game layer) → HexMapTile (render layer).
 * The gate anchor tile is flagged `isGate: true` so the renderer can give it
 * an appropriate accessibility label.
 */
function toHexMapTile(t: JourneyTile, gateId: string | undefined): HexMapTile {
  return {
    id:           t.id,
    q:            t.q,
    r:            t.r,
    visibility:   t.visibility,
    current:      t.current,
    encounter:    t.encounter,
    chestTier:    t.chestTier,
    isGate:       t.id === gateId,
    // Cosmetic only — no gameplay effect. Only present on 'none' tiles.
    visualVariant: t.visualVariant,
    // Push 5: blueprint zone — forwarded to HexMapLayer for MAP BLUEPRINT overlay.
    zoneType:     t.zoneType,
  };
}

/** Encounter counts across ALL tiles (including gate and unrevealed). */
function countEncounters(tiles: JourneyTile[]) {
  const counts = { battle: 0, treasure: 0, merchant: 0, areaBoss: 0, none: 0 };
  const tiers  = { bronze: 0, silver: 0, gold: 0 };
  for (const t of tiles) {
    if (t.encounter in counts) counts[t.encounter as keyof typeof counts]++;
    if (t.chestTier) tiers[t.chestTier]++;
  }
  return { counts, tiers };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function BottomNav({ bottomPad }: { bottomPad: number }) {
  const router = useRouter();
  return (
    <View style={[sNav.bar, { paddingBottom: bottomPad, height: 68 + bottomPad }]}>
      {TABS.map((tab) => {
        const color   = tab.active ? '#E8C050' : '#8A95A8';
        const offsets = [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]] as const;
        return (
          <Pressable
            key={tab.key}
            style={sNav.item}
            onPress={() => !tab.active && router.push(tab.route)}
          >
            <Image source={tab.icon} style={[sNav.icon, { opacity: tab.active ? 1 : 0.38 }]} contentFit="contain" />
            <View style={{ position: 'relative' }}>
              {offsets.map(([x, y], i) => (
                <Text key={i} style={[sNav.label, { position: 'absolute', color: '#000000BB', transform: [{ translateX: x }, { translateY: y }] }]} numberOfLines={1}>
                  {tab.label}
                </Text>
              ))}
              <Text style={[sNav.label, { color }]} numberOfLines={1}>{tab.label}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[s.panel, style]}>{children}</View>;
}

function LegendRow({ src, label, desc }: { src: number; label: string; desc: string }) {
  return (
    <View style={s.legendRow}>
      <Image source={src} style={s.legendIcon} contentFit="contain" />
      <View style={s.legendText}>
        <Text style={s.legendLabel}>{label}</Text>
        <Text style={s.legendDesc}>{desc}</Text>
      </View>
    </View>
  );
}

/**
 * Push 4A.1 — Camera diagnostics overlay (expanded).
 *
 * Renders OUTSIDE MapWorld so it stays fixed while the camera pans.
 * All fields derived from the HexMapWorldMetrics emitted by HexMapLayer's
 * Effect 2 after every player-tile change.
 *
 * Acceptance criteria (PASS only if):
 *   Travel X > 0 OR Travel Y > 0   → status = FOLLOW READY
 *   [JourneyCameraMove] log shows  → CAMERA TARGET CHANGED on tile move
 */
function CameraDiagnosticsPanel({
  viewport,
  metrics,
}: {
  viewport: { w: number; h: number };
  metrics:  HexMapWorldMetrics | null;
}): React.ReactElement | null {
  if (!__DEV__) return null;

  const r   = (n: number) => Math.round(n);
  const fmt = (n: number) => r(n).toString();

  // Travel = how far the camera can actually move (may be 0 if world ≤ viewport).
  const travelX = metrics ? metrics.worldW - metrics.viewportW : 0;
  const travelY = metrics ? metrics.worldH - metrics.viewportH : 0;
  const hasTravel = travelX > 0 || travelY > 0;

  // Camera bounds: pan is clamped to [viewportW − worldW, 0] on X,
  // and [viewportH − worldH, 0] on Y.
  const boundsMinX = metrics ? r(metrics.viewportW - metrics.worldW) : 0;
  const boundsMinY = metrics ? r(metrics.viewportH - metrics.worldH) : 0;

  // AUTHORED WORLD FAIL: worldTileSize was requested but world is still viewport-fit.
  const authoredFail =
    metrics !== null &&
    metrics.worldTileSize !== undefined &&
    !hasTravel;

  return (
    <View style={sCamDiag.panel} pointerEvents="none">
      <Text style={sCamDiag.header}>CAMERA</Text>

      {/* Hard-fail banner: authored mode requested but world didn't expand. */}
      {authoredFail && (
        <View style={sCamDiag.failBanner}>
          <Text style={sCamDiag.failText}>
            {'⚠️ AUTHORED WORLD FAIL\nMapWorld is still viewport-fit.'}
          </Text>
        </View>
      )}

      <View style={sCamDiag.divider} />

      {/* ── Map dimensions ── */}
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Viewport    '}</Text>
        <Text style={sCamDiag.val}>{`${viewport.w} × ${viewport.h}`}</Text>
      </Text>
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'MapWorld    '}</Text>
        <Text style={[sCamDiag.val, hasTravel ? sCamDiag.good : sCamDiag.warn]}>
          {metrics ? `${r(metrics.worldW)} × ${r(metrics.worldH)}` : '—'}
        </Text>
      </Text>
      {/* Push 4A.8: background + fog canvas sizes must equal MapWorld, never viewport. */}
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Background  '}</Text>
        <Text style={sCamDiag.val}>
          {metrics ? `${r(metrics.backgroundW)} × ${r(metrics.backgroundH)}` : '—'}
        </Text>
      </Text>
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'FogOfWar    '}</Text>
        <Text style={sCamDiag.val}>
          {metrics ? `${r(metrics.fogCanvasW)} × ${r(metrics.fogCanvasH)}` : '—'}
        </Text>
      </Text>
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Tile size   '}</Text>
        <Text style={sCamDiag.val}>{metrics ? `${metrics.tileSize} px` : '—'}</Text>
      </Text>
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'WorldTileSz '}</Text>
        <Text style={sCamDiag.val}>
          {metrics?.worldTileSize != null ? `${metrics.worldTileSize} px` : '— (viewport-fit)'}
        </Text>
      </Text>

      <View style={sCamDiag.divider} />

      {/* ── Player position ── */}
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Current tile'}</Text>
        <Text style={sCamDiag.val}>{metrics?.currentTileId ?? '—'}</Text>
      </Text>
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Player world'}</Text>
        <Text style={sCamDiag.val}>
          {metrics ? `${fmt(metrics.playerWorldX)}, ${fmt(metrics.playerWorldY)}` : '—'}
        </Text>
      </Text>

      <View style={sCamDiag.divider} />

      {/* ── Camera positions ── */}
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Desired cam '}</Text>
        <Text style={sCamDiag.val}>
          {metrics ? `${fmt(metrics.desiredCamX)}, ${fmt(metrics.desiredCamY)}` : '—'}
        </Text>
      </Text>
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Target cam  '}</Text>
        <Text style={sCamDiag.val}>
          {metrics ? `${fmt(metrics.cameraX)}, ${fmt(metrics.cameraY)}` : '—'}
        </Text>
      </Text>

      <View style={sCamDiag.divider} />

      {/* ── Clamp bounds ── */}
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Bounds X    '}</Text>
        <Text style={sCamDiag.val}>{metrics ? `${boundsMinX} → 0` : '—'}</Text>
      </Text>
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Bounds Y    '}</Text>
        <Text style={sCamDiag.val}>{metrics ? `${boundsMinY} → 0` : '—'}</Text>
      </Text>

      <View style={sCamDiag.divider} />

      {/* ── Travel (world − viewport) ── */}
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Travel X    '}</Text>
        <Text style={[sCamDiag.val, travelX > 0 ? sCamDiag.good : sCamDiag.warn]}>
          {metrics ? `${r(travelX)} px` : '—'}
        </Text>
      </Text>
      <Text style={sCamDiag.row}>
        <Text style={sCamDiag.label}>{'Travel Y    '}</Text>
        <Text style={[sCamDiag.val, travelY > 0 ? sCamDiag.good : sCamDiag.warn]}>
          {metrics ? `${r(travelY)} px` : '—'}
        </Text>
      </Text>

      <View style={sCamDiag.divider} />

      {/* ── Status ── */}
      <Text style={hasTravel ? sCamDiag.statusGood : sCamDiag.statusBad}>
        {hasTravel ? '✓ FOLLOW READY' : '✗ NO CAMERA TRAVEL'}
      </Text>
    </View>
  );
}

/** Dev diagnostics panel — always visible on this dev route. */
function DevDiagnostics({
  run,
  chapterKeysCollected,
  chapterNum,
  blueprintBackgroundMissing,
  stage3AssetPath,
  stage3CandidateAssetPath,
  stage3ManifestAssetPath,
  stage3RegistryKey,
  stage3RegistryMatch,
  stage3Status,
  stage3Reason,
}: {
  run: JourneyRun;
  chapterKeysCollected: number;
  chapterNum: number;
  /**
   * Push 5A: true when the chapter is blueprint-backed but no matched raster
   * has been registered for the current blueprintHash.  The legacy courtyard
   * is showing as a fallback.  DevDiagnostics must surface this visibly.
   */
  blueprintBackgroundMissing?: boolean;
  /** Exact runtime Stage 3 raster path selected by the visual registry. */
  stage3AssetPath?: string;
  stage3CandidateAssetPath?: string;
  /** Raster path declared by the current ChapterBackgroundAuthoringManifest. */
  stage3ManifestAssetPath?: string;
  /** Exact chapter:shift:blueprintHash key checked by the visual registry. */
  stage3RegistryKey?: string;
  /** True only when that exact registry entry points to the manifest raster. */
  stage3RegistryMatch?: boolean;
  stage3Status?: 'APPROVED' | 'MISSING' | 'MISMATCHED';
  stage3Reason?: string;
}) {
  const { counts, tiers } = useMemo(() => countEncounters(run.tiles), [run.tiles]);
  const exploredPct = run.tileCount > 0
    ? Math.round((run.exploredTileCount / run.tileCount) * 100) : 0;

  // Blueprint pipeline diagnostics (Ch1 and any future pipeline canaries).
  const pipelineArtifact = useMemo(() => {
    if (!BLUEPRINT_PIPELINE_CHAPTERS.has(chapterNum)) return null;
    try { return getCanonicalChapterMapArtifact(chapterNum); } catch { return null; }
  }, [chapterNum]);

  // Background authoring manifests — one per shift.
  const bgManifests = useMemo(() => {
    if (!BLUEPRINT_PIPELINE_CHAPTERS.has(chapterNum)) return null;
    try { return getBackgroundAuthoringManifests(chapterNum); } catch { return null; }
  }, [chapterNum]);

  // Zone counts read from the run tiles (populated at run-creation time).
  const zoneCounts = useMemo(() => {
    if (!pipelineArtifact) return null;
    let lane = 0, clearing = 0, transition = 0, unlabelled = 0;
    for (const tile of run.tiles) {
      if (tile.zoneType === 'lane')       lane++;
      else if (tile.zoneType === 'clearing')   clearing++;
      else if (tile.zoneType === 'transition') transition++;
      else                               unlabelled++;
    }
    return { lane, clearing, transition, unlabelled };
  }, [pipelineArtifact, run.tiles]);

  // ── Three-stage pipeline derived values (computed before return, no hooks) ──
  // Stage 2 requires both the immutable artifact proof and the exact persisted
  // coordinate footprint / anchors. A claimed hash alone cannot approve a
  // partially migrated or corrupted run.
  const runGeometry = useMemo(() => {
    if (!pipelineArtifact) return null;
    return compareRunGeometryToCanonicalArtifact(run, pipelineArtifact);
  }, [pipelineArtifact, run]);
  const stage2IdentityMatch = pipelineArtifact == null || (
    run.mapBlueprintHash === pipelineArtifact.blueprintHash &&
    run.mapLayoutVersion === pipelineArtifact.mapLayoutVersion
  );
  const stage2Pass = (pipelineArtifact?.stage2Validation.pass ?? true) &&
    stage2IdentityMatch &&
    (runGeometry?.matches ?? true);

  // Stage 3: is a registered finished-background raster aligned to this hash?
  const stage3AllGood = stage3Status === 'APPROVED'
    && !blueprintBackgroundMissing
    && stage3RegistryMatch === true;
  const stage3AnyBad  = bgManifests != null
    && bgManifests.some(m =>
        m.assetStatus === 'invalid_overlap' || m.assetStatus === 'failed');
  const stage3Color = bgManifests == null ? '#94a3b8'
    : stage3AllGood ? '#4ade80'
      : stage3Status === 'MISMATCHED' || stage3AnyBad ? '#f87171'
      : '#facc15';
  const stage3Label = bgManifests == null
    ? '— NOT LOADED'
    : stage3AllGood
    ? '✓ ALIGNED'
    : stage3Status === 'MISMATCHED' || stage3AnyBad
    ? '✗ MISMATCHED — BLUEPRINT FOUNDATION SHOWN'
    : stage3Status === 'MISSING' || blueprintBackgroundMissing
    ? '⚠ MISSING — BLUEPRINT FOUNDATION SHOWN'
    : '⚠ PENDING — NO FINISHED ART YET';

  return (
    <View style={sDev.panel}>
      <Text style={sDev.heading}>🛠 DEV DIAGNOSTICS</Text>

      <Text style={sDev.row}>
        <Text style={sDev.key}>Run   </Text>
        <Text style={sDev.val}>#{run.attemptNumber} · ch{run.chapterId} · {run.status.toUpperCase()}</Text>
      </Text>
      <Text style={sDev.row}>
        <Text style={sDev.key}>ID    </Text>
        <Text style={sDev.val}>{run.id.slice(0, 18)}…</Text>
      </Text>
      <Text style={sDev.row}>
        <Text style={sDev.key}>Seed  </Text>
        <Text style={sDev.val}>{run.seed.slice(0, 16)}… ({run.seed.length} chars)</Text>
      </Text>
      <Text style={sDev.row}>
        <Text style={sDev.key}>Tiles </Text>
        <Text style={sDev.val}>{run.tileCount} playable · {run.exploredTileCount} explored · {exploredPct}%</Text>
      </Text>

      <View style={sDev.divider} />

      <Text style={sDev.subhead}>Encounters (total)</Text>
      <Text style={sDev.row}>
        <Text style={sDev.val}>
          {counts.battle} battle · {counts.merchant} merchant · {counts.areaBoss} area-boss{'\n'}
          {counts.treasure} treasure ({tiers.bronze}✦ {tiers.silver}✦✦ {tiers.gold}✦✦✦) · {counts.none} empty
        </Text>
      </Text>

      <View style={sDev.divider} />

      <Text style={sDev.row}>
        <Text style={sDev.key}>Gate  </Text>
        <Text style={sDev.val}>{run.gateAnchorTileId ?? '—'} · {run.areaBossKeysCollected}/{run.areaBossCount} keys (run)</Text>
      </Text>
      <Text style={sDev.row}>
        <Text style={sDev.key}>Keys  </Text>
        <Text style={sDev.val}>{chapterKeysCollected}/{CHAPTER_BOSS_KEY_REQUIREMENT} chapter-level · {run.areaBossKeysCollected}/{run.areaBossCount} run-level</Text>
      </Text>
      <Text style={sDev.row}>
        <Text style={sDev.key}>Start </Text>
        <Text style={sDev.val}>{run.startTileId} → current: {run.currentTileId}</Text>
      </Text>
      <Text style={sDev.row}>
        <Text style={sDev.key}>Created</Text>
        <Text style={sDev.val}>{run.createdAt.slice(0, 19).replace('T', ' ')}</Text>
      </Text>

      {/* ── Three-stage blueprint pipeline diagnostics ──────────────────────── */}
      {pipelineArtifact != null && (
        <>
          <View style={sDev.divider} />
          <Text style={sDev.subhead}>
            {'🗺 MAP PIPELINE — Ch'}
            {chapterNum}
            {' · '}
            {pipelineArtifact.dna.topologyFamily.replace(/_/g, ' ')}
          </Text>

          {/* ── STAGE 1: STRUCTURE BLUEPRINT ──────────────────────────────── */}
          <View style={sDev.divider} />
          <Text style={sDev.subhead}>STAGE 1 — STRUCTURE BLUEPRINT</Text>
          <Text style={[sDev.val, { color: '#4ade80', fontWeight: '700' }]}>
            {'✓ GEOMETRY LOCKED'}
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Source    </Text>
            <Text style={sDev.val}>
              {pipelineArtifact.stage1Blueprint.status} · {pipelineArtifact.stage1Blueprint.artifactPath}
            </Text>
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Blueprint </Text>
            <Text style={sDev.val}>{pipelineArtifact.blueprintHash} · {pipelineArtifact.mapLayoutVersion}</Text>
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Structure </Text>
            <Text style={sDev.val}>{pipelineArtifact.stage1Blueprint.structureHash} · walkable + obstacle zones</Text>
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Cells     </Text>
            <Text style={sDev.val}>
              {pipelineArtifact.tileCount} total — 1 start + {pipelineArtifact.tileCount - 2} encounter + 1 gate
            </Text>
          </Text>
          <Text style={[sDev.row, { color: '#facc15' }]}>
            {'References  '}
            {pipelineArtifact.stage1Blueprint.authoringReferences.length === 0
              ? 'No Pack A/B slot applies.'
              : `${pipelineArtifact.stage1Blueprint.authoringReferences.length} PENDING_UPLOAD slot(s) — non-rendering`}
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Regions   </Text>
            <Text style={sDev.val}>
              {pipelineArtifact.clearingCount} clearings · {pipelineArtifact.loopCount} loops
            </Text>
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Obstacles </Text>
            <Text style={[sDev.val, {
              color: pipelineArtifact.scenerySafetyPass ? '#4ade80' : '#f87171',
            }]}>
              {pipelineArtifact.scenerySafetyPass
                ? '✓ ALL ZONES OUTSIDE WALKABLE BED'
                : '✗ BLOCKING ZONES OVERLAP WALKABLE TILES'}
            </Text>
          </Text>

          {/* ── STAGE 2: WALKABLE HEX PATH VALIDATED ─────────────────────── */}
          <View style={sDev.divider} />
          <Text style={sDev.subhead}>STAGE 2 — WALKABLE HEX PATH</Text>
          <Text style={[sDev.val, {
            color: stage2Pass ? '#4ade80' : '#f87171',
            fontWeight: '700',
          }]}>
            {stage2Pass ? '✓ VALIDATED' : '✗ VALIDATION FAILED'}
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Evidence  </Text>
            <Text style={sDev.val}>{pipelineArtifact.stage2Validation.validationArtifactPath}</Text>
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Playable  </Text>
            <Text style={sDev.val}>
              {pipelineArtifact.stage2Validation.actualTileCount}/{pipelineArtifact.stage2Validation.expectedTileCount}
              {' locked footprint tiles'}
            </Text>
          </Text>
          {zoneCounts != null && (
            <Text style={sDev.row}>
              <Text style={sDev.key}>Zones     </Text>
              <Text style={sDev.val}>
                {zoneCounts.lane} lane · {zoneCounts.clearing} clearing · {zoneCounts.transition} transition
              </Text>
            </Text>
          )}
          <Text style={sDev.row}>
            <Text style={sDev.key}>Connected </Text>
            <Text style={[sDev.val, { color: stage2Pass ? '#4ade80' : '#f87171' }]}>
              {pipelineArtifact.stage2Validation.startToGateConnected &&
                pipelineArtifact.stage2Validation.requiredRegionsConnected
                ? '✓' : '✗'}
              {' start='}
              {pipelineArtifact.asTopology.startTileId}
              {'  gate='}
              {pipelineArtifact.asTopology.gateAnchorId}
              {'  · '}
              {pipelineArtifact.stage2Validation.connectedTileCount}/
              {pipelineArtifact.stage2Validation.actualTileCount} reachable
            </Text>
          </Text>
          {runGeometry != null && (
            <Text style={sDev.row}>
              <Text style={sDev.key}>Run bed   </Text>
              <Text style={[sDev.val, { color: runGeometry.matches ? '#4ade80' : '#f87171' }]}>
                {runGeometry.matches
                  ? '✓ EXACT COORDINATES + ANCHORS'
                  : '✗ STALE / CORRUPTED COORDINATES'}
              </Text>
            </Text>
          )}
          <Text style={sDev.row}>
            <Text style={sDev.key}>Obstacle  </Text>
            <Text style={[sDev.val, {
              color: pipelineArtifact.stage2Validation.obstacleIntersectionPass ? '#4ade80' : '#f87171',
            }]}>
              {pipelineArtifact.stage2Validation.obstacleIntersectionPass
                ? '✓ NO HEX-OBSTACLE INTERSECTIONS'
                : '✗ INTERSECTIONS DETECTED'}
            </Text>
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Void      </Text>
            <Text style={[sDev.val, {
              color: pipelineArtifact.stage2Validation.voidIntersectionPass ? '#4ade80' : '#f87171',
            }]}>
              {pipelineArtifact.stage2Validation.voidIntersectionPass
                ? '✓ NO VOID / MISSING-FOOTPRINT INTERSECTIONS'
                : `✗ ${pipelineArtifact.stage2Validation.voidIntersectionCellKeys.length} INVALID FOOTPRINT CELL(S)`}
            </Text>
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Geo hash  </Text>
            <Text style={[sDev.val, { color: stage2IdentityMatch ? '#A5D6A7' : '#f87171' }]}>
              {'run: '}
              {run.mapBlueprintHash === '' ? '(legacy pre-blueprint)' : run.mapBlueprintHash}
              {'\nart: '}
              {pipelineArtifact.blueprintHash}
            </Text>
          </Text>
          {runGeometry != null && !runGeometry.matches && (
            <View style={sDev.mismatchBanner}>
              <Text style={sDev.mismatchText}>
                {'⚠ RUN FOOTPRINT / PIPELINE MISMATCH\n'}
                {'missing: '}{runGeometry.missingTileIds.length
                  ? runGeometry.missingTileIds.join(', ')
                  : '(none)'}{'\n'}
                {'extra:   '}{runGeometry.extraTileIds.length
                  ? runGeometry.extraTileIds.join(', ')
                  : '(none)'}{'\n'}
                {!runGeometry.startMatches
                  ? `start: ${run.startTileId} → ${runGeometry.expectedStartTileId}\n`
                  : ''}
                {!runGeometry.gateMatches
                  ? `gate: ${run.gateAnchorTileId ?? '—'} → ${runGeometry.expectedGateAnchorTileId}\n`
                  : ''}
                {'→ Run will be abandoned and recovered on next load.'}
              </Text>
            </View>
          )}
          {!stage2IdentityMatch && run.mapBlueprintHash !== '' && (
            <View style={sDev.mismatchBanner}>
              <Text style={sDev.mismatchText}>
                {'⚠ RUN / PIPELINE MISMATCH\n'}
                {'run:  '}{run.mapBlueprintHash.slice(0, 10)}{'…\n'}
                {'art:  '}{pipelineArtifact.blueprintHash.slice(0, 10)}{'…\n'}
                {'→ Run will be abandoned on next load.'}
              </Text>
            </View>
          )}

          {/* ── STAGE 3: FINISHED BACKGROUND ALIGNED ─────────────────────── */}
          <View style={sDev.divider} />
          <Text style={sDev.subhead}>STAGE 3 — FINISHED BACKGROUND</Text>
          <Text style={[sDev.val, { color: stage3Color, fontWeight: '700' }]}>
            {stage3Label}
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Selected  </Text>
            <Text style={[sDev.val, {
              color: stage3AssetPath != null ? '#A5D6A7'
                : stage3Status === 'MISMATCHED' ? '#f87171' : '#facc15',
            }]}>
              {stage3AssetPath ?? '(none — environment reveal suppressed)'}
            </Text>
          </Text>
          {stage3CandidateAssetPath != null && (
            <Text style={sDev.row}>
              <Text style={sDev.key}>Rejected  </Text>
              <Text style={[sDev.val, { color: '#f87171' }]}>{stage3CandidateAssetPath}</Text>
            </Text>
          )}
          <Text style={sDev.row}>
            <Text style={sDev.key}>Manifest  </Text>
            <Text style={sDev.val}>
              {stage3ManifestAssetPath ?? '(manifest unavailable)'}
            </Text>
          </Text>
          <Text style={sDev.row}>
            <Text style={sDev.key}>Registry  </Text>
            <Text style={[sDev.val, {
              color: stage3RegistryMatch === true ? '#4ade80'
                : stage3RegistryMatch === false ? '#f87171' : '#94a3b8',
            }]}>
              {stage3RegistryKey ?? '(no exact hash key checked)'}
              {'\n'}
              {stage3RegistryMatch === true
                ? '✓ exact entry matches manifest'
                : stage3RegistryMatch === false
                ? `✗ ${stage3Status ?? 'NOT APPROVED'} — no render`
                : '— not evaluated'}
            </Text>
          </Text>
          {stage3Reason != null && (
            <Text style={sDev.row}>
              <Text style={sDev.key}>Why       </Text>
              <Text style={sDev.val}>{stage3Reason}</Text>
            </Text>
          )}
          {bgManifests != null && (
            <>
              {bgManifests[0] != null && (
                <Text style={[sDev.row, {
                  color: bgManifests[0].validationResult.pass ? '#4ade80' : '#f87171',
                }]}>
                  {bgManifests[0].validationResult.pass
                    ? '✓ GEOMETRY VALID — no obstacle overlaps in art spec'
                    : `✗ GEOMETRY INVALID — ${bgManifests[0].validationResult.violations.length} overlap(s) in art spec`}
                </Text>
              )}
              {bgManifests.map(m => {
                const good  = m.assetStatus === 'validated';
                const bad   = m.assetStatus === 'invalid_overlap' || m.assetStatus === 'failed';
                const color = good ? '#4ade80' : bad ? '#f87171' : '#facc15';
                return (
                  <Text key={m.shift} style={[sDev.row, { color }]}>
                    {good ? '✓' : bad ? '✗' : '⚠'}
                    {' '}
                    {m.shift}: {m.assetStatus.toUpperCase()}
                    {!good && blueprintBackgroundMissing ? ' · HASH NOT REGISTERED' : ''}
                  </Text>
                );
              })}
              {blueprintBackgroundMissing && (
                <View style={sDev.mismatchBanner}>
                  <Text style={sDev.mismatchText}>
                    {'⚠ STAGE 3 NOT APPROVED FOR HASH\n'}
                    {'Ch '}{chapterNum}{'  hash: '}{pipelineArtifact.blueprintHash}{'\n'}
                    {'Display: BLUEPRINT FOUNDATION ONLY\n'}
                    {'Fix: generate art from bgManifest.aiPrompt,\n'}
                    {'     register in BLUEPRINT_RASTER_REGISTRY'}
                  </Text>
                </View>
              )}
            </>
          )}
          {bgManifests == null && (
            <Text style={[sDev.val, { color: '#facc15' }]}>
              {'⚠ MANIFEST UNAVAILABLE'}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ChapterFogMapShell() {
  const {
    chapterId,
    debug,
    // Battle-return params: set when the player returns from a battle that was
    // launched from this fog-map.  Applied exactly once after the run loads.
    resolvedTileId,
    outcome:          battleOutcome,
    journeyIsAreaBoss,
    journeyIsChapterBoss,
    shift:            requestedShiftParam,
  } = useLocalSearchParams<{
    chapterId:            string;
    debug?:               string;
    resolvedTileId?:      string;
    outcome?:             string;
    journeyIsAreaBoss?:   string;
    journeyIsChapterBoss?: string;
    /** Player-chosen shift for choice chapters (Ch4/7/9/10); validated below. */
    shift?:               string;
  }>();
  const router               = useRouter();
  const insets               = useSafeAreaInsets();
  const { player, spendStamina, applyRewards, updateState, applyFogMapChapterBossRewards, reconcileChapterBossKeys, setCanonicalShift } = usePlayer();

  // Always-fresh refs for shift resolution — updated every render so the
  // run-load effect and challenge callback never close over stale
  // canonical-shift or route-param values (review-flagged stale-closure risk).
  const canonicalShiftsRef = useRef(player?.canonical_shifts);
  canonicalShiftsRef.current = player?.canonical_shifts;
  const requestedShiftRef = useRef<TimeOfDay | undefined>(undefined);
  requestedShiftRef.current =
    requestedShiftParam === 'day' || requestedShiftParam === 'evening' || requestedShiftParam === 'night'
      ? requestedShiftParam
      : undefined;

  const { height: windowHeight } = useWindowDimensions();
  // The map now takes flex:1 (fills all space between chrome and nav).
  // This height is used only to cap the SECONDARY info scroll below the map
  // so the map always dominates the screen.
  const secondaryScrollMaxH = Math.min(220, Math.max(100, Math.round(windowHeight * 0.24)));

  const bottomPad = Math.max(insets.bottom, 8);
  // Initial guess — replaced on first layout event from mapOuter.
  const [mapSize, setMapSize] = useState({ w: 332, h: 480 });

  // ── Legend visibility (collapsed by default) ──────────────────────────────
  // Toggled by the ⓘ button in the header.
  const [legendOpen, setLegendOpen] = useState(false);

  // ── Chapter metadata ───────────────────────────────────────────────────────
  const chapter = CHAPTERS.find(
    (c) => c.id === chapterId || String(c.number) === chapterId,
  );
  const chNum = chapter?.number ?? 1;
  const title = chapter?.theme  ?? `Chapter ${chapterId}`;
  const phase = chapter?.simulationEra
    ? 'SIMULATION ERA'
    : chapter?.realWorldTransition
    ? 'REAL WARD'
    : 'CHAPTER MAP';

  // ── Chapter completion summary (for the badge) ────────────────────────────
  const chapterSummary = useMemo(() => {
    if (!chapter || !player) return null;
    const lvl = playerLevelFromXp(player.xp ?? 0).level;
    const claimed = player.claimed_journey_nodes ?? [];
    return buildChapterUiSummary(chapter, lvl, claimed);
  }, [chapter, player]);

  // ── Debug fixture (?debug=N) — bypasses run loading ───────────────────────
  const debugTiles = useMemo<readonly HexMapTile[] | null>(() => {
    const n = debug ? parseInt(debug, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? generateDebugFixture(n) : null;
  }, [debug]);

  // ── Journey run state ──────────────────────────────────────────────────────
  const [run,        setRun]        = useState<JourneyRun | null>(null);
  /** Incrementing this triggers a fresh load attempt (used by the Retry button). */
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [runLoading, setRunLoading] = useState(true);
  const [runError,   setRunError]   = useState<string | null>(null);

  // ── Movement + encounter state ─────────────────────────────────────────────

  // Ref guard — only one move/encounter interaction in flight at a time.
  // Directional facing — updated after every successful move so the sprite
  // holds the last walked direction while standing idle.
  const [playerFacing, setPlayerFacing] = useState<FacingDir>('face_e');

  // Walk animation flag — true during and briefly after each tile traverse.
  // Drives the walk step cycle in HexObjectLayer; always resolves to false
  // via walkTimerRef so it can't get stuck if navigation interrupts the move.
  const [isMoving, setIsMoving] = useState(false);
  const walkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Task 720: step-dust trail — ID of the tile the hero just stepped off.
  // Set to fromTile.id at move-start; cleared after ~420 ms (slightly longer
  // than the 360 ms dustAnim fade so the View unmounts after it's invisible).
  const [dustTileId, setDustTileId] = useState<string | undefined>(undefined);
  const dustTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const movingRef = useRef(false);

  /** Inline error message (insufficient stamina, locked gate). Auto-clears after 2.5 s. */
  const [moveError, setMoveError]   = useState<string | null>(null);
  const moveErrorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state for on-map encounters (treasure + merchant).
  // The tileId drives which tile's data the modal reads.
  const [treasureModalTileId, setTreasureModalTileId] = useState<string | null>(null);
  const [merchantModalTileId, setMerchantModalTileId] = useState<string | null>(null);

  // Ref: prevents the battle-return resolution effect from firing more than once
  // per screen mount, even if `run` re-renders before the effect cleanup.
  const battleResultApplied = useRef(false);

  // ── Challenge Chapter state ────────────────────────────────────────────────
  /** 'idle' → 'confirming' → 'creating' → back to idle (or 'error'). */
  const [challengePhase, setChallengePhase] =
    useState<'idle' | 'confirming' | 'creating' | 'error'>('idle');
  const [challengeError,  setChallengeError]  = useState<string | null>(null);

  // ── Rechallenge Map state (pre-clear new attempt) ─────────────────────────
  /** 'idle' → 'confirming' → 'creating' → back to idle (or 'error'). */
  const [rechallengePhase, setRechallengePhase] =
    useState<'idle' | 'confirming' | 'creating' | 'error'>('idle');
  const [rechallengeError, setRechallengeError] = useState<string | null>(null);

  // ── Dev diagnostics (Push 0 + CORRECTIVE PUSH A) ─────────────────────────
  // diagRef is written by HexMapLayer after geometry settles; read by panel.
  // mapMetrics mirrors the same data as React state so CameraDiagnosticsPanel
  // re-renders automatically after each player move or run load.
  // devOverlay controls per-tile debug overlays inside HexMapLayer.
  // All are always created (hooks rules) but only consumed in __DEV__ paths.
  const diagRef    = useRef<HexMapWorldMetrics | null>(null);
  const [mapMetrics, setMapMetrics] = useState<HexMapWorldMetrics | null>(null);
  const [devOverlay, setDevOverlay] = useState<HexMapDevOverlay>({});

  useEffect(() => {
    // Debug fixture bypasses the real run entirely.
    if (debugTiles !== null) { setRunLoading(false); return; }

    // No session — fall back to the static fixture so the map is always
    // visible on this dev route even without a logged-in player.
    if (!player?.id) { setRunLoading(false); return; }

    let cancelled = false;
    setRunLoading(true);
    setRunError(null);

    // Shift for a brand-new attempt #1 comes from the ChapterShiftRule layer:
    // fixed for Ch1-3, canonical-inherit for Ch5-6/8, player choice (via the
    // requestedShift route param) for Ch4/7/9/10.  Existing runs keep their
    // frozen shift regardless.  Reads go through refs (updated every render)
    // so this effect never closes over stale canonical/param values.
    const newRunShift = resolveRunShift(
      chNum,
      (ch) => canonicalShiftsRef.current?.[String(ch)],
      requestedShiftRef.current,
    );
    loadOrCreateJourneyRun(player.id, chNum, journeyRunRepository, keysCollected, newRunShift)
      .then(r => { if (!cancelled) { setRun(r); setRunLoading(false); } })
      .catch(err => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          // Log with full error so it appears in crash-reporting dashboards.
          console.error('[fog-map] Failed to load journey run for chapter', chNum, err);
          setRunError(msg);
          setRunLoading(false);
          // Intentionally NOT creating a replacement run — preserves saved data.
        }
      });

    return () => { cancelled = true; };
  // loadAttempt increments when the user taps Retry, re-triggering this effect.
  }, [player?.id, chNum, debugTiles, loadAttempt]);

  // ── Pending boss-key drain effect (Task 576) ──────────────────────────────
  // On mount (or when the player / chapter changes), retry any Area Boss key
  // claims that failed to reach the backend during a previous session.
  // Claims are sent sequentially (not concurrently) so the server always sees
  // a stable claimed_tile_ids set between requests.
  // A ref prevents overlapping drains from the same component instance (e.g.
  // React Strict Mode double-invoke or a rapid player/chapter change).
  const drainInProgressRef = useRef(false);
  useEffect(() => {
    if (!player?.id) return;
    if (drainInProgressRef.current) return;
    const playerId = player.id;

    drainInProgressRef.current = true;
    getPendingBossKeyClaims(playerId, chNum)
      .then(async pending => {
        if (pending.length === 0) return;
        const drained: string[] = [];
        // Sequential — one claim at a time so the backend's atomic write
        // always operates on the fully-settled post-previous-claim state.
        for (const entry of pending) {
          const serverKeys = await claimChapterBossKeyOnServer(
            playerId, entry.chapterId, entry.claimKey,
          );
          if (serverKeys) {
            await reconcileChapterBossKeys(entry.chapterId, serverKeys);
            drained.push(entry.claimKey);
          }
          // If still null, leave in the queue for the next attempt.
        }
        if (drained.length > 0) {
          await removePendingBossKeyClaims(drained);
        }
      })
      .catch(e => console.warn('[fog-map] pending boss-key drain failed:', e))
      .finally(() => { drainInProgressRef.current = false; });
  // Only re-run when the player or chapter changes, not on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, chNum]);

  // ── Post-battle resolution effect ──────────────────────────────────────────
  // When the fog-map is (re)mounted with `resolvedTileId` + `battleOutcome`
  // params (set by result.tsx when the player returns from a battle started
  // here), apply the appropriate resolution exactly once.
  useEffect(() => {
    if (!run || !resolvedTileId || !battleOutcome) return;
    if (battleResultApplied.current) return;
    battleResultApplied.current = true;

    const won = battleOutcome === 'win';
    if (!won) return; // Loss: map is preserved as-is, no tile changes.

    let updated: JourneyRun;
    if (journeyIsChapterBoss === '1') {
      updated = resolveChapterBossWin(run);
      // Also mark cleared on the backend.
      journeyRunRepository.markRunCleared(updated.id)
        .catch(e => console.warn('[fog-map] markRunCleared failed:', e));
      // ── Canonical shift (Book I choice chapters) ────────────────────────────
      // First clear of a choice chapter (Ch4/7/9/10) records its shift as the
      // chapter's canonical shift; inherit chapters (Ch5-6, Ch8) read it.
      // setCanonicalShift is write-once, so replays never mutate it.
      if (isCanonicalChoiceChapter(chNum)) {
        setCanonicalShift(chNum, run.shift)
          .catch(e => console.warn('[fog-map] setCanonicalShift failed:', e));
      }
      // ── Atomic: completion XP + required-node claims in one store write ────
      // applyFogMapChapterBossRewards reads playerRef.current (always fresh)
      // and issues a single updateState, avoiding the stale-snapshot race that
      // occurs when applyRewards + a separate updateState are both fired from
      // the same effect closure.  The single write also flips the
      // ChapterCompletion badge (chapterSummary useMemo depends on player).
      applyFogMapChapterBossRewards(
        chapter?.requiredCompletionNodes ?? [],
        chapter?.completionXp ?? 0,
      ).catch(e => console.warn('[fog-map] applyFogMapChapterBossRewards failed:', e));
    } else if (journeyIsAreaBoss === '1') {
      updated = resolveAreaBossWin(run, resolvedTileId);
      // ── Chapter-level key update (Task 570) ────────────────────────────────
      // resolveAreaBossWin updates run-level areaBossKeysCollected; we must
      // ALSO update the chapter-level ChapterBossKeyState so keys survive
      // across Rechallenge Map (new runs for the same chapter).
      //
      // Claim key is run-scoped ("{runId}:{tileId}") so tile coordinates
      // ("q,r") cannot collide across different randomised map attempts.
      // Each new run has a fresh UUID, guaranteeing a unique claim identity
      // even when a rechallenge map places a boss at the same coordinates.
      if (player) {
        const claimKey = `${run.id}:${resolvedTileId}`;
        const existing = player.chapter_boss_keys?.[String(chNum)];
        const currentKeyState = existing
          ? createChapterBossKeyState(chNum, existing.keys_collected, existing.claimed_tile_ids)
          : createChapterBossKeyState(chNum);
        const newKeyState = claimAreaBossKey(currentKeyState, claimKey);

        // Optimistic local update — immediately visible in the gate HUD.
        const newChapterBossKeys = {
          ...(player.chapter_boss_keys ?? {}),
          [String(chNum)]: {
            keys_collected:   newKeyState.keysCollected,
            claimed_tile_ids: [...newKeyState.claimedTileIds],
          },
        };
        updateState({ ...player, chapter_boss_keys: newChapterBossKeys })
          .catch(e => console.warn('[fog-map] updateState chapter_boss_keys failed:', e));

        // Durable backend write — idempotent, survives session close + restart.
        // Capture playerId now to avoid a stale closure after the await gap.
        const capturedPlayerId = player.id;
        claimChapterBossKeyOnServer(capturedPlayerId, chNum, claimKey)
          .then(async serverKeys => {
            if (serverKeys) {
              // Reconcile: overwrite the optimistic snapshot with the
              // authoritative server value.  reconcileChapterBossKeys reads
              // playerRef.current (always fresh) so it won't clobber any other
              // writes that happened between the optimistic update and now.
              await reconcileChapterBossKeys(chNum, serverKeys);
            } else {
              // Server returned null — the call failed silently inside
              // claimChapterBossKeyOnServer.  Queue the claim so it is retried
              // the next time this chapter's fog-map is opened.
              await enqueuePendingBossKeyClaim(capturedPlayerId, chNum, claimKey);
            }
          })
          .catch(e => console.warn('[fog-map] boss key reconciliation error:', e));
      }
    } else {
      updated = resolveBattleWin(run, resolvedTileId);
    }

    setRun(updated);
    journeyRunRepository.saveRun(updated)
      .catch(e => console.warn('[fog-map] post-battle saveRun failed:', e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, resolvedTileId, battleOutcome, journeyIsAreaBoss, journeyIsChapterBoss]);

  // ── Derived display values ─────────────────────────────────────────────────
  //
  // TERRAIN INVARIANT (Push 5):
  //
  //   When a run is active, ALL run.tiles are passed to HexMapLayer — never a
  //   filtered subset.  For Chapter 1 this is always 60 cells (Push 1 doubled the count).
  //
  //   Do NOT add a visibility/encounter/viewport filter here.  Terrain must
  //   be fully mounted in MapWorld for the entire run so that:
  //     • BFS adjacency and movement operate over the complete graph
  //     • Unexplored tile Pressables exist as disabled tap targets (accessible)
  //
  //   What the player sees is controlled by the camera (PanResponder).
  //   Terrain is never removed from MapWorld.
  //
  //   Diagnostic: worldMetricsRef.current.renderedTileCount must equal
  //   getChapterTerrainCellCount(chNum) for the entire lifetime of the run.
  const mapTiles = useMemo<readonly HexMapTile[]>(() => {
    if (debugTiles !== null) return debugTiles;
    if (run) {
      // ALL tiles — no filter by visibility, encounter, fog state, or position.
      return run.tiles.map(t => toHexMapTile(t, run.gateAnchorTileId));
    }
    // No session (no player) — show the static fixture so the dev route always
    // has something visible even without a logged-in player.
    if (!player?.id) return JOURNEY_MAP_FIXTURE;
    return [];
  }, [run, debugTiles, player?.id]);

  // ── Dev diagnostics: template tile count (Push 0) ─────────────────────────
  // Reads the authored/generated template to compare against the runtime run.
  // Wrapped in try/catch because getChapterMapTemplate throws for chapters
  // without a template (should not happen for ch1–9, but safe to guard).
  // Only evaluated in __DEV__ to keep production bundle clean.
  const templateTerrainCellCount = useMemo<number | null>(() => {
    if (!__DEV__) return null;
    try { return getChapterMapTemplate(chNum).tiles.length; }
    catch { return null; }
  }, [chNum]);

  // ── Dev terrain count assertion (Push 0) ──────────────────────────────────
  // Throws visibly when the runtime tile count does not match the config.
  // "Do not silently recover from incorrect terrain counts." (directive)
  // useEffect so the screen renders first (panel visible before crash), then
  // the assertion fires and shows a red box / console error in dev tools.
  useEffect(() => {
    if (!__DEV__ || !run) return;
    const expected = getChapterTerrainCellCount(chNum);
    if (run.tiles.length !== expected) {
      const msg =
        `[fog-map] TERRAIN ASSERTION FAIL — ` +
        `Chapter ${chNum}: expected ${expected} terrain cells but got ${run.tiles.length}. ` +
        `(seed: ${run.seed}, start: ${run.startTileId}, gate: ${run.gateAnchorTileId})`;
      console.error(msg);
      throw new Error(msg);
    }
  }, [run, chNum]);

  // Push 22: gate always requires CHAPTER_BOSS_KEY_REQUIREMENT (3) accumulated
  // chapter-level keys.  The old discovery-based shortcut for zero-boss maps
  // ("gate opens when reached") is removed — gate progress is always 0/3 → 3/3.
  //
  // `areaBossCount` is the number of Area Boss tiles placed on THIS run.  When it
  // is zero the player cannot earn keys on the current attempt — they must rely on
  // keys carried over from previous attempts (chapter_boss_keys[chNum]).
  // The zero-boss case shows an informational note in the key bar; the unlock
  // threshold stays at 3 regardless.
  const areaBossCount   = run?.areaBossCount ?? 0;
  // Chapter-level key count (Task 570): chapter_boss_keys persists across
  // Rechallenge Map so keys earned on Run 1 are still visible on Run 2.
  // Falls back to run-level areaBossKeysCollected for pre-570 saves or first run.
  const chapterKeyEntry = player?.chapter_boss_keys?.[String(chNum)];
  const keysCollected   = chapterKeyEntry?.keys_collected ?? run?.areaBossKeysCollected ?? 0;
  // Informational flag — purely for the "No Area Bosses detected on this attempt."
  // note; does NOT affect the gate unlock threshold.
  const zeroKeyMap      = areaBossCount === 0;
  // Gate is unlocked ONLY when the 3-key threshold is met.  No discovery bypass.
  const gateUnlocked    = keysCollected >= CHAPTER_BOSS_KEY_REQUIREMENT;

  // ── Shift-aware map visuals ───────────────────────────────────────────────
  // run.chapterId is the authoritative source — it is the chapter frozen into
  // this JourneyRun at creation and never changes mid-run.  chNum (from the
  // route param) is the fallback for screens that load before a run hydrates.
  //
  // run.shift (TimeOfDay) is also frozen at creation (readonly).
  // Changing the shift tab on the Book page has no effect here — the run's
  // own shift drove the encounter generator and now drives the art.
  //
  // Push 9 — NO shift fallback anywhere in this file.
  // mapShift stays undefined until the authoritative JourneyRun has loaded.
  // chapterVisuals is the single gate:
  //   null     → shift unknown → render NeutralMapShell (dark, no palette)
  //   non-null → shift resolved → render HexMapLayer with EXACTLY these visuals
  // The night→day flash is impossible when every visual prop comes from
  // chapterVisuals and HexMapLayer is never rendered while chapterVisuals is null.
  const mapShift: TimeOfDay | undefined = run?.shift;
  const stage2Pass = useMemo(() => {
    const visualChapter = run?.chapterId ?? (debugTiles !== null ? chNum : undefined);
    if (visualChapter == null || !BLUEPRINT_PIPELINE_CHAPTERS.has(visualChapter)) return true;
    try {
      const artifact = getCanonicalChapterMapArtifact(visualChapter);
      if (!artifact.stage2Validation.pass) return false;
      if (!run) return true;
      return (
        run.mapBlueprintHash === artifact.blueprintHash &&
        run.mapLayoutVersion === artifact.mapLayoutVersion &&
        compareRunGeometryToCanonicalArtifact(run, artifact).matches
      );
    } catch {
      return false;
    }
  }, [chNum, debugTiles, run]);
  const chapterVisuals = mapShift != null
    ? getChapterMapVisuals(run!.chapterId, mapShift, stage2Pass)
    // Debug fixture mode: no real run → resolve visuals from the chapter number so
    // blueprint-pipeline chapters (Ch1) activate the dual-layer reveal system.
    // For non-blueprint chapters fall back to the generic night visuals as before.
    // This path is only reachable when __DEV__ && debugTiles !== null.
    : (debugTiles !== null
        ? (BLUEPRINT_PIPELINE_CHAPTERS.has(chNum)
            ? getChapterMapVisuals(chNum, 'night', stage2Pass)
            : DEV_FALLBACK_VISUALS)
        : null);

  // ── Push 5: blueprint scenery zone centroids for MAP BLUEPRINT overlay ───────
  // Pre-computed once per chapter (DEV only) so the HexMapLayer overlay can
  // show RED exclusion-zone dots without calling the pipeline on every render.
  const blueprintSceneryZones = useMemo(() => {
    if (!__DEV__) return undefined;
    if (!BLUEPRINT_PIPELINE_CHAPTERS.has(chNum)) return undefined;
    try {
      const artifact = getCanonicalChapterMapArtifact(chNum);
      return artifact.sceneryLayout.sceneryZones.map(z => z.centroid);
    } catch { return undefined; }
  }, [chNum]);

  // ── Task 766: walkable-footprint overlay data (DEV only) ─────────────────────
  // GREEN  — walkable-bed cells (from the shared BackgroundAuthoringManifest bed)
  // RED    — cells of BLOCKING scenery zones (negative-space obstacles)
  // MAGENTA— illegal overlaps from the background validator (empty after a pass)
  // Computed once per chapter, only for blueprint-pipeline chapters; the
  // devOverlay.footprint toggle in the diagnostics panel controls rendering.
  const footprintOverlay = useMemo(() => {
    if (!__DEV__) return undefined;
    if (!BLUEPRINT_PIPELINE_CHAPTERS.has(chNum)) return undefined;
    try {
      const manifests = getBackgroundAuthoringManifests(chNum);
      const m = manifests[0];
      if (!m) return undefined;
      const walkableCells = m.walkableBed.walkableCellKeys.map(k => {
        const [q, r] = k.split(',').map(Number);
        return { q, r };
      });
      const artifact = getCanonicalChapterMapArtifact(chNum);
      const blockingCells = artifact.sceneryLayout.sceneryZones
        .filter(z => isBlockingSceneryZone(z.type))
        .flatMap(z => z.cells.map(c => ({ q: c.q, r: c.r })));
      const overlapCells = m.validationResult.violations
        .flatMap(v => v.overlappingCellKeys.map(k => {
          const [q, r] = k.split(',').map(Number);
          return { q, r };
        }));
      return { walkableCells, blockingCells, overlapCells };
    } catch { return undefined; }
  }, [chNum]);

  // ── Scenery prop layer — placed props for blueprint-pipeline chapters ────────
  // Freestanding props (simulation beds, consoles, tables, etc.) are placed at
  // runtime from the ChapterSceneryLayout so they never bake into the raster.
  //
  // Requires mapTiles (for coord origin) and mapSize.w (for authored world mode).
  // Both are always available when a run is loaded and the map container has laid
  // out.  Falls back to empty array for non-blueprint chapters and during init.
  const sceneryCoords = useMemo(() => {
    if (!BLUEPRINT_PIPELINE_CHAPTERS.has(chNum)) return null;
    if (!mapTiles || mapTiles.length === 0 || !mapSize.w) return null;
    try {
      return computeHexWorldCoords(mapTiles, mapSize.w, AUTHORED_MAP_TILE_SZ);
    } catch { return null; }
  }, [chNum, mapTiles, mapSize.w]);

  const placedSceneryProps = useMemo(() => {
    if (!sceneryCoords) return [];
    try {
      const artifact = getCanonicalChapterMapArtifact(chNum);
      return computeSceneryProps(artifact.sceneryLayout, sceneryCoords, chNum);
    } catch { return []; }
  }, [chNum, sceneryCoords]);

  // ── Exploration character sprite ──────────────────────────────────────────
  // Push 3: resolved via getExplorationAvatar() — progression-aware resolver
  // that factors in chapter era, class, and future skin/variant overrides.
  //
  // Task 719: explorationCharacter is only set when a CLASS-SPECIFIC sprite
  // was resolved (i.e. not the generic MAP_SPRITE.explorer token).  When the
  // resolver returns MAP_SPRITE.explorer (pre-class players, or eras whose
  // class art hasn't shipped yet), we pass undefined so HexObjectLayer selects
  // from EXPLORER_FACING_SPRITES[playerFacing] — the 6 unique directional
  // frames — without any scaleX mirroring.  Class sprites continue to use the
  // single-source + mirror approach until 6-frame class art is authored.
  const _resolvedAvatar: number | undefined = player
    ? getExplorationAvatar({
        classTreeId:   player.class_tree_id,
        chapterNumber: chNum,
      })
    : undefined;
  const explorationCharacter: number | undefined =
    _resolvedAvatar != null && _resolvedAvatar !== MAP_SPRITE.explorer
      ? _resolvedAvatar
      : undefined;

  // ── Effective vision radius (Push 3 — configurable field of vision) ────────
  // Formula: effectiveVisionRadius = BASE_VISION_RADIUS + Σ(active bonuses)
  // Currently all classes return 0 bonus → radius = 1 (baseline).
  // When a Scout/Ranger class passive is added to visionConfig, it will
  // automatically expand vision here without touching this file.
  const effectiveVisionRadius = useMemo(
    () => computeEffectiveVisionRadius(resolveVisionBonuses(player?.class_tree_id ?? undefined)),
    [player?.class_tree_id],
  );

  // ── Push 3: live FOV ring for FogOfWarLayer ───────────────────────────────
  // calculateVisibleTileIds returns the set of tile IDs currently within the
  // player's vision radius — identical geometry to what computeFogAfterMove
  // marks as 'visibleNow'.  Recomputed whenever the run or radius changes
  // (movement updates run.currentTileId which changes the tile identity check).
  const fogVisibleTileIds = useMemo((): ReadonlySet<string> => {
    if (!run) {
      // Debug fixture / no-session fallback: compute the live FOV ring from
      // the current tile so the fog erasure (Push 4) is exercised on the dev
      // route with the same geometry as a real run.
      const currentDebugTile = mapTiles.find(t => t.current);
      if (!currentDebugTile) return new Set<string>();
      return calculateVisibleTileIds(currentDebugTile.id, mapTiles, effectiveVisionRadius);
    }
    const currentTile = run.tiles.find(t => t.current);
    if (!currentTile) return new Set<string>();
    return calculateVisibleTileIds(currentTile.id, run.tiles, effectiveVisionRadius);
  }, [run, effectiveVisionRadius, mapTiles]);

  // Push 4: explored fallback for debug/fixture mode (run=null) — mirrors
  // run.exploredTileIds using the per-tile visibility states.
  const fogExploredTileIds = useMemo((): readonly string[] => {
    if (run) return run.exploredTileIds;
    return mapTiles
      .filter(t => t.visibility === 'exploredButOutOfVision' || t.visibility === 'visibleNow')
      .map(t => t.id);
  }, [run, mapTiles]);

  // Push 24: canonical terrain cell count (includes gate tile — 30 for Ch1-5).
  // run.tileCount excluded the gate tile (tiles.length - 1) and was the source
  // of the "X / 29" display bug.  getChapterTerrainCellCount is the authoritative
  // source and treats every physical hex cell — normal terrain, Start, and Gate —
  // as part of the map, matching the spec: "terrainExploredCount / terrainCellCount".
  const terrainCellCount    = getChapterTerrainCellCount(chNum);
  // FOV-entered count: exploredTileIds accumulates every tile that has been in
  // Field of Vision at least once (via computeFogAfterMove).  This correctly
  // includes the Gate tile when the player moves within REVEAL_RADIUS=1 of it,
  // unlike run.exploredTileCount which only incremented when physically stepping
  // on a tile.
  const terrainExploredCount = run?.exploredTileIds.length ?? 0;
  const exploredPct          = Math.round((terrainExploredCount / terrainCellCount) * 100);

  // Chapter accent color (per-chapter warm-dark tint)
  const accentColor = chapter?.accentColor ?? UI.jade;

  // Run status helpers
  const isCleared = run?.status === 'cleared';

  // ── Rechallenge Map eligibility ────────────────────────────────────────────
  // Uses the same canonical chapter-level key state as the HUD so eligibility
  // and run-creation both see the same count.  Falls back to run-level for
  // legacy saves that pre-date chapter_boss_keys storage (Task 570).
  const rechallengeKeyState = useMemo(
    () => createChapterBossKeyState(
      chNum,
      keysCollected,
      chapterKeyEntry?.claimed_tile_ids ?? [],
    ),
    [chNum, keysCollected, chapterKeyEntry?.claimed_tile_ids],
  );
  const rechallengeEligibility = useMemo(
    () => checkRechallengeEligibility(rechallengeKeyState, run?.chapterBossDefeated ?? false),
    [rechallengeKeyState, run?.chapterBossDefeated],
  );

  // Treasure accounting (for summary card reward totals)
  const treasureTiles    = run?.tiles.filter(t => t.encounter === 'treasure') ?? [];
  const claimedTreasures = treasureTiles.filter(t => t.rewardClaimed);
  const chestXp     = claimedTreasures.reduce((s, t) => s + TREASURE_REWARDS[t.chestTier ?? 'bronze'].xp,     0);
  const chestCrowns = claimedTreasures.reduce((s, t) => s + TREASURE_REWARDS[t.chestTier ?? 'bronze'].crowns, 0);
  const chestShards = claimedTreasures.reduce((s, t) => s + TREASURE_REWARDS[t.chestTier ?? 'bronze'].shards, 0);
  const completionXpBonus = isCleared ? (chapter?.completionXp ?? 0) : 0;
  const totalXp     = chestXp + completionXpBonus;
  const totalCrowns = chestCrowns;
  const totalShards = chestShards;

  // Stamina
  const { stamina, max: staminaMax } = useLiveStamina(player ?? null);

  // ── Move handler ───────────────────────────────────────────────────────────

  /** Show a brief inline error (stamina-low, gate-locked). Auto-clears in 2.5 s. */
  const showInlineError = useCallback((msg: string) => {
    setMoveError(msg);
    if (moveErrorTimer.current) clearTimeout(moveErrorTimer.current);
    moveErrorTimer.current = setTimeout(() => setMoveError(null), 2500);
  }, []);

  /** Navigate to a battle launched from this fog-map. Replaces the current route
   *  so the back-stack doesn't leave the player stranded mid-battle. */
  const navigateToBattle = useCallback((
    enemyId:         string,
    tileId:          string,
    isAreaBoss:      boolean,
    isChapterBoss:   boolean,
  ) => {
    router.replace({
      pathname: '/battle',
      params: {
        enemyId,
        journeyReturn:        '1',
        journeyChapterId:     String(chNum),
        journeyTileId:        tileId,
        journeyIsAreaBoss:    isAreaBoss    ? '1' : '0',
        journeyIsChapterBoss: isChapterBoss ? '1' : '0',
        // Battle bridge: the run's frozen TimeOfDay travels with the battle
        // so shift-specific orchestration can key off it.
        journeyShift:         run?.shift ?? 'day',
      },
    });
  }, [router, chNum, run?.shift]);

  /**
   * Handle a tap on the chapter-boss gate tile or the "ENTER BOSS GATE" button.
   * Does NOT consume stamina.  If locked, shows a brief error.
   */
  const handleGateTap = useCallback(() => {
    if (!run) return;
    if (!gateUnlocked) {
      const needed = CHAPTER_BOSS_KEY_REQUIREMENT - keysCollected;
      showInlineError(`${needed} key fragment${needed !== 1 ? 's' : ''} still needed to unlock the gate.`);
      return;
    }
    const bossId = getChapterBossEnemyId(chNum);
    navigateToBattle(bossId, run.gateAnchorTileId ?? 'gate', false, true);
  }, [run, gateUnlocked, keysCollected, chNum, navigateToBattle, showInlineError]);

  /**
   * Confirm and execute a Challenge Chapter run creation.
   * Only reachable after the user explicitly taps the Challenge button AND
   * confirms — never triggered on page load or any automatic path.
   */
  const handleChallengeConfirm = useCallback(async () => {
    if (!run || !player?.id) return;
    if (run.status !== 'cleared') return;          // safety guard
    setChallengePhase('creating');
    setChallengeError(null);
    try {
      // Post-clear replays resolve via the ChapterShiftRule layer too: fixed
      // chapters stay fixed, inherit chapters follow the canonical shift, and
      // choice chapters default to the chapter's canonical shift (recorded at
      // first clear) unless a new ?shift= choice was passed.
      const replayShift = resolveRunShift(
        chNum,
        (ch) => canonicalShiftsRef.current?.[String(ch)],
        requestedShiftRef.current ?? canonicalShiftsRef.current?.[String(chNum)],
      );
      const newRun = await challengeChapter(player.id, chNum, journeyRunRepository, replayShift);
      // Reset in-flight guards for the new run.
      battleResultApplied.current = false;
      movingRef.current            = false;
      // Drop challenge UI back to idle BEFORE updating run so the cleared branch
      // never briefly re-renders with 'creating' state on the new active run.
      setChallengePhase('idle');
      setRun(newRun);
    } catch (err) {
      setChallengeError(err instanceof Error ? err.message : 'Failed to start new attempt.');
      setChallengePhase('error');
    }
  }, [run, player?.id, chNum]);

  /**
   * Confirm and execute a Rechallenge Map run creation.
   * Abandons the current active run, then creates a new one with a fresh seed.
   * Boss keys accumulated so far are preserved in the new run's areaBossKeysCollected.
   */
  const handleRechallengeConfirm = useCallback(async () => {
    if (!run || !player?.id) return;
    if (run.status !== 'active') return;           // safety guard
    setRechallengePhase('creating');
    setRechallengeError(null);
    try {
      const newRun = await rechallengeMap(
        player.id,
        chNum,
        journeyRunRepository,
        rechallengeKeyState,
      );
      // Reset in-flight guards for the new run.
      battleResultApplied.current = false;
      movingRef.current            = false;
      setRechallengePhase('idle');
      setRun(newRun);
    } catch (err) {
      setRechallengeError(err instanceof Error ? err.message : 'Failed to start new attempt.');
      setRechallengePhase('error');
    }
  }, [run, player?.id, chNum, rechallengeKeyState]);

  /**
   * Fired by TreasureModal when the player opens the chest.
   * Grants rewards, marks the tile resolved, and persists the run.
   */
  const handleTreasureClaim = useCallback(async (_rewards: TreasureReward) => {
    if (!run || !treasureModalTileId) return;
    const { run: updated, rewards } = resolveTreasureClaim(run, treasureModalTileId);
    setRun(updated);
    setTreasureModalTileId(null);
    journeyRunRepository.saveRun(updated).catch(e => console.warn('[fog-map] treasure saveRun:', e));
    if (rewards.xp > 0 || rewards.crowns > 0 || rewards.shards > 0) {
      applyRewards({ xp: rewards.xp, crowns: rewards.crowns, codexShards: rewards.shards,
        codex: [], enemyId: 'journey_treasure', enemyName: 'Journey Treasure' })
        .catch(e => console.warn('[fog-map] applyRewards:', e));
    }
  // applyRewards is stable from usePlayer()
  }, [run, treasureModalTileId, applyRewards]);

  /**
   * Called when the player taps a tile.
   *
   * Dispatch table:
   *   isGate           → handleGateTap (no stamina)
   *   encounter=none   → auto-resolve (no modal)
   *   encounter=battle / areaBoss → navigate to /battle
   *   encounter=treasure → open TreasureModal
   *   encounter=merchant → open MerchantModal (+ resolve on first visit)
   */
  const handleTilePress = useCallback(async (tile: HexMapTile) => {
    if (debugTiles !== null) return;
    if (!run || !player?.id) return;
    if (movingRef.current) return;

    // ── Gate tap: special, no stamina cost ──────────────────────────────────
    if (tile.isGate) {
      handleGateTap();
      return;
    }

    // ── Normal tile: validate + pay stamina + move ──────────────────────────
    movingRef.current = true;
    setMoveError(null);

    try {
      const validation = validateMove(run, tile.id, stamina);
      if (!validation.ok) {
        if (validation.reason === 'INSUFFICIENT_STAMINA') {
          showInlineError('Not enough stamina — wait for it to recover.');
        }
        return;
      }

      const spent = await spendStamina(MOVE_STAMINA_COST);
      if (!spent) {
        showInlineError('Not enough stamina — wait for it to recover.');
        return;
      }

      // Resolve directional facing and start walk animation.
      const fromTile = run.tiles.find(t => t.current);
      if (fromTile) {
        setPlayerFacing(hexFacingFromDelta(tile.q - fromTile.q, tile.r - fromTile.r));
        // Task 720: record departing tile for the dust-puff trail effect.
        if (dustTimerRef.current) clearTimeout(dustTimerRef.current);
        setDustTileId(fromTile.id);
        dustTimerRef.current = setTimeout(() => setDustTileId(undefined), 420);
      }
      if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
      setIsMoving(true);

      // Apply movement (fog state + visited/current flags).
      // effectiveVisionRadius is derived from the player's class/bonuses (Push 3);
      // defaults to 1 for all current classes.
      let afterMove = applyMoveToRun(run, tile.id, effectiveVisionRadius);
      const destTile = afterMove.tiles.find(t => t.id === tile.id);

      // ── Encounter dispatch ──────────────────────────────────────────────
      if (destTile && !destTile.resolved) {
        switch (destTile.encounter) {
          case 'none':
            // Auto-resolve silently — no modal required.
            afterMove = resolveNone(afterMove, tile.id);
            break;

          case 'battle':
            // Navigate to battle; resolution applied on return.
            setRun(afterMove);
            journeyRunRepository.saveRun(afterMove)
              .catch(e => console.warn('[fog-map] pre-battle saveRun:', e));
            navigateToBattle(
              deriveEnemyId(run.seed, tile.id, chNum),
              tile.id, false, false,
            );
            return; // early return — we're leaving the screen

          case 'areaBoss':
            setRun(afterMove);
            journeyRunRepository.saveRun(afterMove)
              .catch(e => console.warn('[fog-map] pre-boss saveRun:', e));
            navigateToBattle(
              getAreaBossEnemyId(chNum),
              tile.id, true, false,
            );
            return;

          case 'treasure':
            // Show the treasure modal; resolution happens in handleTreasureClaim.
            setRun(afterMove);
            journeyRunRepository.saveRun(afterMove)
              .catch(e => console.warn('[fog-map] pre-treasure saveRun:', e));
            setTreasureModalTileId(tile.id);
            return;

          case 'merchant': {
            // Resolve merchant on first visit; show modal.
            afterMove = resolveMerchantVisit(afterMove, tile.id);
            setRun(afterMove);
            journeyRunRepository.saveRun(afterMove)
              .catch(e => console.warn('[fog-map] merchant saveRun:', e));
            setMerchantModalTileId(tile.id);
            return;
          }
        }
      }

      // ── Commit resolved run ─────────────────────────────────────────────
      setRun(afterMove);
      journeyRunRepository.saveRun(afterMove)
        .catch(e => console.warn('[fog-map] saveRun:', e));

    } finally {
      movingRef.current = false;
      // Hold the walk cycle for 360 ms after movement commits so the
      // step animation plays visibly before snapping back to idle.
      walkTimerRef.current = setTimeout(() => setIsMoving(false), 360);
    }
  // Module-level imports (applyMoveToRun, resolveNone, etc.) are stable.
  }, [
    debugTiles, run, player?.id, stamina,
    spendStamina, handleGateTap, showInlineError, navigateToBattle, chNum,
  ]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>

      {/* ── 1. Top header ─────────────────────────────────────────────────── */}
      <View style={s.header}>
        <Pressable style={s.headerBtn} onPress={() => router.back()} testID="fog-map-back">
          <Text style={s.headerIcon}>←</Text>
        </Pressable>

        <View style={s.headerCenter}>
          <Text style={s.headerPhase}>{phase}</Text>
          <Text style={s.headerTitle} numberOfLines={1}>{title}</Text>
        </View>

        <View style={s.headerRight}>
          <View style={s.staminaRow}>
            <Image source={STAMINA_EMBLEM} style={s.staminaIcon} contentFit="contain" />
            <Text style={s.staminaVal}>{stamina}</Text>
            <Text style={s.staminaSep}>/</Text>
            <Text style={s.staminaMax}>{staminaMax}</Text>
            <Pressable
              style={s.plusBtn}
              testID="stamina-refill"
              onPress={() => {
                if (!player) return;
                void updateState({
                  ...player,
                  stamina: staminaMax,
                  stamina_updated_at: new Date().toISOString(),
                });
              }}
            >
              <Text style={s.plusTxt}>＋</Text>
            </Pressable>
          </View>
          <Text style={s.staminaHint}>Movement costs {ENCOUNTER_COST} stamina</Text>
        </View>

        <Pressable
          style={[s.headerBtn, legendOpen && s.headerBtnActive]}
          onPress={() => setLegendOpen(v => !v)}
          testID="fog-map-info"
          accessibilityLabel={legendOpen ? 'Hide tile legend' : 'Show tile legend'}
          accessibilityRole="button"
        >
          <Text style={[s.headerIcon, legendOpen && s.headerIconActive]}>ⓘ</Text>
        </Pressable>
      </View>

      {/* ── Chapter completion badge ───────────────────────────────────────── */}
      {chapterSummary && (
        <View style={s.completionBadgeWrap}>
          <ChapterCompletion
            storyCleared={chapterSummary.storyCleared}
            masteryStars={chapterSummary.masteryStars}
            maxMasteryStars={chapterSummary.maxMasteryStars}
          />
        </View>
      )}

      {/* ── 2. Boss-key progress (compact) — fixed chrome above map ─────── */}
      <View style={s.keyBar}>
        <Image source={ASSET.keyFragment} style={s.keyBarIcon} contentFit="contain" />
        <Text style={s.keyBarLabel}>CHAPTER BOSS KEYS</Text>
        <View style={s.keyBarCountRow}>
          <Text style={keysCollected >= CHAPTER_BOSS_KEY_REQUIREMENT ? s.keyBarCountFull : s.keyBarCountNum}>
            {keysCollected}
          </Text>
          <Text style={s.keyBarSep}> / </Text>
          <Text style={s.keyBarReq}>{CHAPTER_BOSS_KEY_REQUIREMENT}</Text>
        </View>
        <View style={[s.keyBarBadge, gateUnlocked && s.keyBarBadgeOpen]}>
          <Text style={[s.keyBarBadgeTxt, gateUnlocked && s.keyBarBadgeTxtOpen]}>
            {gateUnlocked ? 'UNLOCKED' : 'LOCKED'}
          </Text>
        </View>
        {run !== null && run.attemptNumber > 1 && keysCollected > 0 && (
          <View style={s.carriedOverBadge}>
            <Text style={s.carriedOverTxt}>↑ carried</Text>
          </View>
        )}
      </View>
      {/* Contextual note when this attempt has no Area Bosses and gate is still locked */}
      {zeroKeyMap && keysCollected < CHAPTER_BOSS_KEY_REQUIREMENT && (
        <Text style={s.keyBarHint}>No Area Bosses detected on this attempt.</Text>
      )}

      {/* ── 3. Map viewport — fills all remaining space, NOT inside a ScrollView
       *
       * CAMERA ARCHITECTURE (Push 1 fix):
       *   The map is a world-space scene rendered by HexMapLayer.  All layers
       *   (terrain, encounters, gate, player, fog) live in a single Animated.View
       *   translated by cameraAnim.  The viewport clips via overflow:'hidden'.
       *
       *   Placing the map inside a ScrollView caused two bugs:
       *     1. The outer ScrollView captured vertical pan gestures before
       *        HexMapLayer's PanResponder could claim them, so dragging up/down
       *        scrolled the page instead of panning the world-space camera.
       *     2. The height cap (max 600px) forced worldH to exceed the viewport,
       *        and the camera clamp prevented the top tiles from ever being reached.
       *
       *   Fix: map lives directly in the root flex column with flex:1 so it
       *   naturally fills every pixel between the fixed chrome and the nav bar.
       *   The secondary info scroll below is a separate, shorter container.     */}
      <View
        style={s.mapOuter}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          setMapSize({ w: Math.floor(width), h: Math.floor(height) });
        }}
      >
        {runLoading && !debugTiles ? (
          // ── Loading: spinner ───────────────────────────────────────────
          <View style={s.mapLoadingOverlay}>
            <ActivityIndicator size="large" color={UI.jade} />
            <Text style={s.mapLoadingTxt}>Loading map…</Text>
          </View>

        ) : runError ? (
          // ── Error: retry prompt ────────────────────────────────────────
          <View style={s.mapLoadingOverlay}>
            <Text style={s.mapErrorTxt}>⚠ {runError}</Text>
            <Text style={s.mapErrorDetail}>
              Your saved map data is preserved. Tap Retry to try again.
            </Text>
            <Pressable
              style={s.mapRetryBtn}
              onPress={() => setLoadAttempt(n => n + 1)}
              accessibilityRole="button"
              accessibilityLabel="Retry loading map"
              testID="fog-map-retry-btn"
            >
              <Text style={s.mapRetryTxt}>RETRY</Text>
            </Pressable>
          </View>

        ) : chapterVisuals == null ? (
          // ── Push 9: neutral shell — shift not yet resolved ─────────────
          <View
            style={s.neutralMapShell}
            testID="neutral-map-shell"
          />

        ) : (
          // ── Shift resolved — full HexMapLayer with authoritative visuals ─
          <HexMapLayer
            containerWidth={mapSize.w}
            containerHeight={mapSize.h}
            tiles={mapTiles}
            onTilePress={handleTilePress}
            tileVisuals={chapterVisuals}
            timeOfDay={mapShift as TimeOfDay}
            terrainTexture={chapterVisuals.terrainTexture}
            gateArt={{
              lockedSrc:    ASSET.gateLocked,
              unlockedSrc:  ASSET.gateUnlocked,
              unlocked:     gateUnlocked,
              keysCollected,
              keysRequired: CHAPTER_BOSS_KEY_REQUIREMENT,
              gateTileId:   run?.gateAnchorTileId,
            }}
            explorationCharacter={explorationCharacter}
            playerFacing={playerFacing}
            isMoving={isMoving}
            dustTileId={dustTileId}
            environmentBackground={
              // Push 5A / all-chapters pipeline: suppress environment reveal
              // when no finished-background raster is registered for this
              // chapter's blueprint hash.  BlueprintHexLayer + FogOfWarLayer
              // provide the visible foundation; EnvironmentRevealLayer activates
              // only once a validated raster is registered in
              // BLUEPRINT_RASTER_REGISTRY (Stage 3 complete).
              chapterVisuals.blueprintBackgroundMissing || chapterVisuals.background == null
                ? undefined
                : {
                    source:  chapterVisuals.background,
                    scale:   chapterVisuals.backgroundScale,
                    offsetX: chapterVisuals.backgroundOffsetX,
                    offsetY: chapterVisuals.backgroundOffsetY,
                  }
            }
            isBlueprintChapter={chapterVisuals.isBlueprintBacked === true}
            runSeed={run?.seed}
            fogExploredTileIds={fogExploredTileIds}
            fogVisibleTileIds={fogVisibleTileIds}
            fogEffectiveFieldOfVision={effectiveVisionRadius}
            diagRef={__DEV__ ? diagRef : undefined}
            devOverlay={__DEV__ ? devOverlay : undefined}
            worldTileSize={AUTHORED_MAP_TILE_SZ}
            onMetricsUpdate={__DEV__ ? setMapMetrics : undefined}
            startTileId={__DEV__ ? run?.startTileId : undefined}
            blueprintSceneryZones={__DEV__ ? blueprintSceneryZones : undefined}
            footprintOverlay={__DEV__ ? footprintOverlay : undefined}
            worldSceneryChildren={
              placedSceneryProps.length > 0 ? (
                <SceneryPropLayerView
                  props={placedSceneryProps}
                  sz={AUTHORED_MAP_TILE_SZ}
                />
              ) : undefined
            }
          />
        )}

        {/* ── Ambient foreground overlay ──────────────────────────────────
            pointerEvents="none" so tile taps pass through unaffected.     */}
        {chapterVisuals?.ambientOverlay != null && (
          <View
            pointerEvents="none"
            style={StyleSheet.absoluteFillObject}
            testID="ambient-overlay"
          >
            <Image
              source={chapterVisuals.ambientOverlay}
              style={[StyleSheet.absoluteFillObject, { opacity: 0.28 }]}
              contentFit="cover"
            />
          </View>
        )}

        {/* ── CORRECTIVE PUSH A: camera diagnostics overlay ──────────────
            Lives OUTSIDE MapWorld so it stays fixed while the camera pans.
            __DEV__ only — CameraDiagnosticsPanel returns null in production. */}
        {__DEV__ && (
          <View style={s.camDiagOverlay} pointerEvents="none">
            <CameraDiagnosticsPanel viewport={mapSize} metrics={mapMetrics} />
          </View>
        )}

        {/* ── 4b. Move-error banner — absolute overlay inside the map ──────
         *  Moved out of the ScrollView so it appears anchored to the map
         *  bottom rather than pushing content below the map.               */}
        {moveError !== null && (
          <View style={s.moveErrorOverlay} pointerEvents="none">
            <View style={s.moveErrorBanner}>
              <Image source={STAMINA_EMBLEM} style={s.moveErrorIcon} contentFit="contain" />
              <Text style={s.moveErrorTxt}>{moveError}</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── Secondary info scroll — sits BELOW the map, compact height ─────
       *  This is a separate ScrollView from the map so its gesture space
       *  never overlaps the map's PanResponder region.                    */}
      <ScrollView
        style={[s.infoScroll, { maxHeight: secondaryScrollMaxH }]}
        contentContainerStyle={s.infoScrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 4c. No encounter stub — real modals rendered below ────────── */}

        {/* ── 4d. Progress strip / debug banner ─────────────────────────── */}
        {debugTiles !== null ? (
          <View style={s.debugBanner}>
            <Text style={s.debugBannerTxt}>
              🛠 DEBUG MAP — {debugTiles.length} tiles · drag to explore · ?debug=N to change
            </Text>
          </View>
        ) : run !== null ? (
          /* Compact progress strip — primary at-a-glance summary after the map */
          <View style={s.progressStrip}>
            <Text style={s.progressStripTxt}>
              <Text style={s.progressStripChapter}>CH. {chNum}</Text>
              <Text style={s.progressStripDim}> · </Text>
              <Text style={s.progressStripVal}>{terrainExploredCount}/{terrainCellCount}</Text>
              <Text style={s.progressStripDim}> explored</Text>
              <Text style={s.progressStripDim}> · </Text>
              <Text style={s.progressStripLabel}>Keys </Text>
              <Text style={keysCollected >= CHAPTER_BOSS_KEY_REQUIREMENT
                ? s.progressStripValGood : s.progressStripVal}>
                {keysCollected}/{CHAPTER_BOSS_KEY_REQUIREMENT}
              </Text>
            </Text>
            {run.attemptNumber > 1 && (
              <Text style={s.progressStripAttempt}>Attempt #{run.attemptNumber}</Text>
            )}
          </View>
        ) : null}

        {/* ── 5. Dev diagnostics (real run only, dev route) ─────────────── */}
        {run !== null && debugTiles === null && (
          <DevDiagnostics
            run={run}
            chapterKeysCollected={keysCollected}
            chapterNum={chNum}
            blueprintBackgroundMissing={chapterVisuals?.blueprintBackgroundMissing}
            stage3AssetPath={chapterVisuals?.stage3AssetPath}
            stage3CandidateAssetPath={chapterVisuals?.stage3CandidateAssetPath}
            stage3ManifestAssetPath={chapterVisuals?.stage3ManifestAssetPath}
            stage3RegistryKey={chapterVisuals?.stage3RegistryKey}
            stage3RegistryMatch={chapterVisuals?.stage3RegistryMatch}
            stage3Status={chapterVisuals?.stage3Status}
            stage3Reason={chapterVisuals?.stage3Reason}
          />
        )}

        {/* ── 6. Tile-outcome legend (collapsed by default; ⓘ to expand) ── */}
        {legendOpen && (
          <Panel>
            <Text style={s.sectionTitle}>TILE OUTCOMES</Text>
            {LEGEND_ITEMS.map((item) => (
              <LegendRow key={item.key} src={item.src} label={item.label} desc={item.desc} />
            ))}
          </Panel>
        )}

        {/* ── 7. Chapter summary card ───────────────────────────────────── */}
        <Panel style={s.summaryCard}>

          {/* ── Chapter artwork header ──────────────────────────────────── */}
          <View style={[s.summaryArtWrapper, { borderColor: accentColor + '55' }]}>
            <Image
              source={ASSET.chapterArt}
              style={s.summaryArt}
              contentFit="cover"
              testID="chapter-summary-art"
            />
            {isCleared && (
              <View style={[s.summaryClearedBadge, { backgroundColor: accentColor + 'CC' }]}>
                <Text style={s.summaryClearedIcon}>✓</Text>
              </View>
            )}
          </View>

          {/* ── Chapter identity ────────────────────────────────────────── */}
          <View style={s.summaryTitleBlock}>
            <Text style={[s.summaryChapterTag, { color: accentColor }]}>
              {isCleared ? '✓ CHAPTER CLEARED' : `${phase} · CH.${chNum}`}
            </Text>
            <Text style={s.summaryTitle}>{title}</Text>
            <Text style={s.summaryAttempt}>
              {run !== null
                ? isCleared
                  ? `Attempt #${run.attemptNumber}  ·  ${exploredPct}% explored`
                  : `Attempt #${run.attemptNumber} — In progress`
                : 'Loading…'}
            </Text>
          </View>

          <View style={s.summaryDivider} />

          {/* ── Progress stats ──────────────────────────────────────────── */}
          <View style={s.summaryStats}>
            <View style={s.statCol}>
              <Text style={[s.statVal, { color: accentColor }]}>{exploredPct}%</Text>
              <Text style={s.statLbl}>Explored</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCol}>
              <Text style={s.statVal}>{terrainExploredCount} / {terrainCellCount}</Text>
              <Text style={s.statLbl}>Tiles Explored</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCol}>
              <Text style={[
                s.statVal,
                keysCollected >= CHAPTER_BOSS_KEY_REQUIREMENT && s.statValAccent,
              ]}>
                {keysCollected} / {CHAPTER_BOSS_KEY_REQUIREMENT}
              </Text>
              <Text style={s.statLbl}>Keys</Text>
            </View>
          </View>

          <View style={s.summaryDivider} />

          {/* ── Rewards section ─────────────────────────────────────────── */}
          <Text style={s.sectionTitle}>
            {isCleared ? 'REWARDS EARNED' : 'CHAPTER REWARDS'}
          </Text>

          {/* Chest count */}
          <View style={s.rewardRow}>
            <Text style={s.rewardLabel}>Chests Opened</Text>
            <Text style={s.rewardValue}>
              {claimedTreasures.length} / {treasureTiles.length}
            </Text>
          </View>

          {/* Reward chips (from chests + completion bonus) */}
          {(totalXp > 0 || totalCrowns > 0 || totalShards > 0) ? (
            <View style={s.rewardChips}>
              {totalXp > 0 && (
                <View style={[s.rewardChip, { borderColor: GOLD + '55', backgroundColor: GOLD + '12' }]}>
                  <Text style={[s.rewardChipTxt, { color: GOLD }]}>+{totalXp} XP</Text>
                </View>
              )}
              {totalCrowns > 0 && (
                <View style={[s.rewardChip, { borderColor: GOLD + '40', backgroundColor: GOLD + '0A' }]}>
                  <Text style={[s.rewardChipTxt, { color: GOLD }]}>+{totalCrowns} ◎</Text>
                </View>
              )}
              {totalShards > 0 && (
                <View style={[s.rewardChip, { borderColor: JADE + '55', backgroundColor: JADE + '12' }]}>
                  <Text style={[s.rewardChipTxt, { color: JADE }]}>+{totalShards} ✦</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={s.rewardValue}>
              {isCleared ? 'No chests claimed this run.' : 'Open treasure chests to earn rewards.'}
            </Text>
          )}

          {/* Completion XP line */}
          <View style={s.rewardRow}>
            <Text style={s.rewardLabel}>Completion Bonus</Text>
            <Text style={isCleared ? s.rewardValueAccent : s.rewardValue}>
              {isCleared
                ? `+${chapter?.completionXp ?? 0} XP earned`
                : `+${chapter?.completionXp ?? 0} XP (defeat Chapter Boss)`}
            </Text>
          </View>

          {/* ── Rechallenge Map section (active runs only) ──────────────── */}
          {!isCleared && run !== null && (
            <>
              <View style={s.summaryDivider} />

              {/* Gate open → direct the player to fight the boss */}
              {gateUnlocked ? (
                <Pressable
                  style={[s.challengeBtn, { borderColor: JADE + '66', backgroundColor: JADE + '10' }]}
                  onPress={handleGateTap}
                  testID="fight-boss-btn"
                >
                  <Text style={[s.challengeBtnTxt, { color: JADE }]}>FIGHT THE BOSS →</Text>
                  <Text style={s.challengeBtnSub}>Chapter Boss Gate is unlocked</Text>
                </Pressable>

              ) : rechallengeEligibility.eligible ? (
                /* Eligible to rechallenge — show the full confirm/creating/error flow */
                <>
                  {rechallengePhase === 'confirming' && (
                    <View style={s.challengeConfirm}>
                      <Text style={[s.challengeConfirmTitle, { color: accentColor }]}>
                        {RECHALLENGE_MAP_LABEL}?
                      </Text>
                      <Text style={s.challengeConfirmBody}>
                        Attempt #{(run.attemptNumber) + 1} will start on a new
                        randomised map. Your {keysCollected}/{CHAPTER_BOSS_KEY_REQUIREMENT} collected
                        boss key{keysCollected !== 1 ? 's' : ''} carry forward —
                        only the Chapter Boss defeat resets them.
                      </Text>
                      <View style={s.challengeConfirmRow}>
                        <Pressable
                          style={s.challengeCancel}
                          onPress={() => setRechallengePhase('idle')}
                          testID="rechallenge-cancel"
                        >
                          <Text style={s.challengeCancelTxt}>CANCEL</Text>
                        </Pressable>
                        <Pressable
                          style={[s.challengeAction, { borderColor: accentColor + '88', backgroundColor: accentColor + '18' }]}
                          onPress={handleRechallengeConfirm}
                          testID="rechallenge-confirm"
                        >
                          <Text style={[s.challengeActionTxt, { color: accentColor }]}>
                            START ATTEMPT #{run.attemptNumber + 1} →
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {rechallengePhase === 'creating' && (
                    <View style={s.challengeCreating}>
                      <ActivityIndicator size="small" color={accentColor} />
                      <Text style={[s.challengeCreatingTxt, { color: accentColor }]}>
                        Generating new map…
                      </Text>
                    </View>
                  )}

                  {rechallengePhase === 'error' && (
                    <View style={s.challengeConfirm}>
                      <Text style={s.challengeErrorTxt}>{rechallengeError}</Text>
                      <Pressable style={s.challengeCancel} onPress={() => setRechallengePhase('idle')}>
                        <Text style={s.challengeCancelTxt}>DISMISS</Text>
                      </Pressable>
                    </View>
                  )}

                  {rechallengePhase === 'idle' && (
                    <Pressable
                      style={[s.challengeBtn, { borderColor: accentColor + '66', backgroundColor: accentColor + '10' }]}
                      onPress={() => setRechallengePhase('confirming')}
                      testID="rechallenge-map-btn"
                    >
                      <Text style={[s.challengeBtnTxt, { color: accentColor }]}>
                        {RECHALLENGE_MAP_LABEL.toUpperCase()} →
                      </Text>
                      <Text style={s.challengeBtnSub}>
                        New map · keys carry forward ({keysCollected}/{CHAPTER_BOSS_KEY_REQUIREMENT})
                      </Text>
                    </Pressable>
                  )}
                </>

              ) : null /* ineligible (should not normally render for non-cleared active runs) */}
            </>
          )}

          {/* ── Challenge Chapter section (cleared runs only) ────────────── */}
          {isCleared && (
            <>
              <View style={s.summaryDivider} />

              {challengePhase === 'confirming' && (
                <View style={s.challengeConfirm}>
                  <Text style={[s.challengeConfirmTitle, { color: accentColor }]}>
                    Challenge Chapter {chNum}?
                  </Text>
                  <Text style={s.challengeConfirmBody}>
                    Attempt #{(run?.attemptNumber ?? 0) + 1} will begin on a new
                    randomised map. Your current completion record is preserved — this
                    run's history remains available.
                  </Text>
                  <View style={s.challengeConfirmRow}>
                    <Pressable
                      style={s.challengeCancel}
                      onPress={() => setChallengePhase('idle')}
                      testID="challenge-cancel"
                    >
                      <Text style={s.challengeCancelTxt}>CANCEL</Text>
                    </Pressable>
                    <Pressable
                      style={[s.challengeAction, { borderColor: accentColor + '88', backgroundColor: accentColor + '18' }]}
                      onPress={handleChallengeConfirm}
                      testID="challenge-confirm"
                    >
                      <Text style={[s.challengeActionTxt, { color: accentColor }]}>
                        START ATTEMPT #{(run?.attemptNumber ?? 0) + 1} →
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {challengePhase === 'creating' && (
                <View style={s.challengeCreating}>
                  <ActivityIndicator size="small" color={accentColor} />
                  <Text style={[s.challengeCreatingTxt, { color: accentColor }]}>
                    Generating new map…
                  </Text>
                </View>
              )}

              {challengePhase === 'error' && (
                <View style={s.challengeConfirm}>
                  <Text style={s.challengeErrorTxt}>{challengeError}</Text>
                  <Pressable style={s.challengeCancel} onPress={() => setChallengePhase('idle')}>
                    <Text style={s.challengeCancelTxt}>DISMISS</Text>
                  </Pressable>
                </View>
              )}

              {challengePhase === 'idle' && (
                <Pressable
                  style={[s.challengeBtn, { borderColor: accentColor + '66', backgroundColor: accentColor + '10' }]}
                  onPress={() => setChallengePhase('confirming')}
                  testID="challenge-chapter-btn"
                >
                  <Text style={[s.challengeBtnTxt, { color: accentColor }]}>
                    CHALLENGE CHAPTER →
                  </Text>
                  <Text style={s.challengeBtnSub}>
                    Create a new randomised attempt
                  </Text>
                </Pressable>
              )}
            </>
          )}

        </Panel>

      </ScrollView>

      {/* ── Fixed bottom navigation ───────────────────────────────────────── */}
      <BottomNav bottomPad={bottomPad} />

      {/* ── Treasure chest modal ──────────────────────────────────────────── */}
      {treasureModalTileId !== null && run !== null && (() => {
        const tile = run.tiles.find(t => t.id === treasureModalTileId);
        return (
          <TreasureModal
            visible
            tier={tile?.chestTier ?? 'bronze'}
            alreadyClaimed={tile?.rewardClaimed ?? false}
            onClaim={handleTreasureClaim}
            onClose={() => setTreasureModalTileId(null)}
          />
        );
      })()}

      {/* ── Merchant modal ────────────────────────────────────────────────── */}
      {merchantModalTileId !== null && run !== null && (
        <MerchantModal
          visible
          runSeed={run.seed}
          tileId={merchantModalTileId}
          onLeave={() => setMerchantModalTileId(null)}
        />
      )}

      {/* ── Dev diagnostics panel (Push 0 — __DEV__ only) ─────────────────── *
       * Absolutely-positioned floating overlay in the bottom-left corner.
       * Gives full terrain / visibility / world metrics and overlay toggles.
       * The `if (!__DEV__)` guard is in the panel itself; this conditional
       * is an additional belt-and-suspenders gate so the JSX branch is
       * completely absent from production bundles.                           */}
      {__DEV__ && (
        <JourneyMapDiagnosticsPanel
          chapterId={chapterId ?? ''}
          chNum={chNum}
          timeOfDay={mapShift}
          run={run}
          expectedTerrainCellCount={getChapterTerrainCellCount(chNum)}
          templateTerrainCellCount={templateTerrainCellCount}
          renderedTerrainCellCount={mapTiles.length}
          viewportWidth={mapSize.w}
          viewportHeight={mapSize.h}
          keysCollected={keysCollected}
          areaBossCount={areaBossCount}
          worldMetricsRef={diagRef}
          overlay={devOverlay}
          onOverlayChange={setDevOverlay}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const PANEL_BG     = UI.sanctuaryPanel;
const PANEL_BORDER = UI.sanctuaryBorder;
const GOLD         = UI.gold;
const JADE         = UI.jade;
const TEXT         = UI.text;
const TEXT_SOFT    = UI.textSoft;
const TEXT_DIM     = UI.textDim;

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: UI.sanctuaryBg },

  // ── Secondary info scroll (below map) ────────────────────────────────────
  // Separate container from the map so its gesture space never conflicts with
  // the map's PanResponder.  maxHeight is applied inline from secondaryScrollMaxH.
  infoScroll: { flexShrink: 0 },
  infoScrollContent: {
    paddingHorizontal: 14,
    gap: 8,
    paddingTop: 6,
    paddingBottom: 8,
  },

  // Completion badge strip (between header and scroll body)
  completionBadgeWrap: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
  },

  // Header info-button active state (legend open)
  headerBtnActive: { backgroundColor: JADE + '1A', borderRadius: 8 },
  headerIconActive: { color: JADE },

  // Compact progress strip (between map and summary card)
  progressStrip: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: PANEL_BG,
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     PANEL_BORDER,
  },
  progressStripTxt:     { flexDirection: 'row', flexShrink: 1 } as object,
  progressStripChapter: { color: JADE,      fontSize: 11, fontWeight: '800', fontFamily: SERIF, letterSpacing: 0.5 },
  progressStripVal:     { color: GOLD,      fontSize: 11, fontWeight: '700', fontFamily: SERIF },
  progressStripValGood: { color: JADE,      fontSize: 11, fontWeight: '700', fontFamily: SERIF },
  progressStripLabel:   { color: TEXT_SOFT, fontSize: 11, fontFamily: SERIF },
  progressStripDim:     { color: TEXT_DIM,  fontSize: 11 },
  progressStripAttempt: { color: TEXT_DIM,  fontSize: 10, fontStyle: 'italic', fontFamily: SERIF },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: UI.sanctuaryBg,
    borderBottomWidth: 1, borderBottomColor: PANEL_BORDER,
    gap: 6,
  },
  headerBtn:    { padding: 8, minWidth: 36, alignItems: 'center' },
  headerIcon:   { color: TEXT_SOFT, fontSize: 20 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 1 },
  headerPhase: {
    color: JADE, fontSize: 9, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', fontFamily: SERIF,
  },
  headerTitle: {
    color: TEXT, fontSize: 13, fontWeight: '700',
    fontFamily: SERIF, textAlign: 'center',
  },
  headerRight:  { alignItems: 'flex-end', gap: 2 },
  staminaRow:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  staminaIcon:  { width: 18, height: 18 },
  staminaVal:   { color: GOLD, fontSize: 14, fontWeight: '800', fontFamily: SERIF },
  staminaSep:   { color: TEXT_DIM, fontSize: 12 },
  staminaMax:   { color: TEXT_SOFT, fontSize: 12, fontWeight: '600' },
  plusBtn: {
    backgroundColor: JADE + '22', borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
    borderWidth: 1, borderColor: JADE + '44', marginLeft: 2,
  },
  plusTxt:      { color: JADE, fontSize: 11, fontWeight: '800' },
  staminaHint:  { color: TEXT_DIM, fontSize: 9, letterSpacing: 0.3 },

  // Panel (shared)
  panel: {
    backgroundColor: PANEL_BG, borderRadius: 14,
    borderWidth: 1, borderColor: PANEL_BORDER,
    padding: 14, gap: 10,
  },

  // Compact boss-key progress bar — now outside the ScrollView, needs its own
  // horizontal margins to match the map's marginHorizontal:14 edge alignment.
  keyBar: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 14,
    marginTop:       8,
    backgroundColor: PANEL_BG,
    borderRadius:    10,
    borderWidth:     1,
    borderColor:     PANEL_BORDER,
  },
  keyBarIcon:       { width: 24, height: 24 },
  keyBarLabel: {
    color: TEXT_SOFT, fontSize: 9.5, fontWeight: '700',
    letterSpacing: 1.1, textTransform: 'uppercase', fontFamily: SERIF,
    flex: 1,
  },
  keyBarCountRow:   { flexDirection: 'row', alignItems: 'baseline' },
  keyBarCountNum:   { color: GOLD,  fontSize: 15, fontWeight: '800', fontFamily: SERIF },
  keyBarCountFull:  { color: JADE,  fontSize: 15, fontWeight: '800', fontFamily: SERIF },
  keyBarSep:        { color: TEXT_DIM, fontSize: 13 },
  keyBarReq:        { color: TEXT_SOFT, fontSize: 13, fontWeight: '600', fontFamily: SERIF },
  keyBarBadge: {
    borderWidth: 1, borderColor: TEXT_DIM + '66', borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  keyBarBadgeOpen: { borderColor: JADE + '88', backgroundColor: JADE + '18' },
  keyBarBadgeTxt: {
    color: TEXT_DIM, fontSize: 9, fontWeight: '800',
    letterSpacing: 0.9, textTransform: 'uppercase', fontFamily: SERIF,
  },
  keyBarBadgeTxtOpen: { color: JADE },
  keyBarHint: {
    color: TEXT_DIM, fontSize: 10.5, fontStyle: 'italic',
    marginHorizontal: 14, marginTop: -4,
  },
  carriedOverBadge: {
    backgroundColor: GOLD + '1A',
    borderWidth: 1,
    borderColor: GOLD + '44',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  carriedOverTxt: { color: GOLD, fontSize: 9, fontWeight: '600' },

  // Map viewport — flex:1 fills all remaining space between the fixed chrome
  // (header + keyBar) and the fixed nav bar.  No height cap: the world-space
  // camera inside HexMapLayer handles all panning and clamping.
  // The map is NOT inside a ScrollView so vertical gestures go straight to the
  // PanResponder in HexMapLayer rather than being swallowed by a scroll view.
  mapOuter: {
    flex: 1,
    marginHorizontal: 14,
    marginBottom: 4,
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: PANEL_BORDER,
  },
  // CORRECTIVE PUSH A: absolute overlay anchor for the camera diagnostics panel.
  // top-right corner of mapOuter so it doesn't overlap the map content.
  camDiagOverlay: {
    position: 'absolute',
    top:   6,
    right: 6,
    zIndex: 14000,
  },

  // mapBg removed Push 7: background is now inside HexMapLayer's MapWorld.
  neutralMapShell: {
    // Push 9: placeholder rendered when run.shift has not yet resolved.
    // Intentionally carries no shift-specific color, image, or fog palette.
    // The parent mapOuter's dark background shows through; this View
    // exists only to occupy the map slot so layout does not collapse.
    ...StyleSheet.absoluteFillObject,
  },
  mapLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#0A1820CC', gap: 10,
  },
  mapLoadingTxt: { color: TEXT_DIM, fontSize: 13, fontFamily: SERIF },
  mapErrorTxt:    { color: '#FF6B6B', fontSize: 12, textAlign: 'center', paddingHorizontal: 16, fontWeight: '700' },
  mapErrorDetail: { color: TEXT_DIM,  fontSize: 11, textAlign: 'center', paddingHorizontal: 24, marginTop: 6, lineHeight: 17 },
  mapRetryBtn: {
    marginTop:         14,
    borderWidth:       1,
    borderColor:       JADE + '88',
    borderRadius:      10,
    paddingVertical:   9,
    paddingHorizontal: 28,
    backgroundColor:   JADE + '18',
  },
  mapRetryTxt: { color: JADE, fontSize: 12, fontWeight: '800', letterSpacing: 1, fontFamily: SERIF },

  // Movement error banner — absolute overlay inside the map viewport.
  // Positioned at the map bottom-centre so it reads as a world-space message
  // without pushing any scroll content.
  moveErrorOverlay: {
    position:  'absolute',
    bottom:    14,
    left:      12,
    right:     12,
    zIndex:    20000,
    alignItems: 'center',
  },
  moveErrorBanner: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    backgroundColor: '#2A1010',
    borderRadius:    8,
    borderWidth:     1,
    borderColor:     '#FF6B6B44',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  moveErrorIcon: { width: 18, height: 18 },
  moveErrorTxt: {
    color: '#FF8A80', fontSize: 11, fontFamily: SERIF,
    flex: 1, letterSpacing: 0.3,
  },

  // (encounter banner styles removed in Push 12 — replaced by TreasureModal + MerchantModal)

  // Run info banner (real run)
  runBanner: {
    backgroundColor: '#0F2030',
    borderRadius: 8, borderWidth: 1, borderColor: JADE + '33',
    paddingVertical: 5, paddingHorizontal: 12, marginTop: -4,
  },
  runBannerTxt: {
    color: JADE + 'AA', fontSize: 10, fontFamily: SERIF,
    letterSpacing: 0.4, textAlign: 'center',
  },

  // Debug banner (debug fixture)
  debugBanner: {
    backgroundColor: '#1A2E1A', borderRadius: 8,
    borderWidth: 1, borderColor: '#4CAF5066',
    paddingVertical: 6, paddingHorizontal: 12, marginTop: -4,
  },
  debugBannerTxt: {
    color: '#81C784', fontSize: 10, fontFamily: SERIF,
    letterSpacing: 0.4, textAlign: 'center',
  },

  // Legend
  sectionTitle: {
    color: JADE, fontSize: 9.5, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: SERIF,
    marginBottom: 2,
  },
  legendRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  legendIcon:  { width: 40, height: 40 },
  legendText:  { flex: 1, gap: 2 },
  legendLabel: { color: TEXT,    fontSize: 13, fontWeight: '700', fontFamily: SERIF },
  legendDesc:  { color: TEXT_DIM, fontSize: 11, lineHeight: 15 },

  // Summary card
  summaryCard: { gap: 12 },

  // Chapter art header
  summaryArtWrapper: {
    borderRadius:   12, overflow: 'hidden',
    borderWidth:    1, height: 120,
    position:       'relative',
  },
  summaryArt: { width: '100%', height: '100%' },
  summaryClearedBadge: {
    position:       'absolute', top: 8, right: 8,
    width:          32, height: 32, borderRadius: 16,
    alignItems:     'center', justifyContent: 'center',
  },
  summaryClearedIcon: {
    color:      '#FFFFFF', fontSize: 18, fontWeight: '900',
  },

  // Chapter identity block
  summaryTitleBlock: { gap: 2 },
  summaryChapterTag: {
    fontSize:      9.5, fontWeight: '700', fontFamily: SERIF,
    letterSpacing: 1.3, textTransform: 'uppercase',
  },
  summaryTitle:  { color: TEXT, fontSize: 17, fontWeight: '800', fontFamily: SERIF },
  summaryAttempt: {
    color: TEXT_DIM, fontSize: 11, fontFamily: SERIF, marginTop: 1,
  },

  summaryDivider: { height: 1, backgroundColor: PANEL_BORDER },

  // Stats row
  summaryStats:  { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 4 },
  statCol:       { alignItems: 'center', gap: 3, flex: 1 },
  statVal:       { color: GOLD, fontSize: 16, fontWeight: '800', fontFamily: SERIF },
  statValAccent: { color: JADE },   // override for completed keys
  statLbl:       { color: TEXT_DIM, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
  statDivider:   { width: 1, backgroundColor: PANEL_BORDER, alignSelf: 'stretch' },

  // Reward rows
  rewardRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rewardLabel:      { color: TEXT_SOFT, fontSize: 12, fontWeight: '600', fontFamily: SERIF },
  rewardValue:      { color: TEXT_DIM,  fontSize: 11 },
  rewardValueAccent: { color: JADE,     fontSize: 11, fontWeight: '700', fontFamily: SERIF },

  // Reward chips (treasure + completion)
  rewardChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 2 },
  rewardChip:  {
    borderWidth: 1, borderRadius: 20,
    paddingVertical: 3, paddingHorizontal: 10,
  },
  rewardChipTxt: { fontSize: 12, fontWeight: '700', fontFamily: SERIF },

  // Challenge Chapter button
  challengeBtn: {
    borderWidth:       1,
    borderRadius:      12,
    paddingVertical:   12,
    paddingHorizontal: 16,
    alignItems:        'center',
    gap:               4,
  },
  challengeBtnTxt: {
    fontSize:      13, fontWeight: '800', fontFamily: SERIF, letterSpacing: 1,
  },
  challengeBtnSub: {
    color: TEXT_DIM, fontSize: 10, letterSpacing: 0.3,
  },

  // Challenge confirmation panel
  challengeConfirm: { gap: 10 },
  challengeConfirmTitle: {
    fontSize: 14, fontWeight: '800', fontFamily: SERIF, letterSpacing: 0.5,
  },
  challengeConfirmBody: {
    color: TEXT_DIM, fontSize: 11, lineHeight: 17,
  },
  challengeConfirmRow: {
    flexDirection: 'row', gap: 8, flexWrap: 'wrap',
  },
  challengeCancel: {
    flex: 1, borderWidth: 1, borderColor: PANEL_BORDER, borderRadius: 10,
    paddingVertical: 9, alignItems: 'center', backgroundColor: PANEL_BG,
  },
  challengeCancelTxt: {
    color: TEXT_SOFT, fontSize: 11, fontWeight: '700', fontFamily: SERIF, letterSpacing: 0.8,
  },
  challengeAction: {
    flex: 2, borderWidth: 1, borderRadius: 10,
    paddingVertical: 9, alignItems: 'center',
  },
  challengeActionTxt: {
    fontSize: 11, fontWeight: '800', fontFamily: SERIF, letterSpacing: 0.8,
  },

  // Challenge creating / error states
  challengeCreating: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4,
  },
  challengeCreatingTxt: {
    fontSize: 12, fontFamily: SERIF, letterSpacing: 0.3,
  },
  challengeErrorTxt: {
    color: '#FF8A80', fontSize: 11, fontFamily: SERIF,
  },
});

// Bottom nav
const sNav = StyleSheet.create({
  bar: {
    flexDirection: 'row', backgroundColor: UI.sanctuaryBg,
    borderTopWidth: 1, borderTopColor: '#E8C86830', paddingTop: 4,
  },
  item:  { flex: 1, alignItems: 'center', gap: 0, paddingTop: 2 },
  icon:  { width: 38, height: 38 },
  label: {
    fontSize: 9.5, fontWeight: '900', letterSpacing: 0.7,
    textAlign: 'center', textTransform: 'uppercase',
  },
});

// Dev diagnostics
const sDev = StyleSheet.create({
  panel: {
    backgroundColor: '#0C1E10',
    borderRadius: 10, borderWidth: 1, borderColor: '#2E7D4466',
    padding: 12, gap: 4,
  },
  heading: {
    color: '#66BB6A', fontSize: 9.5, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase', fontFamily: SERIF,
    marginBottom: 4,
  },
  subhead: {
    color: '#4CAF50AA', fontSize: 8.5, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', fontFamily: SERIF,
    marginTop: 2,
  },
  row:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  key:  { color: '#4CAF5088', fontSize: 10, fontFamily: SERIF, minWidth: 52 },
  val:  { color: '#A5D6A7', fontSize: 10, fontFamily: SERIF, flex: 1 },
  divider: { height: 1, backgroundColor: '#2E7D4444', marginVertical: 4 },
  mismatchBanner: {
    backgroundColor: '#7f1d1d44',
    borderWidth: 1, borderColor: '#ef4444aa',
    borderRadius: 4, padding: 6, marginTop: 4,
  },
  mismatchText: {
    color: '#fca5a5', fontSize: 9, fontFamily: SERIF, fontWeight: '700',
    lineHeight: 13,
  },
});

// CORRECTIVE PUSH A — Camera diagnostics panel styles
const sCamDiag = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 8, borderWidth: 1, borderColor: '#334455',
    paddingHorizontal: 10, paddingVertical: 8,
    minWidth: 188,
  },
  header: {
    color: '#e2e8f0', fontSize: 9, fontWeight: '800',
    letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4,
  },
  sectionHead: {
    color: '#94a3b8', fontSize: 8, fontWeight: '700',
    letterSpacing: 0.7, marginTop: 2,
  },
  divider:   { height: 1, backgroundColor: '#334455', marginVertical: 4 },
  row:       { flexDirection: 'row', marginTop: 2 },
  label:     { color: '#64748b', fontSize: 9, fontFamily: 'monospace', minWidth: 96 },
  val:       { color: '#a3e635', fontSize: 9, fontFamily: 'monospace' },
  good:      { color: '#4ade80' },
  warn:      { color: '#fb923c' },
  // Push 4A: hard assertion banner shown when authored-world sizing is not active.
  failBanner: {
    backgroundColor: '#7f1d1d',
    borderRadius: 4, borderWidth: 1, borderColor: '#ef4444',
    paddingHorizontal: 8, paddingVertical: 6, marginBottom: 6,
  },
  failText: { color: '#fca5a5', fontSize: 9, fontWeight: '800', lineHeight: 14 },
  // Push 4A.1: status row at the bottom of the panel.
  statusGood: { color: '#4ade80', fontSize: 10, fontWeight: '800', marginTop: 4 },
  statusBad:  { color: '#fb923c', fontSize: 10, fontWeight: '800', marginTop: 4 },
});
