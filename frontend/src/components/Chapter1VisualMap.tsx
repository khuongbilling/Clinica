/**
 * Chapter1VisualMap — visual game-map path for Chapter 1's 6 nodes.
 *
 * Renders the six Chapter 1 nodes as a zigzag connected path with SVG
 * cubic-bezier curves, absolutely-positioned node circles, and side labels.
 * Supports completion states, animated "next step" glow, claim buttons,
 * and tap-to-navigate for actionable nodes.
 *
 * Used inside ChapterJourneyMap when Chapter 1 is the expanded chapter.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import * as RNSvg from "react-native-svg";

import { CHAPTERS, type ChapterPart } from "@/src/game/chapterJourney";
import { ENEMIES } from "@/src/game/content";
import {
  computeJourneyReward,
  getJourneyNodeDef,
} from "@/src/game/journeyRewards";
import { COLORS, SPACING } from "@/src/theme/colors";
import { useVisualMapAnims } from "./VisualMapHooks";

// ── SVG type shim (React 19 / rn-svg compat — same as IsoTerrain.tsx) ────────

const Svg     = (RNSvg as any).default as React.ComponentType<any>;
const SvgPath = (RNSvg as any).Path   as React.ComponentType<any>;

// ── Type visual config (Chapter 1 node types only) ────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  memory_fragment: "#D4AF37",
  challenge:       "#F59E0B",
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
  { id: "c1n1", xf: 0.67, y: 60,  side: "right",  r: 28 },
  { id: "c1n2", xf: 0.24, y: 180, side: "left",   r: 28 },
  { id: "c1n3", xf: 0.70, y: 300, side: "right",  r: 28 },
  { id: "c1n4", xf: 0.21, y: 420, side: "left",   r: 28 },
  { id: "c1n5", xf: 0.68, y: 530, side: "right",  r: 28 },
  { id: "c1n6", xf: 0.47, y: 665, side: "center", r: 34 },
];

const CANVAS_H = 800; // total canvas height (includes space for boss label below)

// ── Chapter 1 data ────────────────────────────────────────────────────────────

const CH1         = CHAPTERS[0]!;
const CH1_ENEMIES = ENEMIES.filter((e) => e.difficulty === 1 && !e.worldBoss);

// ── Node status ───────────────────────────────────────────────────────────────

type NodeStatus = "complete" | "next" | "available" | "placeholder";

interface ND {
  part:       ChapterPart;
  layout:     NL;
  status:     NodeStatus;
  eligible:   boolean;   // eligible to claim first-clear reward
  claimStars: number;
}

function buildNodeData(
  claimedNodes:    string[],
  battleStars:     Record<string, number>,
  storyScenesSeen: string[],
): ND[] {
  const anyWon   = CH1_ENEMIES.some((e) => (battleStars[e.id] ?? 0) >= 1);
  const bestStar = CH1_ENEMIES.reduce(
    (b, e) => Math.max(b, battleStars[e.id] ?? 0),
    0,
  );
  let nextPicked = false;

  return NODE_LAYOUT.map((layout) => {
    const part    = CH1.parts.find((p) => p.id === layout.id)!;
    const complete = claimedNodes.includes(part.id);

    // First-clear eligibility
    let eligible = false;
    if (!complete) {
      switch (part.type) {
        case "memory_fragment":
        case "story": {
          const sid = part.route?.split("sceneId=")?.[1];
          eligible  = sid ? storyScenesSeen.includes(sid) : true;
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
        ? Math.max(1, bestStar)
        : 3;

    let status: NodeStatus;
    if (complete)                                   status = "complete";
    else if (part.isPlaceholder)                    status = "placeholder";
    else if (!nextPicked && part.route) { status = "next"; nextPicked = true; }
    else                                            status = "available";

    return { part, layout, status, eligible, claimStars };
  });
}

// ── SVG bezier path ───────────────────────────────────────────────────────────

/** Cubic bezier S-curve connecting two zigzagging node positions. */
function bez(x1: number, y1: number, x2: number, y2: number): string {
  const my = ((y1 + y2) / 2).toFixed(1);
  return `M ${x1.toFixed(1)} ${y1} C ${x1.toFixed(1)} ${my} ${x2.toFixed(1)} ${my} ${x2.toFixed(1)} ${y2}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface Chapter1VisualMapProps {
  battleStars:     Record<string, number>;
  claimedNodes:    string[];
  storyScenesSeen: string[];
  chapterAccent:   string;
  onPartPress:     (part: ChapterPart) => void;
  onNodeClaim?:    (nodeId: string, stars: number) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Chapter1VisualMap({
  battleStars,
  claimedNodes,
  storyScenesSeen,
  chapterAccent,
  onPartPress,
  onNodeClaim,
}: Chapter1VisualMapProps) {
  const [W, setW] = useState(0);

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
    <View style={{ minHeight: CANVAS_H }} onLayout={onLayout}>
      {W > 0 && (
        <>
          {/* P14: Completed-segment glow (wider translucent path, renders below main path) */}
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

          {/* ─── SVG path layer (bottom) ─── */}
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
              return (
                <SvgPath
                  key={`seg-${i}`}
                  d={bez(ax, ay, bx, by)}
                  stroke={fromDone ? chapterAccent : "#33415590"}
                  strokeWidth={fromDone ? 3 : 2}
                  strokeDasharray={fromDone ? undefined : "8 5"}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>

          {/* P14: Outer pulse rings (wider radius, slower phase — renders below inner ring) */}
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

          {/* ─── Pulse glow rings (behind circles) ─── */}
          {nodes.map((nd) => {
            if (nd.status !== "next") return null;
            const x  = nd.layout.xf * W;
            const { r, y } = nd.layout;
            const tc = TYPE_COLOR[nd.part.type] ?? chapterAccent;
            return (
              <Animated.View
                key={`glow-${nd.part.id}`}
                style={{
                  pointerEvents: "none",
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
            const x = nd.layout.xf * W;
            const { r, y } = nd.layout;
            const tc = TYPE_COLOR[nd.part.type] ?? chapterAccent;

            const isActionable = !!nd.part.route && !nd.part.isPlaceholder;

            const borderColor =
              nd.status === "complete"      ? chapterAccent
              : nd.status === "next"        ? tc
              : nd.status === "placeholder" ? tc + "50"
              : tc + "70";

            const bgColor =
              nd.status === "complete" ? chapterAccent + "20"
              : nd.status === "next"   ? tc + "22"
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
                <Pressable
                  style={{
                    width:           r * 2,
                    height:          r * 2,
                    borderRadius:    r,
                    borderWidth:     bw,
                    borderColor,
                    backgroundColor: bgColor,
                    alignItems:      "center",
                    justifyContent:  "center",
                  }}
                  onPress={isActionable ? () => onPartPress(nd.part) : undefined}
                  hitSlop={10}
                  testID={`ch1-node-${nd.part.id}`}
                >
                  {nd.status === "complete" ? (
                    <Ionicons name="checkmark" size={Math.round(r * 0.78)} color={chapterAccent} />
                  ) : (
                    <Ionicons
                      name={nd.part.icon as any}
                      size={Math.round(r * 0.7)}
                      color={nd.status === "placeholder" ? tc + "55" : tc}
                    />
                  )}
                </Pressable>
              </Animated.View>
            );
          })}

          {/* ─── Labels ─── */}
          {nodes.map((nd) => {
            const x = nd.layout.xf * W;
            const { r, y, side } = nd.layout;
            const tc  = TYPE_COLOR[nd.part.type] ?? chapterAccent;
            const tl  = TYPE_LABEL[nd.part.type] ?? nd.part.type.toUpperCase();
            const dim = nd.status === "placeholder";

            const def = getJourneyNodeDef(nd.part.id);
            const rwd = def ? computeJourneyReward(def, nd.claimStars) : null;
            const xp  = rwd?.playerXp || nd.part.rewardXp;

            // Position label: to the side of the circle, or below for boss
            let posStyle: object;
            if (side === "right") {
              posStyle = {
                position: "absolute",
                top:      y - 42,
                left:     SPACING.sm,
                right:    W - x + r + 8,
                alignItems: "flex-end",
              };
            } else if (side === "left") {
              posStyle = {
                position: "absolute",
                top:      y - 42,
                left:     x + r + 8,
                right:    SPACING.sm,
                alignItems: "flex-start",
              };
            } else {
              // center: boss node — label below circle
              posStyle = {
                position: "absolute",
                top:      y + r + 10,
                left:     8,
                right:    8,
                alignItems: "center",
              };
            }

            return (
              <View
                key={`lbl-${nd.part.id}`}
                style={[styles.labelBase, posStyle, { pointerEvents: "box-none" }]}
              >
                {/* Type badge */}
                <View style={[styles.typeBadge, { backgroundColor: tc + "1A" }]}>
                  <Text style={[styles.typeTxt, { color: dim ? tc + "70" : tc }]}>
                    {tl}{dim ? " · SOON" : ""}
                  </Text>
                </View>

                {/* Title */}
                <Text
                  style={[
                    styles.nodeTitle,
                    side === "right"  && { textAlign: "right" },
                    side === "center" && { textAlign: "center" },
                    {
                      color: dim
                        ? COLORS.onSurfaceTertiary
                        : nd.status === "next"
                        ? COLORS.onSurface
                        : COLORS.onSurface + "CC",
                    },
                  ]}
                  numberOfLines={2}
                >
                  {nd.part.title}
                </Text>

                {/* XP reward chip */}
                {!!xp && xp > 0 && nd.status !== "complete" && (
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

                {/* P13: Anticipation teasers — approach to the boss node */}
                {nd.part.id === "c1n4" && nd.status === "complete" && !claimedNodes.includes("c1n6") && (
                  <View style={[styles.teaserRow, side === "left" && { alignSelf: "flex-start" }]}>
                    <Ionicons name="arrow-down" size={9} color="#F9731699" />
                    <Text style={[styles.teaserTxt, { color: "#F9731699" }]}>Trial approaching...</Text>
                  </View>
                )}
                {nd.part.id === "c1n5" && nd.status === "complete" && !claimedNodes.includes("c1n6") && (
                  <View style={[styles.teaserRow, side === "right" && { alignSelf: "flex-end" }]}>
                    <Ionicons name="arrow-down" size={9} color="#F97316" />
                    <Text style={[styles.teaserTxt, { color: "#F97316" }]}>Chapter Trial Ahead</Text>
                  </View>
                )}

                {/* Claim button */}
                {nd.status !== "complete" && nd.eligible && def && onNodeClaim && (
                  <NodeClaimBtn
                    side={side}
                    onClaim={() => onNodeClaim(nd.part.id, nd.claimStars)}
                  />
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

// ── NodeClaimBtn ──────────────────────────────────────────────────────────────

function NodeClaimBtn({
  side,
  onClaim,
}: {
  side:    NodeSide;
  onClaim: () => Promise<void>;
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
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical:   2,
    alignSelf: "flex-start",
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
    flexDirection: "row",
    alignItems:    "center",
    gap:           3,
    backgroundColor: COLORS.brand,
    borderRadius:  4,
    paddingHorizontal: 7,
    paddingVertical:   3,
    alignSelf:     "flex-start",
    marginTop:     2,
  },
  claimBtnTxt: {
    fontSize:      9,
    fontWeight:    "700",
    color:         "#FFF",
    letterSpacing: 0.5,
  },
  // P13: anticipation teasers
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
