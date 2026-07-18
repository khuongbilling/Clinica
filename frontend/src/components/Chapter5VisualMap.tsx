/**
 * Chapter5VisualMap — visual game-map path for Chapter 5's 8 nodes.
 *
 * Renders the eight Chapter 5 nodes (Building the Sanctuary — Realm intro arc)
 * as a zigzag connected path with SVG cubic-bezier curves.
 * Emerald accent (#34D399); Realm node styled prominently in jade (#10B981);
 * Ward Defense node in orange (#FB923C).
 *
 * P11 anticipation hooks:
 *  · After c5p2 (Realm) cleared: "Sanctuary Growing…" teaser
 *  · After c5p6 (Ward Defense) cleared: "Finale Approaches" teaser
 *  · Locked mini-boss shows skull-outline silhouette in muted emerald
 *  · Misted Chapter 6 gate below the canvas.
 *
 * Used inside ChapterJourneyMap when Chapter 5 is the expanded chapter.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from "react-native";

import { CHAPTERS, type ChapterPart } from "@/src/game/chapterJourney";
import { ENEMIES } from "@/src/game/content";
import {
  computeJourneyReward,
  getJourneyNodeDef,
} from "@/src/game/journeyRewards";
import { COLORS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";
import { MapNodeShape, type MapNodeStatus } from "./MapNodeShape";
import { HeroMapToken } from "./HeroMapToken";
import { MissionPopupModal } from "./MissionPopupModal";
import { PaintedMapPath } from "./PaintedMapPath";
import { useVisualMapAnims } from "./VisualMapHooks";

// ── Type visual config ────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  story:           "#B0DEFF",
  memory_fragment: "#F59E0B",
  challenge:       "#22D3EE",
  battle:          "#EF4444",
  ward_defense:    "#FB923C",
  realm:           "#10B981",
  reflection:      "#A78BFA",
  mini_boss:       "#F97316",
};

const TYPE_LABEL: Record<string, string> = {
  story:           "STORY",
  memory_fragment: "MEMORY",
  challenge:       "CHALLENGE",
  battle:          "SHIFT",
  ward_defense:    "WARD DEFENSE",
  realm:           "REALM",
  reflection:      "REFLECTION",
  mini_boss:       "TRIAL",
};

// ── Layout ────────────────────────────────────────────────────────────────────

type NodeSide = "left" | "right" | "center";

interface NL {
  id:   string;
  xf:   number;
  y:    number;
  side: NodeSide;
  r:    number;
}

const NODE_LAYOUT: NL[] = [
  { id: "c5p1", xf: 0.65, y:   62, side: "right",  r: 28 }, // Story: The Empty Atrium
  { id: "c5p2", xf: 0.27, y:  190, side: "left",   r: 36 }, // Realm: First Ward Space (large — special!)
  { id: "c5p3", xf: 0.68, y:  316, side: "right",  r: 30 }, // Battle: River Sludge
  { id: "c5p4", xf: 0.50, y:  424, side: "center", r: 26 }, // Story: Healing Beyond Battle
  { id: "c5p5", xf: 0.68, y:  530, side: "right",  r: 30 }, // Battle: Tired After Treatment
  { id: "c5p6", xf: 0.27, y:  644, side: "left",   r: 32 }, // WD: Supply Hall Under Pressure
  { id: "c5p7", xf: 0.68, y:  756, side: "right",  r: 30 }, // Battle: Multi-Step Care Plan (REQUIRED)
  { id: "c5p8", xf: 0.50, y:  880, side: "center", r: 38 }, // Mini-boss: The Sanctuary Breathes (REQUIRED)
];

const CANVAS_H = 970;

// ── Chapter 5 data ────────────────────────────────────────────────────────────

const CH5         = CHAPTERS[4]!;
const CH5_ENEMIES = ENEMIES.filter((e) => e.difficulty === 5 && !e.worldBoss);

// ── Node status ───────────────────────────────────────────────────────────────

type NodeStatus = "complete" | "next" | "available" | "placeholder" | "locked";

interface ND {
  part:       ChapterPart;
  layout:     NL;
  status:     NodeStatus;
  eligible:   boolean;
  claimStars: number;
}

function buildNodeData(
  claimedNodes:    string[],
  battleStars:     Record<string, number>,
  storyScenesSeen: string[],
): ND[] {
  const anyWon   = CH5_ENEMIES.some((e) => (battleStars[e.id] ?? 0) >= 1);
  const bestStar = CH5_ENEMIES.reduce(
    (b, e) => Math.max(b, battleStars[e.id] ?? 0), 0,
  );
  let nextPicked = false;

  return NODE_LAYOUT.map((layout, i) => {
    const part    = CH5.parts.find((p) => p.id === layout.id)!;
    const complete = claimedNodes.includes(part.id);

    // Sequential locking: node N only accessible if node N-1 claimed
    const prevId   = i > 0 ? NODE_LAYOUT[i - 1].id : null;
    const prevDone = prevId === null || claimedNodes.includes(prevId);

    let eligible = false;
    if (!complete && prevDone) {
      switch (part.type) {
        case "story":
        case "memory_fragment":
          eligible = part.isPlaceholder
            ? true
            : (part.route?.split("sceneId=")?.[1]
                ? storyScenesSeen.includes(part.route.split("sceneId=")[1])
                : true);
          break;
        case "challenge":
        case "reflection":
          eligible = !!part.isPlaceholder;
          break;
        case "battle":
          eligible = anyWon;
          break;
        case "realm":
          // Realm node is always accessible once prev done — just navigate
          eligible = !!part.isPlaceholder;
          break;
        case "ward_defense":
          eligible = true;
          break;
        case "mini_boss":
          eligible = prevDone;
          break;
        default:
          eligible = false;
      }
    }

    // WD / mini-boss / realm use flat claim; battle uses star tracking
    const claimStars =
      part.type === "battle"
        ? Math.max(1, bestStar)
        : 3;

    let status: NodeStatus;
    if (complete)                status = "complete";
    else if (!prevDone)          status = "locked";
    else if (part.isPlaceholder) status = "placeholder";
    else if (!nextPicked && part.route) { status = "next"; nextPicked = true; }
    else                         status = "available";

    return { part, layout, status, eligible, claimStars };
  });
}


// ── Props ─────────────────────────────────────────────────────────────────────

export interface Chapter5VisualMapProps {
  battleStars:     Record<string, number>;
  claimedNodes:    string[];
  storyScenesSeen: string[];
  chapterAccent:   string;
  onPartPress:     (part: ChapterPart) => void;
  onNodeClaim?:    (nodeId: string, stars: number) => Promise<void>;
  leadHeroSprite?: ImageSourcePropType;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Chapter5VisualMap({
  battleStars,
  claimedNodes,
  storyScenesSeen,
  chapterAccent,
  onPartPress,
  onNodeClaim,
  leadHeroSprite,
}: Chapter5VisualMapProps) {
  const [W, setW] = useState(0);
  const [missionPart, setMissionPart] = useState<ChapterPart | null>(null);

  const handleNodePress = (part: ChapterPart) => {
    if (part.route && !part.isPlaceholder) {
      setMissionPart(part);
    } else {
      onPartPress(part);
    }
  };

  // P14: shared visual map animations (pulse rings + staggered node entrance)
  const { pulse, pulseOuter, entranceAnims } = useVisualMapAnims(NODE_LAYOUT.length);

  const nodes = useMemo(
    () => buildNodeData(claimedNodes, battleStars, storyScenesSeen),
    [claimedNodes, battleStars, storyScenesSeen],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== W) setW(w);
  };

  return (
    <View onLayout={onLayout}>
      <View style={{ minHeight: CANVAS_H }}>
        {/* ── Ch5 background: V3 Community Bloom / Public Health District illustrated map ── */}
        <Image
          source={require("../../assets/map-bg/journey_map_ch5_community_bloom.png")}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        {/* Warm civic jade-green readability overlay */}
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "#051A0C55" }]}
          pointerEvents="none"
        />
        {W > 0 && (
          <>
            {/* ── Painted stone-stamp path connectors ── */}
            {nodes.map((nd, i) => {
              if (i >= nodes.length - 1) return null;
              return (
                <PaintedMapPath
                  key={`path-${i}`}
                  ax={nd.layout.xf * W}
                  ay={nd.layout.y}
                  bx={nodes[i + 1].layout.xf * W}
                  by={nodes[i + 1].layout.y}
                  pathState={
                    nd.status === "complete" ? "complete" :
                    (nd.status === "next" || nd.status === "available") ? "available" :
                    "locked"
                  }
                  chapter={5}
                  accentColor={chapterAccent}
                  canvasW={W}
                  canvasH={CANVAS_H}
                />
              );
            })}

            {/* P14: Outer pulse rings (wider radius, slower phase) */}
            {nodes.map((nd) => {
              if (nd.status !== "next") return null;
              const x  = nd.layout.xf * W;
              const { r, y } = nd.layout;
              const tc = TYPE_COLOR[nd.part.type] ?? chapterAccent;
              return (
                <Animated.View
                  key={`glow-outer-${nd.part.id}`}
                  style={{
                    pointerEvents:   "none",
                    position:        "absolute",
                    left:            x - r - 20,
                    top:             y - r - 20,
                    width:           (r + 20) * 2,
                    height:          (r + 20) * 2,
                    borderRadius:    r + 20,
                    backgroundColor: tc + "18",
                    opacity:         pulseOuter,
                  }}
                />
              );
            })}

            {/* ─── Pulse glow rings ─── */}
            {nodes.map((nd) => {
              if (nd.status !== "next") return null;
              const x  = nd.layout.xf * W;
              const { r, y } = nd.layout;
              const tc = TYPE_COLOR[nd.part.type] ?? chapterAccent;
              return (
                <Animated.View
                  key={`glow-${nd.part.id}`}
                  style={{
                    pointerEvents:   "none",
                    position:        "absolute",
                    left:            x - r - 12,
                    top:             y - r - 12,
                    width:           (r + 12) * 2,
                    height:          (r + 12) * 2,
                    borderRadius:    r + 12,
                    backgroundColor: tc + "33",
                    opacity:         pulse,
                  }}
                />
              );
            })}

            {/* ─── Realm halo (permanent soft glow for the Realm node) ─── */}
            {nodes.map((nd) => {
              if (nd.part.type !== "realm") return null;
              const x  = nd.layout.xf * W;
              const { r, y } = nd.layout;
              const isComplete = nd.status === "complete";
              return (
                <View
                  key={`realm-halo-${nd.part.id}`}
                  style={{
                    pointerEvents:   "none",
                    position:        "absolute",
                    left:            x - r - 16,
                    top:             y - r - 16,
                    width:           (r + 16) * 2,
                    height:          (r + 16) * 2,
                    borderRadius:    r + 16,
                    backgroundColor: isComplete ? "#10B98118" : "#10B98108",
                    borderWidth:     1,
                    borderColor:     isComplete ? "#10B98140" : "#10B98122",
                  }}
                />
              );
            })}

            {/* ─── Node circles ─── */}
            {nodes.map((nd, idx) => {
              const x  = nd.layout.xf * W;
              const { r, y } = nd.layout;
              const tc           = TYPE_COLOR[nd.part.type] ?? chapterAccent;
              const isLocked     = nd.status === "locked";
              const isWDLocked   = isLocked && nd.part.type === "ward_defense";
              const isBossLocked = isLocked && nd.part.type === "mini_boss";
              const isActionable = !!nd.part.route && !nd.part.isPlaceholder && !isLocked;

              const borderColor =
                nd.status === "complete"      ? chapterAccent
                : nd.status === "next"        ? tc
                : isLocked                    ? COLORS.border
                : nd.status === "placeholder" ? tc + "50"
                : tc + "70";

              const bgColor =
                nd.status === "complete" ? chapterAccent + "20"
                : nd.status === "next"   ? tc + "22"
                : isLocked               ? COLORS.surfaceTertiary
                : tc + "10";

              const bw = nd.status === "complete" || nd.status === "next" ? 3 : 2;

              // P14: staggered entrance animation
              const entrAnim = entranceAnims[idx]!;
              const scale = entrAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

              return (
                <Animated.View
                  key={`circle-${nd.part.id}`}
                  pointerEvents="box-none"
                  style={{
                    position:  "absolute",
                    left:      x - r,
                    top:       y - r,
                    width:     r * 2,
                    height:    r * 2,
                    opacity:   entrAnim,
                    transform: [{ scale }],
                  }}
                >
                  <MapNodeShape
                    type={nd.part.type}
                    status={isLocked ? "available" : (nd.status as MapNodeStatus)}
                    accentColor={tc}
                    r={r}
                    isActionable={isActionable && !isLocked}
                    onPress={() => handleNodePress(nd.part)}
                    testID={`ch5-node-${nd.part.id}`}
                  />
                </Animated.View>
              );
            })}

            {/* ─── Labels ─── */}
            {nodes.map((nd) => {
              const x = nd.layout.xf * W;
              const { r, y, side } = nd.layout;
              const tc       = TYPE_COLOR[nd.part.type] ?? chapterAccent;
              const isLocked = nd.status === "locked";
              const tl       = TYPE_LABEL[nd.part.type] ?? nd.part.type.toUpperCase();
              const dim      = nd.status === "placeholder" || isLocked;

              const def = getJourneyNodeDef(nd.part.id);
              const rwd = def ? computeJourneyReward(def, nd.claimStars) : null;
              const xp  = rwd?.playerXp || nd.part.rewardXp;

              // P11 anticipation teasers
              const showRealmGrow    = nd.part.id === "c5p2" && nd.status === "complete";
              const showFinale       = nd.part.id === "c5p6" && nd.status === "complete";

              let posStyle: object;
              if (side === "right") {
                posStyle = {
                  position:   "absolute",
                  top:        y - 48,
                  left:       SPACING.sm,
                  right:      W - x + r + 8,
                  alignItems: "flex-end",
                };
              } else if (side === "left") {
                posStyle = {
                  position:   "absolute",
                  top:        y - 48,
                  left:       x + r + 8,
                  right:      SPACING.sm,
                  alignItems: "flex-start",
                };
              } else {
                posStyle = {
                  position:   "absolute",
                  top:        y + r + 10,
                  left:       8,
                  right:      8,
                  alignItems: "center",
                };
              }

              return (
                <View
                  key={`lbl-${nd.part.id}`}
                  style={[styles.labelBase, posStyle, { pointerEvents: "box-none" }]}
                >
                  {/* Type badge */}
                  <View
                    style={[
                      styles.typeBadge,
                      { backgroundColor: tc + "1A", opacity: isLocked ? 0.5 : 1 },
                    ]}
                  >
                    <Text style={[styles.typeTxt, { color: dim ? tc + "70" : tc }]}>
                      {tl}{nd.status === "placeholder" ? " · SOON" : ""}
                    </Text>
                  </View>

                  {/* Title — locked mini-boss shows "???" */}
                  <Text
                    style={[
                      styles.nodeTitle,
                      side === "right"  && { textAlign: "right" },
                      side === "center" && { textAlign: "center" },
                      {
                        color: isLocked
                          ? COLORS.onSurfaceTertiary + "80"
                          : dim
                          ? COLORS.onSurfaceTertiary
                          : nd.status === "next"
                          ? COLORS.onSurface
                          : COLORS.onSurface + "CC",
                      },
                    ]}
                    numberOfLines={2}
                  >
                    {isLocked && nd.part.type === "mini_boss" ? "???" : nd.part.title}
                  </Text>

                  {/* XP reward chip */}
                  {!!xp && xp > 0 && nd.status !== "complete" && !isLocked && (
                    <Text
                      style={[
                        styles.xpChip,
                        side === "right"  && { textAlign: "right" },
                        side === "center" && { textAlign: "center" },
                      ]}
                    >
                      ★ +{xp} XP
                    </Text>
                  )}

                  {/* P11 anticipation: Sanctuary Growing (after Realm node cleared) */}
                  {showRealmGrow && (
                    <View style={[styles.teaserRow, side === "left" && { alignSelf: "flex-start" }]}>
                      <Ionicons name="leaf-outline" size={8} color="#10B981BB" />
                      <Text style={[styles.teaserTxt, { color: "#10B981BB" }]}>
                        Sanctuary Growing…
                      </Text>
                    </View>
                  )}

                  {/* P11 anticipation: Finale Approaches (after WD cleared) */}
                  {showFinale && (
                    <View style={[styles.teaserRow, side === "left" && { alignSelf: "flex-start" }]}>
                      <Ionicons name="arrow-down" size={8} color="#F97316BB" />
                      <Text style={[styles.teaserTxt, { color: "#F97316BB" }]}>
                        Finale Approaches
                      </Text>
                    </View>
                  )}

                  {/* P14: TAP pill — shown on the active next-node */}
                  {nd.status === "next" && !!nd.part.route && !nd.part.isPlaceholder && (
                    <View style={[
                      styles.tapPill,
                      side === "right"  && { alignSelf: "flex-end" },
                      side === "center" && { alignSelf: "center"   },
                    ]}>
                      <Ionicons name="play" size={8} color={tc} />
                      <Text style={[styles.tapPillTxt, { color: tc }]}>TAP</Text>
                    </View>
                  )}

                  {/* Cleared indicator */}
                  {nd.status === "complete" && (
                    <View
                      style={[
                        styles.clearedRow,
                        side === "right"  && { alignSelf: "flex-end" },
                        side === "center" && { alignSelf: "center" },
                      ]}
                    >
                      <Ionicons name="checkmark-circle" size={10} color="#34D399" />
                      <Text style={styles.clearedTxt}>CLEARED</Text>
                    </View>
                  )}

                  {/* Claim button */}
                  {nd.status !== "complete" && nd.eligible && def && onNodeClaim && (
                    <NodeClaimBtn
                      side={side}
                      accentColor={chapterAccent}
                      onClaim={() => onNodeClaim(nd.part.id, nd.claimStars)}
                    />
                  )}
                </View>
              );
            })}

          {/* ── Lead hero map token (V6: class-matched chibi sprite on node) ── */}
          {leadHeroSprite && nodes.map((nd) => {
            if (nd.status !== "next") return null;
            const x = nd.layout.xf * W;
            const { r, y } = nd.layout;
            return (
              <HeroMapToken
                key={`hero-token-${nd.part.id}`}
                sprite={leadHeroSprite as any}
                x={x}
                y={y}
                r={r}
              />
            );
          })}
          </>
        )}
      </View>

      {/* P11: Misted Chapter 6 gate below the map */}
      <View style={styles.ch6Gate}>
        <View style={styles.ch6GateDivider} />
        <View style={styles.ch6GateContent}>
          <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary + "80"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ch6GateLabel}>CHAPTER 6 — FIRST BOSS WARD</Text>
            <Text style={styles.ch6GateSub}>
              Clears when Multi-Step Care Plan + Trial: The Sanctuary Breathes are complete
            </Text>
          </View>
        </View>
      </View>
    <MissionPopupModal
      part={missionPart}
      chapterAccent={chapterAccent}
      chapterNumber={5}
      battleStars={battleStars}
      onClose={() => setMissionPart(null)}
    />
    </View>
  );
}

// ── NodeClaimBtn ──────────────────────────────────────────────────────────────

function NodeClaimBtn({
  side,
  accentColor,
  onClaim,
}: {
  side:        NodeSide;
  accentColor: string;
  onClaim:     () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    if (busy) return;
    setBusy(true);
    try { await onClaim(); } finally { setBusy(false); }
  };
  return (
    <Pressable
      style={[
        styles.claimBtn,
        { backgroundColor: accentColor },
        side === "right"  && { alignSelf: "flex-end" },
        side === "center" && { alignSelf: "center"  },
      ]}
      onPress={handle}
      disabled={busy}
    >
      <Ionicons name="gift-outline" size={10} color="#FFF" />
      <Text style={styles.claimBtnTxt}>{busy ? "…" : "CLAIM"}</Text>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  labelBase: {
    gap: 3,
  },
  typeBadge: {
    borderRadius:      3,
    paddingHorizontal: 5,
    paddingVertical:   2,
    alignSelf:         "flex-start",
  },
  typeTxt: {
    fontSize:      8,
    fontWeight:    "700",
    letterSpacing: 0.9,
  },
  nodeTitle: {
    fontSize:   12,
    fontWeight: "700",
    lineHeight: 16,
  },
  xpChip: {
    fontSize:   10,
    fontWeight: "600",
    color:      "#F59E0B",
  },
  teaserRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           3,
    alignSelf:     "flex-start",
    marginTop:     1,
  },
  teaserTxt: {
    fontSize:   9,
    fontWeight: "600",
    fontStyle:  "italic",
  },
  clearedRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           3,
    alignSelf:     "flex-start",
  },
  clearedTxt: {
    fontSize:      9,
    fontWeight:    "700",
    color:         "#34D399",
    letterSpacing: 0.6,
  },
  claimBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      6,
    alignSelf:         "flex-start",
    marginTop:         2,
  },
  claimBtnTxt: {
    fontSize:      10,
    fontWeight:    "700",
    color:         "#FFF",
    letterSpacing: 0.5,
  },
  // ── Ch6 mist gate ──────────────────────────────────────────────────────────
  ch6Gate: {
    marginTop:    24,
    marginBottom: 8,
    opacity:      0.55,
  },
  ch6GateDivider: {
    height:          1,
    backgroundColor: COLORS.border + "60",
    marginBottom:    12,
  },
  ch6GateContent: {
    flexDirection: "row",
    alignItems:    "flex-start",
    gap:           8,
    paddingHorizontal: 4,
  },
  ch6GateLabel: {
    fontSize:      10,
    fontWeight:    "700",
    color:         COLORS.onSurfaceTertiary,
    letterSpacing: 0.8,
  },
  ch6GateSub: {
    fontSize:   9,
    color:      COLORS.onSurfaceTertiary + "AA",
    marginTop:  2,
    lineHeight: 13,
  },
  // P14: TAP call-to-action pill
  tapPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               3,
    borderWidth:       1,
    borderColor:       "rgba(255,255,255,0.20)",
    borderRadius:      4,
    paddingHorizontal: 5,
    paddingVertical:   2,
    backgroundColor:   "rgba(0,0,0,0.22)",
    alignSelf:         "flex-start",
  },
  tapPillTxt: {
    fontSize:      8,
    fontWeight:    "800",
    letterSpacing: 0.8,
  },
});
