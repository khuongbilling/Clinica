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
 * Gate unlock logic:
 *   areaBossCount === 0  → gate eligible when reached/discovered (0/0 keys)
 *   areaBossCount  >  0  → gate locked until areaBossKeysCollected >= areaBossCount
 */

import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HexMapLayer }                    from '@/src/components/journey/HexMapLayer';
import type { HexMapTile }                from '@/src/components/journey/HexMapLayer';
import { CHAPTERS }                        from '@/src/game/chapterJourney';
import { generateDebugFixture, JOURNEY_MAP_FIXTURE } from '@/src/game/journeyMap/fixture';
import { loadOrCreateJourneyRun, challengeChapter, rechallengeMap } from '@/src/game/journeyMap/journeyRunLifecycle';
import {
  checkRechallengeEligibility,
  claimAreaBossKey,
  createChapterBossKeyState,
  RECHALLENGE_MAP_LABEL,
  CHAPTER_BOSS_KEY_REQUIREMENT,
} from '@/src/game/journeyMap/chapterBossKeys';
import { journeyRunRepository }            from '@/src/game/journeyMap/journeyRunRepository';
import { validateMove, applyMoveToRun, MOVE_STAMINA_COST } from '@/src/game/journeyMap/movement';
import {
  resolveNone, resolveBattleWin, resolveAreaBossWin,
  resolveTreasureClaim, resolveMerchantVisit, resolveChapterBossWin,
  deriveEnemyId, getAreaBossEnemyId, getChapterBossEnemyId,
  TREASURE_REWARDS,
  type TreasureReward,
} from '@/src/game/journeyMap/encounterResolution';
import { claimChapterBossKeyOnServer } from '@/src/game/journeyMap/journeyRunRepository';
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

// ── Journey raster assets ────────────────────────────────────────────────────
const ASSET = {
  mapBg:          require('@/assets/ui/journey/map/map-platform-background.webp')     as number,
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
    id:        t.id,
    q:         t.q,
    r:         t.r,
    visibility: t.visibility,
    current:   t.current,
    encounter: t.encounter,
    chestTier: t.chestTier,
    isGate:    t.id === gateId,
  };
}

/** True when the gate tile has been discovered (revealed or frontier). */
function isGateDiscovered(run: JourneyRun): boolean {
  if (!run.gateAnchorTileId) return false;
  const gate = run.tiles.find(t => t.id === run.gateAnchorTileId);
  return gate?.visibility === 'revealed' || gate?.visibility === 'frontier';
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

/** Dev diagnostics panel — always visible on this dev route. */
function DevDiagnostics({ run }: { run: JourneyRun }) {
  const { counts, tiers } = useMemo(() => countEncounters(run.tiles), [run.tiles]);
  const exploredPct = run.tileCount > 0
    ? Math.round((run.exploredTileCount / run.tileCount) * 100) : 0;

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
        <Text style={sDev.val}>{run.gateAnchorTileId ?? '—'} · {run.areaBossKeysCollected}/{run.areaBossCount} keys</Text>
      </Text>
      <Text style={sDev.row}>
        <Text style={sDev.key}>Start </Text>
        <Text style={sDev.val}>{run.startTileId} → current: {run.currentTileId}</Text>
      </Text>
      <Text style={sDev.row}>
        <Text style={sDev.key}>Created</Text>
        <Text style={sDev.val}>{run.createdAt.slice(0, 19).replace('T', ' ')}</Text>
      </Text>
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
  } = useLocalSearchParams<{
    chapterId:            string;
    debug?:               string;
    resolvedTileId?:      string;
    outcome?:             string;
    journeyIsAreaBoss?:   string;
    journeyIsChapterBoss?: string;
  }>();
  const router               = useRouter();
  const insets               = useSafeAreaInsets();
  const { player, spendStamina, applyRewards, updateState, applyFogMapChapterBossRewards } = usePlayer();

  const { height: windowHeight } = useWindowDimensions();
  // Responsive map height: ~45 % of the window, clamped between 240 and 480 px.
  const mapContainerHeight = Math.min(480, Math.max(240, Math.round(windowHeight * 0.45)));

  const bottomPad = Math.max(insets.bottom, 8);
  const [mapSize, setMapSize] = useState({ w: 332, h: mapContainerHeight });

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

  useEffect(() => {
    // Debug fixture bypasses the real run entirely.
    if (debugTiles !== null) { setRunLoading(false); return; }

    // No session — fall back to the static fixture so the map is always
    // visible on this dev route even without a logged-in player.
    if (!player?.id) { setRunLoading(false); return; }

    let cancelled = false;
    setRunLoading(true);
    setRunError(null);

    loadOrCreateJourneyRun(player.id, chNum, journeyRunRepository)
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
        claimChapterBossKeyOnServer(player.id, chNum, claimKey)
          .catch(e => console.warn('[fog-map] claimChapterBossKeyOnServer failed:', e));
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
  const mapTiles = useMemo<readonly HexMapTile[]>(() => {
    if (debugTiles !== null) return debugTiles;
    if (run) return run.tiles.map(t => toHexMapTile(t, run.gateAnchorTileId));
    // No session (no player) — show the static fixture so the dev route always
    // has something visible even without a logged-in player.
    if (!player?.id) return JOURNEY_MAP_FIXTURE;
    return [];
  }, [run, debugTiles, player?.id]);

  // Gate unlock: 0-boss maps (ch1–3) unlock when gate is discovered; otherwise
  // require CHAPTER_BOSS_KEY_REQUIREMENT (3) chapter-level keys — a fixed
  // threshold that does NOT vary with the current run's area-boss count.
  const areaBossCount     = run?.areaBossCount ?? 0;
  // Chapter-level key count (Task 570): chapter_boss_keys persists across
  // Rechallenge Map so keys earned on Run 1 are still visible on Run 2.
  // Falls back to run-level areaBossKeysCollected for pre-570 saves or first run.
  const chapterKeyEntry   = player?.chapter_boss_keys?.[String(chNum)];
  const keysCollected     = chapterKeyEntry?.keys_collected ?? run?.areaBossKeysCollected ?? 0;
  const zeroKeyMap        = areaBossCount === 0;
  const gateDiscovered    = run ? isGateDiscovered(run) : false;
  // Gate requires the canonical 3-key total, not the number of bosses on the
  // current map.  Zero-boss chapters (ch1–3) keep the discovery-based fallback.
  const gateUnlocked      = zeroKeyMap ? gateDiscovered : keysCollected >= CHAPTER_BOSS_KEY_REQUIREMENT;

  // Stats panel values
  const totalTiles    = run?.tileCount         ?? 0;
  const exploredTiles = run?.exploredTileCount  ?? 0;
  const exploredPct   = totalTiles > 0 ? Math.round((exploredTiles / totalTiles) * 100) : 0;

  // Chapter accent color (per-chapter warm-dark tint)
  const accentColor = chapter?.accentColor ?? UI.jade;

  // Run status helpers
  const isCleared = run?.status === 'cleared';

  // ── Rechallenge Map eligibility ────────────────────────────────────────────
  // Derived from run-level key data.  keysCollected here uses areaBossKeysCollected
  // (run-scoped) which reflects all keys earned across prior attempts for this
  // chapter because resolveAreaBossWin carries them forward.
  const rechallengeKeyState = useMemo(
    () => createChapterBossKeyState(chNum, run?.areaBossKeysCollected ?? 0),
    [chNum, run?.areaBossKeysCollected],
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
      },
    });
  }, [router, chNum]);

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
  }, [run, gateUnlocked, areaBossCount, keysCollected, chNum, navigateToBattle, showInlineError]);

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
      const newRun = await challengeChapter(player.id, chNum, journeyRunRepository);
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

      // Apply movement (fog state + visited/current flags).
      let afterMove = applyMoveToRun(run, tile.id);
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
            <Pressable style={s.plusBtn} testID="stamina-refill">
              <Text style={s.plusTxt}>＋</Text>
            </Pressable>
          </View>
          <Text style={s.staminaHint}>Movement costs {ENCOUNTER_COST} stamina</Text>
        </View>

        <Pressable style={s.headerBtn} testID="fog-map-info">
          <Text style={s.headerIcon}>ⓘ</Text>
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

      {/* ── Scrollable body ───────────────────────────────────────────────── */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: 68 + bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── 2. Key-fragment panel ──────────────────────────────────────── */}
        <Panel style={s.fragmentPanel}>
          <Image source={ASSET.keyFragment} style={s.fragmentImg} contentFit="contain" />
          <View style={s.fragmentBody}>
            <View style={s.fragmentCountRow}>
              <Text style={s.fragmentCount}>{keysCollected}</Text>
              <Text style={s.fragmentSep}> / </Text>
              <Text style={s.fragmentRequired}>{areaBossCount}</Text>
              <Text style={s.fragmentUnit}> Keys</Text>
            </View>
            <Text style={s.fragmentHint}>
              {zeroKeyMap
                ? 'No Area Bosses on this map — the gate opens when you find it.'
                : `Defeat Area Bosses to collect key fragments.\nGather all ${areaBossCount} to unlock the Chapter Boss Gate.`}
            </Text>
          </View>
        </Panel>

        {/* ── 3. Chapter Boss Gate ──────────────────────────────────────── */}
        <View style={s.gateSection}>
          <Image
            source={gateUnlocked ? ASSET.gateUnlocked : ASSET.gateLocked}
            style={s.gateImg}
            contentFit="contain"
            testID="boss-gate-art"
          />
          <View style={s.gateLabel}>
            <Text style={[s.gateStatus, gateUnlocked && s.gateStatusOpen]}>
              {run?.chapterBossDefeated
                ? '✓ CHAPTER BOSS DEFEATED'
                : gateUnlocked ? '⚔ BOSS GATE OPEN' : '🔒 BOSS GATE LOCKED'}
            </Text>
            <Text style={s.gateSubtext}>
              {run?.chapterBossDefeated
                ? 'Chapter cleared!'
                : gateUnlocked
                  ? 'Tap the gate tile on the map — or enter below'
                  : zeroKeyMap
                    ? 'Find the gate tile to enter'
                    : `${keysCollected} / ${areaBossCount} key fragments collected`}
            </Text>
          </View>
          {/* "ENTER" button — supplementary to gate tile tap */}
          {gateUnlocked && !run?.chapterBossDefeated && (
            <Pressable
              style={s.gateEnterBtn}
              onPress={handleGateTap}
              testID="boss-gate-enter"
            >
              <Text style={s.gateEnterTxt}>ENTER CHAPTER BOSS</Text>
            </Pressable>
          )}
        </View>

        {/* ── 4. Map viewport ───────────────────────────────────────────── */}
        <View
          style={[s.mapOuter, { height: mapContainerHeight }]}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            setMapSize({ w: Math.floor(width), h: Math.floor(height) });
          }}
        >
          <Image source={ASSET.mapBg} style={s.mapBg} contentFit="cover" testID="map-background" />

          {runLoading && !debugTiles ? (
            <View style={s.mapLoadingOverlay}>
              <ActivityIndicator size="large" color={UI.jade} />
              <Text style={s.mapLoadingTxt}>Loading map…</Text>
            </View>
          ) : runError ? (
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
          ) : (
            <HexMapLayer
              containerWidth={mapSize.w}
              containerHeight={mapSize.h}
              tiles={mapTiles}
              onTilePress={handleTilePress}
            />
          )}
        </View>

        {/* ── 4b. Move-error banner (insufficient stamina) ──────────────── */}
        {moveError !== null && (
          <View style={s.moveErrorBanner}>
            <Image source={STAMINA_EMBLEM} style={s.moveErrorIcon} contentFit="contain" />
            <Text style={s.moveErrorTxt}>{moveError}</Text>
          </View>
        )}

        {/* ── 4c. No encounter stub — real modals rendered below ────────── */}

        {/* ── 4d. Debug / run info banners ──────────────────────────────── */}
        {debugTiles !== null ? (
          <View style={s.debugBanner}>
            <Text style={s.debugBannerTxt}>
              🛠 DEBUG MAP — {debugTiles.length} tiles · drag to explore · ?debug=N to change
            </Text>
          </View>
        ) : run !== null ? (
          <View style={s.runBanner}>
            <Text style={s.runBannerTxt}>
              Attempt #{run.attemptNumber} · seed {run.seed.slice(0, 8)}… · {totalTiles} tiles
            </Text>
          </View>
        ) : null}

        {/* ── 5. Dev diagnostics (real run only, dev route) ─────────────── */}
        {run !== null && debugTiles === null && (
          <DevDiagnostics run={run} />
        )}

        {/* ── 6. Tile-outcome legend ────────────────────────────────────── */}
        <Panel>
          <Text style={s.sectionTitle}>TILE OUTCOMES</Text>
          {LEGEND_ITEMS.map((item) => (
            <LegendRow key={item.key} src={item.src} label={item.label} desc={item.desc} />
          ))}
        </Panel>

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
              <Text style={s.statVal}>{exploredTiles} / {totalTiles}</Text>
              <Text style={s.statLbl}>Tiles Visited</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statCol}>
              <Text style={[
                s.statVal,
                areaBossCount > 0 && keysCollected >= areaBossCount && s.statValAccent,
              ]}>
                {keysCollected} / {areaBossCount}
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
                        randomised map. Your {run.areaBossKeysCollected}/{CHAPTER_BOSS_KEY_REQUIREMENT} collected
                        boss key{run.areaBossKeysCollected !== 1 ? 's' : ''} carry forward —
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
                        New map · keys carry forward ({run.areaBossKeysCollected}/{CHAPTER_BOSS_KEY_REQUIREMENT})
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
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 14, gap: 12, paddingTop: 10 },

  // Completion badge strip (between header and scroll body)
  completionBadgeWrap: {
    paddingHorizontal: 14,
    paddingVertical:   6,
    borderBottomWidth: 1,
    borderBottomColor: PANEL_BORDER,
  },

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

  // Key-fragment panel
  fragmentPanel:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  fragmentImg:      { width: 56, height: 56 },
  fragmentBody:     { flex: 1, gap: 4 },
  fragmentCountRow: { flexDirection: 'row', alignItems: 'baseline' },
  fragmentCount:    { color: GOLD,      fontSize: 22, fontWeight: '800', fontFamily: SERIF },
  fragmentSep:      { color: TEXT_DIM,  fontSize: 16 },
  fragmentRequired: { color: TEXT_SOFT, fontSize: 18, fontWeight: '600', fontFamily: SERIF },
  fragmentUnit:     { color: TEXT_DIM,  fontSize: 12, marginLeft: 2 },
  fragmentHint:     { color: TEXT_DIM,  fontSize: 11, lineHeight: 16 },

  // Boss gate
  gateSection:    { alignItems: 'center', gap: 8, paddingVertical: 4 },
  gateImg:        { width: 180, height: 180 },
  gateLabel:      { alignItems: 'center', gap: 3 },
  gateStatus: {
    color: TEXT_DIM, fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', fontFamily: SERIF,
  },
  gateStatusOpen: { color: JADE },
  gateSubtext:    { color: TEXT_DIM, fontSize: 11 },
  gateEnterBtn: {
    borderWidth:       1,
    borderColor:       JADE + '80',
    borderRadius:      10,
    paddingVertical:   9,
    paddingHorizontal: 24,
    backgroundColor:   JADE + '18',
    alignItems:        'center',
    marginTop:         2,
  },
  gateEnterTxt: {
    color:         JADE,
    fontSize:      12,
    fontWeight:    '800',
    fontFamily:    SERIF,
    letterSpacing: 1,
  },

  // Map viewport — height is set dynamically via inline style (useWindowDimensions).
  mapOuter: {
    borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: PANEL_BORDER,
    position: 'relative',
  },
  mapBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
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

  // Movement error banner (insufficient stamina)
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
    marginTop:       -4,
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
});
