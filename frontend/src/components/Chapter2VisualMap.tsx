/**
 * Chapter2VisualMap — visual game-map path for Chapter 2's 8 nodes.
 *
 * Renders the eight Chapter 2 nodes as a zigzag connected path with SVG
 * cubic-bezier curves, absolutely-positioned node circles, and side labels.
 * Supports sequential locking (node N accessible only after N-1 claimed),
 * completion states, animated "next step" glow, claim buttons, and
 * multi-day anticipation hooks (boss silhouette, memory teaser, misted Ch3 gate).
 *
 * Used inside ChapterJourneyMap when Chapter 2 is the expanded chapter.
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
  memory_fragment: "#F59E0B",
  challenge:       "#22D3EE",
  battle:          "#EF4444",
  reflection:      "#A78BFA",
  mini_boss:       "#F97316",
};

const TYPE_LABEL: Record<string, string> = {
  memory_fragment: "MEMORY",
  challenge:       "CHALLENGE",
  battle:          "SHIFT",
  reflection:      "REFLECTION",
  mini_boss:       "TRIAL",
};

/** Returns a specific drill label for challenge nodes by route. */
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
  xf:   number;     // x-position as fraction of container width
  y:    number;     // y-position in pixels
  side: NodeSide;
  r:    number;     // circle radius
}

const NODE_LAYOUT: NL[] = [
  { id: "c2p1", xf: 0.74, y:  75, side: "right",  r: 44 }, // Memory: Briefing
  { id: "c2p2", xf: 0.20, y: 255, side: "left",   r: 44 }, // Challenge: Cue Hunt
  { id: "c2p3", xf: 0.76, y: 435, side: "right",  r: 44 }, // Challenge: Rapid Triage
  { id: "c2p4", xf: 0.18, y: 615, side: "left",   r: 44 }, // Challenge: Stabilize Stack
  { id: "c2p5", xf: 0.74, y: 795, side: "right",  r: 44 }, // Battle: Fever Imp
  { id: "c2p6", xf: 0.20, y: 975, side: "left",   r: 44 }, // Memory Fragment: First Ally
  { id: "c2p7", xf: 0.50, y:1175, side: "center", r: 54 }, // Mini-boss: Fever Shade
  { id: "c2p8", xf: 0.50, y:1385, side: "center", r: 42 }, // Reflection: Rotation Complete
];

const CANVAS_H = 1510;

// ── Chapter 2 data ────────────────────────────────────────────────────────────

const CH2         = CHAPTERS[1]!;
const CH2_ENEMIES = ENEMIES.filter((e) => e.difficulty === 2 && !e.worldBoss);

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
  const anyWon   = CH2_ENEMIES.some((e) => (battleStars[e.id] ?? 0) >= 1);
  const bestStar = CH2_ENEMIES.reduce(
    (b, e) => Math.max(b, battleStars[e.id] ?? 0), 0,
  );
  let nextPicked = false;

  return NODE_LAYOUT.map((layout, i) => {
    const part    = CH2.parts.find((p) => p.id === layout.id)!;
    const complete = claimedNodes.includes(part.id);

    // P8: sequential locking — node N is only accessible if node N-1 is claimed
    const prevId   = i > 0 ? NODE_LAYOUT[i - 1].id : null;
    const prevDone = prevId === null || claimedNodes.includes(prevId);

    // First-clear eligibility — all types gated on sequential prevDone
    let eligible = false;
    if (!complete && prevDone) {
      switch (part.type) {
        case "memory_fragment":
        case "story": {
          const sid = part.route?.split("sceneId=")?.[1];
          // Route-less nodes are directly claimable (Claim IS the interaction);
          // nodes with sceneId require the scene to be seen first.
          eligible  = part.isPlaceholder
            ? true
            : sid ? storyScenesSeen.includes(sid) : true;
          break;
        }
        case "mini_boss": {
          // Claimable after beating the specific boss enemy; WD-style (no enemyId) auto-eligible
          const enemyId = part.route?.match(/enemyId=([^&]+)/)?.[1];
          eligible = enemyId ? (battleStars[enemyId] ?? 0) >= 1 : true;
          break;
        }
        case "challenge":
          eligible = true;
          break;
        case "reflection":
          eligible = true;
          break;
        case "battle":
          eligible = anyWon;
          break;
        default:
          eligible = false;
      }
    }

    const claimStars = (() => {
      if (part.type === "battle" || part.type === "mini_boss") {
        const eid = part.route?.match(/enemyId=([^&]+)/)?.[1];
        return Math.max(1, eid ? (battleStars[eid] ?? 0) : bestStar);
      }
      return 3;
    })();

    let status: NodeStatus;
    if (complete)          status = "complete";
    else if (!prevDone)    status = "locked";
    else if (part.isPlaceholder) status = "placeholder";
    else if (!nextPicked && part.route) { status = "next"; nextPicked = true; }
    else                   status = "available";

    return { part, layout, status, eligible, claimStars };
  });
}


// ── Props ─────────────────────────────────────────────────────────────────────

export interface Chapter2VisualMapProps {
  battleStars:     Record<string, number>;
  claimedNodes:    string[];
  storyScenesSeen: string[];
  chapterAccent:   string;
  onPartPress:     (part: ChapterPart) => void;
  onNodeClaim?:    (nodeId: string, stars: number) => Promise<void>;
  leadHeroSprite?: ImageSourcePropType;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Chapter2VisualMap({
  battleStars,
  claimedNodes,
  storyScenesSeen,
  chapterAccent,
  onPartPress,
  onNodeClaim,
  leadHeroSprite,
}: Chapter2VisualMapProps) {
  const [W, setW] = useState(0);
  const [missionPart, setMissionPart] = useState<ChapterPart | null>(null);

  // Intercept press: show popup for battle/boss/ward; auto-claim reflection nodes with no route
  const handleNodePress = (part: ChapterPart) => {
    if (part.route && !part.isPlaceholder) {
      setMissionPart(part);
    } else if (part.type === 'reflection' && !claimedNodes.includes(part.id) && onNodeClaim) {
      onNodeClaim(part.id, 3).catch(() => {});
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

  const bestStar = useMemo(
    () => CH2_ENEMIES.reduce((b, e) => Math.max(b, battleStars[e.id] ?? 0), 0),
    [battleStars],
  );

  // Memory auto-fulfil: auto-claim memory/story nodes whose scene is already seen.
  // Only claims nodes that are sequentially eligible to prevent progression bypasses.
  React.useEffect(() => {
    if (!onNodeClaim) return;
    nodes.forEach((nd) => {
      if (!nd.eligible) return; // Respect sequential eligibility order
      if (nd.part.isPlaceholder || claimedNodes.includes(nd.part.id)) return;
      if (nd.part.type !== 'memory_fragment' && nd.part.type !== 'story') return;
      const sceneId = nd.part.route?.split('sceneId=')?.[1]?.split('&')?.[0];
      if (sceneId && storyScenesSeen.includes(sceneId)) {
        onNodeClaim(nd.part.id, 3).catch(() => {});
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyScenesSeen.join(','), claimedNodes.join(',')]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== W) setW(w);
  };

  return (
    <View onLayout={onLayout}>
      <View style={{ minHeight: CANVAS_H }}>
        {/* ── Ch2 background: V3 University Courtyard & Ward Bridge illustrated map ── */}
        <Image
          source={require("../../assets/map-bg/journey_map_ch2_university_courtyard.png")}
          style={StyleSheet.absoluteFillObject}
          contentFit="cover"
        />
        {/* Ink & Mist: warm umber readability overlay */}
        <View
          style={[StyleSheet.absoluteFillObject, { backgroundColor: "#1A0B0548" }]}
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
                  chapter={2}
                  accentColor={chapterAccent}
                  canvasW={W}
                  canvasH={CANVAS_H}
                />
              );
            })}


            {/* ─── Node circles ─── */}
            {nodes.map((nd, idx) => {
              const x  = nd.layout.xf * W;
              const { r, y } = nd.layout;
              const tc           = TYPE_COLOR[nd.part.type] ?? chapterAccent;
              const isLocked     = nd.status === "locked";
              const isBossLocked = isLocked && nd.part.type === "mini_boss";
              // Reflection nodes with no route are tap-to-claim; all nodes respect sequential lock
              const isReflectionAutoClaimable =
                nd.part.type === 'reflection' && !nd.part.isPlaceholder &&
                !nd.part.route && !isLocked && !claimedNodes.includes(nd.part.id);
              const isActionable = isReflectionAutoClaimable ||
                (!!nd.part.route && !nd.part.isPlaceholder && !isLocked);

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
                    status={nd.status as MapNodeStatus}
                    accentColor={tc}
                    r={r}
                    isActionable={isActionable}
                    onPress={() => handleNodePress(nd.part)}
                    testID={`ch2-node-${nd.part.id}`}
                    nodeStars={(() => {
                      const eid = nd.part.route?.match(/enemyId=([^&]+)/)?.[1];
                      return eid ? (battleStars[eid] ?? 0) : 0;
                    })()}
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

              // P8: multi-day anticipation teasers in labels
              const showMemoryAhead = nd.part.id === "c2p5" && nd.status === "complete";
              const showTrialAhead  = nd.part.id === "c2p6" && nd.status === "complete";

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
                  pointerEvents="box-none"
                  style={[styles.labelBase, posStyle]}
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

                  {/* Title — locked boss shows "???" for anticipation */}
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

                  {/* P8 anticipation: Memory Fragment Ahead (shown when c2p5 is cleared) */}
                  {showMemoryAhead && (
                    <View style={[styles.teaserRow, side === "right" && { alignSelf: "flex-end" }]}>
                      <Ionicons name="arrow-down" size={8} color={chapterAccent + "90"} />
                      <Text style={[styles.teaserTxt, { color: chapterAccent + "90" }]}>
                        Memory Fragment Ahead
                      </Text>
                    </View>
                  )}

                  {/* P8 anticipation: Chapter Trial Ahead (shown when c2p6 is cleared) */}
                  {showTrialAhead && (
                    <View style={styles.teaserRow}>
                      <Ionicons name="arrow-down" size={8} color="#F97316BB" />
                      <Text style={[styles.teaserTxt, { color: "#F97316BB" }]}>
                        Chapter Trial Ahead
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

      {/* P8 Multi-day anticipation: Misted Chapter 3 gate below the map */}
      <View style={styles.ch3Gate}>
        <View style={styles.ch3GateDivider} />
        <View style={styles.ch3GateContent}>
          <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary + "80"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ch3GateLabel}>CHAPTER 3 — BREATH BEFORE BATTLE</Text>
            <Text style={styles.ch3GateSub}>
              Clears when Fever Imp Simulation + Trial: Fever Shade are complete
            </Text>
          </View>
        </View>
      </View>
    <MissionPopupModal
      part={missionPart}
      chapterAccent={chapterAccent}
      chapterNumber={2}
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
    fontSize:  9,
    fontWeight: "600",
    fontStyle: "italic",
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
    marginTop:         8,
  },
  claimBtnTxt: {
    fontSize:      9,
    fontWeight:    "700",
    color:         "#FFF",
    letterSpacing: 0.5,
  },

  // P8: misted Chapter 3 gate
  ch3Gate: {
    marginTop:        24,
    marginBottom:     16,
    marginHorizontal: SPACING.sm,
    gap:              10,
  },
  ch3GateDivider: {
    height:          1,
    backgroundColor: COLORS.border,
    opacity:         0.5,
  },
  ch3GateContent: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             8,
    padding:         10,
    borderRadius:    8,
    backgroundColor: COLORS.surfaceTertiary,
    borderWidth:     1,
    borderColor:     COLORS.border,
    opacity:         0.72,
  },
  ch3GateLabel: {
    fontSize:      9,
    fontWeight:    "700",
    color:         COLORS.onSurfaceTertiary,
    letterSpacing: 0.8,
  },
  ch3GateSub: {
    fontSize:   10,
    color:      COLORS.onSurfaceTertiary,
    marginTop:  2,
    lineHeight: 14,
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
