/**
 * FogboundTileMap — Hex tile fog-of-war chapter map renderer (Push 9 shell).
 *
 * This component renders the full-screen Fogbound Tile Map UI for chapters
 * configured with mapMode: 'fogbound_tiles'. All game logic (tile reveal on
 * adjacency, stamina spend, battle/reward/merchant triggers) is OUT OF SCOPE
 * for Push 9 — only the visual shell ships here.
 *
 * Layout (top → bottom):
 *   1. Header row  — back arrow, info, chapter name, Phase badge, stamina pill
 *   2. Key Fragment card — current / target count + unlock label
 *   3. Boss Gate node  — locked padlock when key fragments insufficient
 *   4. Hex tile grid   — ~56 tiles (7 × 8), fog overlay on unrevealed
 *   5. Tile Outcomes legend bar
 *   6. Chapter progress card
 *
 * Merchant rates come from MERCHANT_RATES in fogTileMap.ts (not inline).
 * onTilePress is a no-op stub for Push 9.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";

import type { Chapter } from "@/src/game/chapterJourney";
import {
  type ChapterFogMapConfig,
  type FogTile,
  TILE_OUTCOMES,
  MERCHANT_RATES,
} from "@/src/game/fogTileMap";
import { UI, SPACING } from "@/src/theme/ui";
import { COLORS, RADIUS } from "@/src/theme/colors";

// ── Tile geometry ─────────────────────────────────────────────────────────────

const TILE_W = 44;        // hex tile width
const TILE_H = 38;        // hex tile height (flat-top orientation)
const TILE_GAP_H = 2;     // horizontal gap between tiles
const TILE_GAP_V = 2;     // vertical gap between tile rows
const HEX_OFFSET = TILE_W / 2; // odd-row offset for staggered hex grid

// ── Tile accent colours (matches TILE_OUTCOMES) ───────────────────────────────

const TILE_ACCENT: Record<string, string> = {
  battle:    '#EF4444',
  treasure:  '#D4AF37',
  merchant:  '#4FD8C4',
  area_boss: '#F97316',
  boss_gate: '#8B5CF6',
  empty:     '#334155',
};

const TILE_ICON: Record<string, string> = {
  battle:    'flash',
  treasure:  'gift',
  merchant:  'storefront',
  area_boss: 'skull',
  boss_gate: 'lock-closed',
  empty:     'ellipse-outline',
};

// ── Props ─────────────────────────────────────────────────────────────────────

export interface FogboundTileMapProps {
  chapter: Chapter;
  mapConfig: ChapterFogMapConfig;
  /** ID of the tile the player currently occupies. */
  playerTileId: string;
  /** Number of chapter key fragments the player has collected. */
  keyFragmentsCollected: number;
  /** Current stamina value. */
  stamina: number;
  /** Maximum stamina value. */
  maxStamina: number;
  /** Called when the player taps a tile — no-op stub in Push 9. */
  onTilePress?: (tile: FogTile) => void;
  /** Called when the back button is pressed. */
  onBack?: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FogboundTileMap({
  chapter,
  mapConfig,
  playerTileId,
  keyFragmentsCollected,
  stamina,
  maxStamina,
  onTilePress,
  onBack,
}: FogboundTileMapProps) {
  const gateUnlocked = keyFragmentsCollected >= mapConfig.keyFragmentsRequired;
  const exploredCount = mapConfig.tiles.filter((t) => t.visited).length;
  const progressPct = Math.round((exploredCount / mapConfig.totalTiles) * 100);

  // Group tiles by row for layout
  const maxRow = Math.max(...mapConfig.tiles.map((t) => t.row));
  const maxCol = Math.max(...mapConfig.tiles.map((t) => t.col));
  const rows: FogTile[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    rows.push(mapConfig.tiles.filter((t) => t.row === r));
  }

  const gridW = (maxCol + 1) * (TILE_W + TILE_GAP_H) + HEX_OFFSET;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. Header row ── */}
      <View style={styles.header}>
        <Pressable style={styles.headerBtn} onPress={onBack} hitSlop={10}>
          <Ionicons name="chevron-back" size={20} color={UI.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.phaseBadge}>
            <Text style={styles.phaseBadgeTxt}>PHASE 1</Text>
          </View>
          <Text style={styles.chapterName} numberOfLines={1}>
            {chapter.theme}
          </Text>
        </View>

        {/* Stamina pill */}
        <View style={styles.staminaPill}>
          <Ionicons name="footsteps" size={12} color={UI.teal} />
          <Text style={styles.staminaTxt}>
            {stamina}/{maxStamina}
          </Text>
        </View>

        {/* Movement cost label */}
        <View style={styles.moveCostPill}>
          <Text style={styles.moveCostTxt}>-1 / move</Text>
        </View>

        <Pressable style={styles.headerBtn} hitSlop={10}>
          <Ionicons name="information-circle-outline" size={20} color={UI.textDim} />
        </Pressable>
      </View>

      {/* ── 2. Key Fragment card ── */}
      <View style={styles.keyFragCard}>
        <View style={styles.keyFragLeft}>
          <Ionicons name="key" size={18} color="#D4AF37" />
          <View>
            <Text style={styles.keyFragCount}>
              {keyFragmentsCollected} / {mapConfig.keyFragmentsRequired}
            </Text>
            <Text style={styles.keyFragLabel}>Chapter Key Fragments</Text>
          </View>
        </View>
        <Text style={styles.keyFragHint} numberOfLines={2}>
          Collect {mapConfig.keyFragmentsRequired} to unlock the Chapter Boss Gate
        </Text>
      </View>

      {/* ── 3. Chapter Boss Gate node ── */}
      <View style={styles.bossGateRow}>
        <View style={[styles.bossGateNode, gateUnlocked && styles.bossGateUnlocked]}>
          <Ionicons
            name={gateUnlocked ? "skull" : "lock-closed"}
            size={22}
            color={gateUnlocked ? '#F97316' : UI.textDim}
          />
          <Text style={[styles.bossGateTxt, gateUnlocked && { color: '#F97316' }]}>
            {gateUnlocked ? 'BOSS GATE — OPEN' : 'BOSS GATE — LOCKED'}
          </Text>
        </View>
      </View>

      {/* ── 4. Hex tile grid ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.gridScroll, { minWidth: gridW + SPACING.md * 2 }]}
      >
        <View style={styles.grid}>
          {rows.map((rowTiles, rowIdx) => {
            const isOddRow = rowIdx % 2 === 1;
            return (
              <View
                key={`row-${rowIdx}`}
                style={[
                  styles.tileRow,
                  isOddRow && { marginLeft: HEX_OFFSET },
                ]}
              >
                {rowTiles.map((tile) => {
                  const isPlayer = tile.id === playerTileId;
                  const accent = TILE_ACCENT[tile.type] ?? UI.textDim;
                  const icon   = TILE_ICON[tile.type] ?? 'help-circle-outline';
                  const fogged = !tile.revealed;

                  return (
                    <Pressable
                      key={tile.id}
                      style={[
                        styles.tile,
                        { borderColor: fogged ? '#334155' : accent + '60' },
                        tile.visited && styles.tileVisited,
                        isPlayer && styles.tilePlayer,
                      ]}
                      onPress={() => onTilePress?.(tile)}
                      testID={`fog-tile-${tile.id}`}
                    >
                      {fogged ? (
                        <View style={styles.fogOverlay}>
                          <Ionicons name="cloud" size={16} color="#334155" />
                        </View>
                      ) : (
                        <>
                          <Ionicons name={icon as any} size={14} color={accent} />
                          {tile.keyFragment && (
                            <View style={styles.keyFragDot} />
                          )}
                        </>
                      )}

                      {/* Player token */}
                      {isPlayer && (
                        <View style={styles.playerToken}>
                          <Ionicons name="person" size={9} color={UI.onGold} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* ── 5. Tile Outcomes legend bar ── */}
      <View style={styles.legendCard}>
        <Text style={styles.legendTitle}>TILE OUTCOMES</Text>
        <View style={styles.legendGrid}>
          {TILE_OUTCOMES.map((outcome) => (
            <View key={outcome.type} style={styles.legendItem}>
              <View style={[styles.legendIcon, { backgroundColor: outcome.accentColor + '22', borderColor: outcome.accentColor + '55' }]}>
                <Ionicons name={outcome.icon as any} size={14} color={outcome.accentColor} />
              </View>
              <View style={styles.legendText}>
                <Text style={[styles.legendLabel, { color: outcome.accentColor }]}>
                  {outcome.label}
                </Text>
                <Text style={styles.legendDesc} numberOfLines={2}>
                  {outcome.description}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Merchant rates stub — visible to indicate data source is fogTileMap.ts */}
      <View style={styles.merchantCard}>
        <View style={styles.merchantHeader}>
          <Ionicons name="storefront" size={14} color={UI.teal} />
          <Text style={styles.merchantTitle}>MERCHANT RATES</Text>
        </View>
        <View style={styles.merchantGrid}>
          {Object.entries(MERCHANT_RATES).map(([itemId, cost]) => (
            <View key={itemId} style={styles.merchantRow}>
              <Text style={styles.merchantItemName}>
                {itemId.replace(/_/g, ' ')}
              </Text>
              <Text style={styles.merchantCost}>{cost} ⚙</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── 6. Chapter progress card ── */}
      <View style={styles.progressCard}>
        <View style={styles.progressCardLeft}>
          <View style={[styles.chapterThumb, { backgroundColor: chapter.accentColor + '22', borderColor: chapter.accentColor + '55' }]}>
            <Ionicons name={chapter.icon as any} size={24} color={chapter.accentColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.progressChapterNum}>Chapter {chapter.number}</Text>
            <Text style={styles.progressChapterName} numberOfLines={1}>{chapter.theme}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%` as any, backgroundColor: chapter.accentColor }]} />
        </View>
        <Text style={styles.progressPct}>{progressPct}%</Text>
        <Text style={styles.progressExplored}>
          Explored {exploredCount}/{mapConfig.totalTiles} tiles
        </Text>

        {/* Rewards preview chips */}
        <View style={styles.rewardChips}>
          {chapter.completionXp && (
            <View style={styles.rewardChip}>
              <Ionicons name="star" size={10} color="#D4AF37" />
              <Text style={styles.rewardChipTxt}>+{chapter.completionXp} XP</Text>
            </View>
          )}
          <View style={styles.rewardChip}>
            <Ionicons name="shield-checkmark" size={10} color={UI.teal} />
            <Text style={styles.rewardChipTxt}>Chapter Stars</Text>
          </View>
          <View style={styles.rewardChip}>
            <Ionicons name="key" size={10} color={chapter.accentColor} />
            <Text style={styles.rewardChipTxt}>Boss Access</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: UI.sanctuaryBg,
  },
  scrollContent: {
    paddingBottom: 80,
    gap: SPACING.sm,
  },

  // Header
  header: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:              SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical:  SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: UI.sanctuaryBorder,
  },
  headerBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: UI.sanctuaryPanel,
    borderWidth:     1,
    borderColor:     UI.sanctuaryBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerCenter: {
    flex:      1,
    gap:       2,
    alignItems: 'flex-start',
  },
  phaseBadge: {
    backgroundColor: UI.gold + '22',
    borderRadius:    RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderWidth:      1,
    borderColor:      UI.gold + '40',
  },
  phaseBadgeTxt: {
    fontSize:      9,
    fontWeight:    '800',
    color:         UI.gold,
    letterSpacing: 1.2,
  },
  chapterName: {
    fontSize:   14,
    fontWeight: '700',
    color:      UI.text,
  },
  staminaPill: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: UI.teal + '18',
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     UI.teal + '40',
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  staminaTxt: {
    fontSize:   12,
    fontWeight: '700',
    color:      UI.teal,
  },
  moveCostPill: {
    backgroundColor: UI.sanctuaryPanel,
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     UI.sanctuaryBorder,
    paddingHorizontal: 6,
    paddingVertical:   3,
  },
  moveCostTxt: {
    fontSize:   10,
    color:      UI.textDim,
    fontWeight: '600',
  },

  // Key Fragment card
  keyFragCard: {
    marginHorizontal:  SPACING.md,
    backgroundColor:   UI.sanctuaryPanel,
    borderRadius:      RADIUS.md,
    borderWidth:       1,
    borderColor:       '#D4AF37' + '40',
    padding:           SPACING.sm,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               SPACING.sm,
  },
  keyFragLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.xs,
  },
  keyFragCount: {
    fontSize:   16,
    fontWeight: '800',
    color:      '#D4AF37',
  },
  keyFragLabel: {
    fontSize:   11,
    color:      UI.textSoft,
    fontWeight: '600',
  },
  keyFragHint: {
    flex:       1,
    fontSize:   11,
    color:      UI.textDim,
    lineHeight: 16,
    textAlign:  'right',
  },

  // Boss Gate
  bossGateRow: {
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  bossGateNode: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             SPACING.xs,
    backgroundColor: '#1A0B0580',
    borderRadius:    RADIUS.md,
    borderWidth:     2,
    borderColor:     UI.textDim + '50',
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
  },
  bossGateUnlocked: {
    borderColor:     '#F97316' + '60',
    backgroundColor: '#F97316' + '10',
  },
  bossGateTxt: {
    fontSize:      12,
    fontWeight:    '800',
    color:         UI.textDim,
    letterSpacing: 0.8,
  },

  // Grid
  gridScroll: {
    paddingHorizontal: SPACING.md,
    paddingVertical:   SPACING.sm,
  },
  grid: {
    gap: TILE_GAP_V,
  },
  tileRow: {
    flexDirection: 'row',
    gap:           TILE_GAP_H,
  },
  tile: {
    width:           TILE_W,
    height:          TILE_H,
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     '#334155',
    backgroundColor: UI.sanctuaryPanel,
    alignItems:      'center',
    justifyContent:  'center',
    position:        'relative',
  },
  tileVisited: {
    backgroundColor: UI.sanctuaryCard,
  },
  tilePlayer: {
    borderColor: UI.gold,
    borderWidth: 2,
  },
  fogOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B1825CC',
    borderRadius:    RADIUS.sm,
    alignItems:      'center',
    justifyContent:  'center',
  },
  keyFragDot: {
    position:        'absolute',
    top:             3,
    right:           3,
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: '#D4AF37',
  },
  playerToken: {
    position:        'absolute',
    bottom:          3,
    right:           3,
    width:           14,
    height:          14,
    borderRadius:    7,
    backgroundColor: UI.gold,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // Legend
  legendCard: {
    marginHorizontal: SPACING.md,
    backgroundColor:  UI.sanctuaryPanel,
    borderRadius:     RADIUS.md,
    borderWidth:      1,
    borderColor:      UI.sanctuaryBorder,
    padding:          SPACING.sm,
  },
  legendTitle: {
    fontSize:      10,
    fontWeight:    '800',
    color:         UI.textDim,
    letterSpacing: 1,
    marginBottom:  SPACING.xs,
  },
  legendGrid: {
    gap: SPACING.xs,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           SPACING.xs,
  },
  legendIcon: {
    width:        28,
    height:       28,
    borderRadius: RADIUS.sm,
    borderWidth:  1,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    fontSize:   12,
    fontWeight: '700',
  },
  legendDesc: {
    fontSize:   11,
    color:      UI.textDim,
    lineHeight: 15,
  },

  // Merchant rates
  merchantCard: {
    marginHorizontal: SPACING.md,
    backgroundColor:  UI.sanctuaryPanel,
    borderRadius:     RADIUS.md,
    borderWidth:      1,
    borderColor:      UI.teal + '30',
    padding:          SPACING.sm,
  },
  merchantHeader: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.xs,
    marginBottom:  SPACING.xs,
  },
  merchantTitle: {
    fontSize:      10,
    fontWeight:    '800',
    color:         UI.teal,
    letterSpacing: 1,
  },
  merchantGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.xs,
  },
  merchantRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: UI.sanctuaryCard,
    borderRadius:    RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  merchantItemName: {
    fontSize:      11,
    color:         UI.textSoft,
    textTransform: 'capitalize',
  },
  merchantCost: {
    fontSize:   11,
    fontWeight: '700',
    color:      UI.teal,
  },

  // Progress card
  progressCard: {
    marginHorizontal: SPACING.md,
    backgroundColor:  UI.sanctuaryPanel,
    borderRadius:     RADIUS.md,
    borderWidth:      1,
    borderColor:      UI.sanctuaryBorder,
    padding:          SPACING.md,
    gap:              SPACING.xs,
  },
  progressCardLeft: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
    marginBottom:  4,
  },
  chapterThumb: {
    width:        48,
    height:       48,
    borderRadius: RADIUS.sm,
    borderWidth:  1,
    alignItems:   'center',
    justifyContent: 'center',
    flexShrink:   0,
  },
  progressChapterNum: {
    fontSize:   11,
    color:      UI.textDim,
    fontWeight: '600',
  },
  progressChapterName: {
    fontSize:   14,
    fontWeight: '700',
    color:      UI.text,
  },
  progressBarWrap: {
    height:          8,
    backgroundColor: UI.sanctuaryCard,
    borderRadius:    4,
    overflow:        'hidden',
  },
  progressBarFill: {
    height:       8,
    borderRadius: 4,
    minWidth:     4,
  },
  progressPct: {
    fontSize:   12,
    fontWeight: '700',
    color:      UI.textSoft,
    alignSelf:  'flex-end',
    marginTop:  -4,
  },
  progressExplored: {
    fontSize: 12,
    color:    UI.textDim,
  },
  rewardChips: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           SPACING.xs,
    marginTop:     4,
  },
  rewardChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             4,
    backgroundColor: UI.sanctuaryCard,
    borderRadius:    RADIUS.sm,
    borderWidth:     1,
    borderColor:     UI.sanctuaryBorder,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
  rewardChipTxt: {
    fontSize:   11,
    fontWeight: '600',
    color:      UI.textSoft,
  },
});
