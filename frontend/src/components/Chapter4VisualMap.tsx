/**
 * Chapter4VisualMap — visual game-map path for Chapter 4's 9 nodes.
 *
 * Renders the nine Chapter 4 nodes (Code Rush — Ward Defense Introduction)
 * as a zigzag connected path with SVG cubic-bezier curves.
 * Red accent (#EF4444); Ward Defense nodes styled in orange (#FB923C).
 *
 * P10 anticipation hooks:
 *  · After c4p4 (first WD) cleared: "Second Wave Incoming" teaser
 *  · After c4p7 (second WD) cleared: "Final Stand Ahead" teaser
 *  · Locked mini-boss shows shield-half silhouette (incoming surge feel)
 *  · Misted Chapter 5 gate below the canvas.
 *
 * Used inside ChapterJourneyMap when Chapter 4 is the expanded chapter.
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
import { MissionPopupModal } from "./MissionPopupModal";
import { PaintedMapPath } from "./PaintedMapPath";
import { useVisualMapAnims } from "./VisualMapHooks";

// ── Type visual config ────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  memory_fragment: "#F59E0B",
  challenge:       "#22D3EE",
  battle:          "#EF4444",
  ward_defense:    "#FB923C",
  reflection:      "#A78BFA",
  mini_boss:       "#F97316",
};

const TYPE_LABEL: Record<string, string> = {
  memory_fragment: "MEMORY",
  challenge:       "CHALLENGE",
  battle:          "SHIFT",
  ward_defense:    "WARD DEFENSE",
  reflection:      "REFLECTION",
  mini_boss:       "TRIAL",
};

function getChallengeLabel(route?: string): string {
  if (route?.includes("cue-hunt"))        return "CUE HUNT";
  if (route?.includes("rapid-triage"))    return "TRIAGE DRILL";
  if (route?.includes("stabilize-stack")) return "STACK DRILL";
  return "CHALLENGE";
}

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
  { id: "c4p1", xf: 0.65, y:   60, side: "right",  r: 28 }, // Memory: Ward Doors Shake
  { id: "c4p2", xf: 0.27, y:  178, side: "left",   r: 28 }, // Challenge: Triage Drill
  { id: "c4p3", xf: 0.68, y:  294, side: "right",  r: 30 }, // Battle: Crowded Ward Warning
  { id: "c4p4", xf: 0.27, y:  408, side: "left",   r: 30 }, // WD: First Wave
  { id: "c4p5", xf: 0.68, y:  520, side: "right",  r: 28 }, // Memory: Holding the Line
  { id: "c4p6", xf: 0.27, y:  635, side: "left",   r: 28 }, // Challenge: Stack Drill
  { id: "c4p7", xf: 0.68, y:  748, side: "right",  r: 32 }, // WD: Second Wave (REQUIRED)
  { id: "c4p8", xf: 0.50, y:  878, side: "center", r: 36 }, // Mini-boss WD: Final Stand (REQUIRED)
  { id: "c4p9", xf: 0.50, y: 1006, side: "center", r: 26 }, // Reflection: After the Rush
];

const CANVAS_H = 1090;

// ── Chapter 4 data ────────────────────────────────────────────────────────────

const CH4         = CHAPTERS[3]!;
const CH4_ENEMIES = ENEMIES.filter((e) => e.difficulty === 4 && !e.worldBoss);

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
  const anyWon   = CH4_ENEMIES.some((e) => (battleStars[e.id] ?? 0) >= 1);
  const bestStar = CH4_ENEMIES.reduce(
    (b, e) => Math.max(b, battleStars[e.id] ?? 0), 0,
  );
  let nextPicked = false;

  return NODE_LAYOUT.map((layout, i) => {
    const part    = CH4.parts.find((p) => p.id === layout.id)!;
    const complete = claimedNodes.includes(part.id);

    // Sequential locking: node N only accessible if node N-1 claimed
    const prevId   = i > 0 ? NODE_LAYOUT[i - 1].id : null;
    const prevDone = prevId === null || claimedNodes.includes(prevId);

    let eligible = false;
    if (!complete && prevDone) {
      switch (part.type) {
        case "memory_fragment":
        case "story":
          eligible = part.isPlaceholder
            ? true
            : (part.route?.split("sceneId=")?.[1]
                ? storyScenesSeen.includes(part.route.split("sceneId=")[1])
                : true);
          break;
        case "challenge":
          eligible = true;
          break;
        case "reflection":
          eligible = !!part.isPlaceholder;
          break;
        case "battle":
          eligible = anyWon;
          break;
        case "ward_defense":
          // prevDone is the primary gate for WD — level already guaranteed by chapter levelGate
          eligible = true;
          break;
        case "mini_boss":
          // WD mini-boss: prev wave (c4p7) must be claimed (guaranteed by sequential lock)
          eligible = prevDone;
          break;
        default:
          eligible = false;
      }
    }

    // WD and WD mini-boss use flat claim (no enemy-star tracking for WD)
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

const TOKEN_W = 48;
const TOKEN_H = 64;

// ── Props ─────────────────────────────────────────────────────────────────────

export interface Chapter4VisualMapProps {
  battleStars:     Record<string, number>;
  claimedNodes:    string[];
  storyScenesSeen: string[];
  chapterAccent:   string;
  onPartPress:     (part: ChapterPart) => void;
  onNodeClaim?:    (nodeId: string, stars: number) => Promise<void>;
  leadHeroSprite?: ImageSourcePropType;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Chapter4VisualMap({
  battleStars,
  claimedNodes,
  storyScenesSeen,
  chapterAccent,
  onPartPress,
  onNodeClaim,
  leadHeroSprite,
}: Chapter4VisualMapProps) {
  const [W, setW] = useState(0);
  const [missionPart, setMissionPart] = useState<ChapterPart | null>(null);

  const handleNodePress = (part: ChapterPart) => {
    if (part.type === "battle" || part.type === "mini_boss" || part.type === "ward_defense") {
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
        {/* ── Ch4 background: V3 Code Rush Tower / Ward Defense illustrated map ── */}
        <Image
          source={require("../../assets/map-bg/journey_map_ch4_code_rush_tower.png")}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        {/* Urgent deep-red readability overlay */}
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "#1A050855" }]}
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
                  complete={nd.status === "complete"}
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
                    left:            x - r - 10,
                    top:             y - r - 10,
                    width:           (r + 10) * 2,
                    height:          (r + 10) * 2,
                    borderRadius:    r + 10,
                    backgroundColor: tc + "33",
                    opacity:         pulse,
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
              // Locked WD mini-boss shows shield silhouette; regular WD locked shows shield-half
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
                    testID={`ch4-node-${nd.part.id}`}
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
              const tl       = nd.part.type === "challenge"
                ? getChallengeLabel(nd.part.route)
                : (TYPE_LABEL[nd.part.type] ?? nd.part.type.toUpperCase());
              const dim = nd.status === "placeholder" || isLocked;

              const def = getJourneyNodeDef(nd.part.id);
              const rwd = def ? computeJourneyReward(def, nd.claimStars) : null;
              const xp  = rwd?.playerXp || nd.part.rewardXp;

              // P10 anticipation teasers
              const showWave2    = nd.part.id === "c4p4" && nd.status === "complete";
              const showFinalStand = nd.part.id === "c4p7" && nd.status === "complete";

              let posStyle: object;
              if (side === "right") {
                posStyle = {
                  position:   "absolute",
                  top:        y - 44,
                  left:       SPACING.sm,
                  right:      W - x + r + 8,
                  alignItems: "flex-end",
                };
              } else if (side === "left") {
                posStyle = {
                  position:   "absolute",
                  top:        y - 44,
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

                  {/* Title — locked WD boss shows "???" */}
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

                  {/* P10 anticipation: Second Wave Incoming (after first WD cleared) */}
                  {showWave2 && (
                    <View style={[styles.teaserRow, side === "left" && { alignSelf: "flex-start" }]}>
                      <Ionicons name="arrow-down" size={8} color="#FB923CBB" />
                      <Text style={[styles.teaserTxt, { color: "#FB923CBB" }]}>
                        Second Wave Incoming
                      </Text>
                    </View>
                  )}

                  {/* P10 anticipation: Final Stand Ahead (after second WD cleared) */}
                  {showFinalStand && (
                    <View style={[styles.teaserRow, side === "right" && { alignSelf: "flex-end" }]}>
                      <Ionicons name="arrow-down" size={8} color="#F97316BB" />
                      <Text style={[styles.teaserTxt, { color: "#F97316BB" }]}>
                        Final Stand Ahead
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

          {/* ── Lead hero traveler token (full sprite, no circular crop) ── */}
          {leadHeroSprite && nodes.map((nd) => {
            if (nd.status !== "next") return null;
            const x = nd.layout.xf * W;
            const { r, y } = nd.layout;
            return (
              <View
                key={`hero-sprite-${nd.part.id}`}
                pointerEvents="none"
                style={{
                  position:      "absolute",
                  left:          x - TOKEN_W / 2,
                  top:           y - r - TOKEN_H - 4,
                  width:         TOKEN_W,
                  height:        TOKEN_H,
                  zIndex:        30,
                  shadowColor:   UI.gold,
                  shadowOpacity: 0.7,
                  shadowRadius:  8,
                  elevation:     8,
                }}
              >
                <Image
                  source={leadHeroSprite as any}
                  style={{ width: TOKEN_W, height: TOKEN_H }}
                  contentFit="contain"
                />
              </View>
            );
          })}
          </>
        )}
      </View>

      {/* P10 Multi-day anticipation: Misted Chapter 5 gate below the map */}
      <View style={styles.ch5Gate}>
        <View style={styles.ch5GateDivider} />
        <View style={styles.ch5GateContent}>
          <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary + "80"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ch5GateLabel}>CHAPTER 5 — BUILDING THE SANCTUARY</Text>
            <Text style={styles.ch5GateSub}>
              Clears when Code Rush Second Wave + Trial: Hold the Line are complete
            </Text>
          </View>
        </View>
      </View>
    <MissionPopupModal
      part={missionPart}
      chapterAccent={chapterAccent}
      chapterNumber={4}
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
    letterSpacing: 0.5,
  },
  claimBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               3,
    borderRadius:      4,
    paddingHorizontal: 7,
    paddingVertical:   3,
    alignSelf:         "flex-start",
    marginTop:         2,
  },
  claimBtnTxt: {
    fontSize:      9,
    fontWeight:    "700",
    color:         "#FFF",
    letterSpacing: 0.5,
  },
  ch5Gate: {
    marginTop:    16,
    marginBottom: 4,
    opacity:      0.65,
  },
  ch5GateDivider: {
    height:         1,
    borderTopWidth: 1,
    borderTopColor: "#EF444422",
    borderStyle:    "dashed",
    marginBottom:   10,
  },
  ch5GateContent: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    gap:               8,
    paddingHorizontal: SPACING.md,
  },
  ch5GateLabel: {
    fontSize:      10,
    fontWeight:    "700",
    color:         COLORS.onSurfaceTertiary + "80",
    letterSpacing: 0.8,
    marginBottom:  2,
  },
  ch5GateSub: {
    fontSize:   10,
    color:      COLORS.onSurfaceTertiary + "60",
    lineHeight: 14,
    fontStyle:  "italic",
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
