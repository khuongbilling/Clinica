/**
 * Chapter3VisualMap — visual game-map path for Chapter 3's 9 nodes.
 *
 * Renders the nine Chapter 3 nodes (Breath Before Battle) as a zigzag
 * connected path with SVG cubic-bezier curves, absolutely-positioned node
 * circles, and side labels. Sky-blue accent (#B0DEFF).
 *
 * P9 anticipation hooks:
 *  · After c3p4 cleared: "Air Lesson Ahead" (pointing at memory + stack drill)
 *  · After c3p7 cleared: "Final Trial Ahead" (pointing at mini-boss)
 *  · Misted Chapter 4 gate below the canvas.
 *
 * Used inside ChapterJourneyMap when Chapter 3 is the expanded chapter.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type LayoutChangeEvent,
} from "react-native";
import * as RNSvg from "react-native-svg";

import { CHAPTERS, type ChapterPart } from "@/src/game/chapterJourney";
import { ENEMIES } from "@/src/game/content";
import {
  computeJourneyReward,
  getJourneyNodeDef,
} from "@/src/game/journeyRewards";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";
import { MapNodeShape, type MapNodeStatus } from "./MapNodeShape";
import { MissionPopupModal } from "./MissionPopupModal";
import { useVisualMapAnims } from "./VisualMapHooks";

// ── SVG type shim (React 19 / rn-svg compat) ─────────────────────────────────

const Svg     = (RNSvg as any).default as React.ComponentType<any>;
const SvgPath = (RNSvg as any).Path   as React.ComponentType<any>;

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
  { id: "c3p1", xf: 0.64, y:   60, side: "right",  r: 28 }, // Memory: Breathless Hall
  { id: "c3p2", xf: 0.28, y:  180, side: "left",   r: 28 }, // Challenge: Cue Hunt
  { id: "c3p3", xf: 0.70, y:  300, side: "right",  r: 28 }, // Challenge: Rapid Triage
  { id: "c3p4", xf: 0.28, y:  415, side: "left",   r: 30 }, // Battle: The Hidden Wheeze
  { id: "c3p5", xf: 0.70, y:  525, side: "right",  r: 28 }, // Memory: A Lesson in Priority
  { id: "c3p6", xf: 0.28, y:  640, side: "left",   r: 28 }, // Challenge: Stabilize Stack
  { id: "c3p7", xf: 0.70, y:  752, side: "right",  r: 30 }, // Battle: Breath Under Pressure
  { id: "c3p8", xf: 0.50, y:  882, side: "center", r: 36 }, // Mini-boss: Breathless Gale Spirit
  { id: "c3p9", xf: 0.50, y: 1010, side: "center", r: 26 }, // Reflection: What Air Teaches
];

const CANVAS_H = 1100;

// ── Chapter 3 data ────────────────────────────────────────────────────────────

const CH3         = CHAPTERS[2]!;
const CH3_ENEMIES = ENEMIES.filter((e) => e.difficulty === 3 && !e.worldBoss);

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
  const anyWon   = CH3_ENEMIES.some((e) => (battleStars[e.id] ?? 0) >= 1);
  const bestStar = CH3_ENEMIES.reduce(
    (b, e) => Math.max(b, battleStars[e.id] ?? 0), 0,
  );
  let nextPicked = false;

  return NODE_LAYOUT.map((layout, i) => {
    const part    = CH3.parts.find((p) => p.id === layout.id)!;
    const complete = claimedNodes.includes(part.id);

    // Sequential locking: node N only accessible if node N-1 claimed
    const prevId   = i > 0 ? NODE_LAYOUT[i - 1].id : null;
    const prevDone = prevId === null || claimedNodes.includes(prevId);

    let eligible = false;
    if (!complete && prevDone) {
      switch (part.type) {
        case "memory_fragment":
        case "story": {
          const sid = part.route?.split("sceneId=")?.[1];
          eligible  = part.isPlaceholder
            ? true
            : sid ? storyScenesSeen.includes(sid) : true;
          break;
        }
        case "challenge":
          eligible = true;
          break;
        case "reflection":
          eligible = !!part.isPlaceholder;
          break;
        case "battle":
          eligible = anyWon;
          break;
        case "mini_boss":
          eligible = bestStar >= 2;
          break;
        default:
          eligible = false;
      }
    }

    const claimStars =
      part.type === "battle" || part.type === "mini_boss"
        ? Math.max(1, bestStar) : 3;

    let status: NodeStatus;
    if (complete)               status = "complete";
    else if (!prevDone)         status = "locked";
    else if (part.isPlaceholder) status = "placeholder";
    else if (!nextPicked && part.route) { status = "next"; nextPicked = true; }
    else                        status = "available";

    return { part, layout, status, eligible, claimStars };
  });
}

// ── SVG bezier path ───────────────────────────────────────────────────────────

function bez(x1: number, y1: number, x2: number, y2: number): string {
  const my = ((y1 + y2) / 2).toFixed(1);
  return `M ${x1.toFixed(1)} ${y1} C ${x1.toFixed(1)} ${my} ${x2.toFixed(1)} ${my} ${x2.toFixed(1)} ${y2}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface Chapter3VisualMapProps {
  battleStars:     Record<string, number>;
  claimedNodes:    string[];
  storyScenesSeen: string[];
  chapterAccent:   string;
  onPartPress:     (part: ChapterPart) => void;
  onNodeClaim?:    (nodeId: string, stars: number) => Promise<void>;
  leadHeroSprite?: ImageSourcePropType;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Chapter3VisualMap({
  battleStars,
  claimedNodes,
  storyScenesSeen,
  chapterAccent,
  onPartPress,
  onNodeClaim,
  leadHeroSprite,
}: Chapter3VisualMapProps) {
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
        {W > 0 && (
          <>
            {/* P14: Completed-segment glow path layer */}
            <Svg width={W} height={CANVAS_H} style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {nodes.map((nd, i) => {
                if (i >= nodes.length - 1 || nd.status !== "complete") return null;
                return (
                  <SvgPath
                    key={`glow-seg-${i}`}
                    d={bez(nd.layout.xf * W, nd.layout.y, nodes[i + 1].layout.xf * W, nodes[i + 1].layout.y)}
                    stroke={chapterAccent + "40"}
                    strokeWidth={9}
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })}
            </Svg>

            {/* ─── SVG path layer ─── */}
            <Svg
              width={W}
              height={CANVAS_H}
              style={StyleSheet.absoluteFillObject}
              pointerEvents="none"
            >
              {nodes.map((nd, i) => {
                if (i >= nodes.length - 1) return null;
                const ax = nd.layout.xf * W;
                const ay = nd.layout.y;
                const bx = nodes[i + 1].layout.xf * W;
                const by = nodes[i + 1].layout.y;
                const fromDone = nd.status === "complete";
                const toLocked = nodes[i + 1].status === "locked";
                return (
                  <SvgPath
                    key={`seg-${i}`}
                    d={bez(ax, ay, bx, by)}
                    stroke={
                      fromDone ? chapterAccent
                      : toLocked ? "#33415555"
                      : "#33415590"
                    }
                    strokeWidth={fromDone ? 3 : 2}
                    strokeDasharray={fromDone ? undefined : "8 5"}
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })}
            </Svg>

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
                    testID={`ch3-node-${nd.part.id}`}
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

              // P9 anticipation teasers
              const showAirAhead   = nd.part.id === "c3p4" && nd.status === "complete";
              const showTrialAhead = nd.part.id === "c3p7" && nd.status === "complete";

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

                  {/* Title — locked boss shows "???" */}
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

                  {/* P9 anticipation: Air Lesson Ahead (after first battle cleared) */}
                  {showAirAhead && (
                    <View style={[styles.teaserRow, side === "left" && { alignSelf: "flex-start" }]}>
                      <Ionicons name="arrow-down" size={8} color={chapterAccent + "90"} />
                      <Text style={[styles.teaserTxt, { color: chapterAccent + "90" }]}>
                        Priority Lesson Ahead
                      </Text>
                    </View>
                  )}

                  {/* P9 anticipation: Final Trial Ahead (after second battle cleared) */}
                  {showTrialAhead && (
                    <View style={[styles.teaserRow, side === "right" && { alignSelf: "flex-end" }]}>
                      <Ionicons name="arrow-down" size={8} color="#F97316BB" />
                      <Text style={[styles.teaserTxt, { color: "#F97316BB" }]}>
                        Final Trial Ahead
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

          {/* P17: Lead hero traveler sprite — shown at the active "next" node */}
          {leadHeroSprite && nodes.map((nd) => {
            if (nd.status !== "next") return null;
            const x = nd.layout.xf * W;
            const { r, y } = nd.layout;
            const SR = 15;
            return (
              <View
                key={`hero-sprite-${nd.part.id}`}
                pointerEvents="none"
                style={{
                  position:        "absolute",
                  left:            x - SR,
                  top:             y - r - SR * 2 - 8,
                  width:           SR * 2,
                  height:          SR * 2,
                  borderRadius:    SR,
                  overflow:        "hidden",
                  borderWidth:     2,
                  borderColor:     "#D4AF37",
                  backgroundColor: "#0B1825",
                  zIndex:          30,
                }}
              >
                <Image
                  source={leadHeroSprite}
                  style={{ width: SR * 2, height: SR * 2 }}
                  resizeMode="cover"
                />
              </View>
            );
          })}
          </>
        )}
      </View>

      {/* P9 Multi-day anticipation: Misted Chapter 4 gate below the map */}
      <View style={styles.ch4Gate}>
        <View style={styles.ch4GateDivider} />
        <View style={styles.ch4GateContent}>
          <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary + "80"} />
          <View style={{ flex: 1 }}>
            <Text style={styles.ch4GateLabel}>CHAPTER 4 — CODE RUSH</Text>
            <Text style={styles.ch4GateSub}>
              Clears when Breath Under Pressure + Trial: Breathless Gale Spirit are complete
            </Text>
          </View>
        </View>
      </View>
    <MissionPopupModal
      part={missionPart}
      chapterAccent={chapterAccent}
      chapterNumber={3}
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
  ch4Gate: {
    marginTop:    16,
    marginBottom: 4,
    opacity:      0.65,
  },
  ch4GateDivider: {
    height:          1,
    borderTopWidth:  1,
    borderTopColor:  "#B0DEFF22",
    borderStyle:     "dashed",
    marginBottom:    10,
  },
  ch4GateContent: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    gap:               8,
    paddingHorizontal: SPACING.md,
  },
  ch4GateLabel: {
    fontSize:      10,
    fontWeight:    "700",
    color:         COLORS.onSurfaceTertiary + "80",
    letterSpacing: 0.8,
    marginBottom:  2,
  },
  ch4GateSub: {
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
