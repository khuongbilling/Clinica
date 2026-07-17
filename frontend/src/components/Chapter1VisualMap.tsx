/**
 * Chapter1VisualMap — visual adventure map for Chapter 1 (Lotus Sanctuary).
 *
 * VISUAL UPGRADE (Push 26):
 *  · Chapter background: Jade/teal sanctuary gradient instead of plain surface.
 *  · Illustrated node shapes: type-specific decorated frames (not plain circles).
 *  · Painted path: dashed bezier + decorative waypoint dots.
 *  · Mission popup: tapping an actionable node shows MissionPopupModal before launch.
 *  · Hero sprite: lead hero portrait floats above the active "next" node.
 *  · Mist overlay: locked/placeholder nodes appear faded with lock glyph.
 *
 * All progression logic (eligibility, claim, stars, scenarios) is preserved.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
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
import { COLORS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";
import { MapNodeShape, type MapNodeStatus } from "./MapNodeShape";
import { MissionPopupModal } from "./MissionPopupModal";
import { useVisualMapAnims } from "./VisualMapHooks";

// ── SVG type shim ─────────────────────────────────────────────────────────────

const Svg      = (RNSvg as any).default as React.ComponentType<any>;
const SvgPath  = (RNSvg as any).Path   as React.ComponentType<any>;
const SvgCircle = (RNSvg as any).Circle as React.ComponentType<any>;

// ── Chapter 1 theme ───────────────────────────────────────────────────────────
// Lotus Recall Sanctuary & Training Grounds
// Palette: deep jade navy → soft teal mist → lotus pink accents

const CH1_BG_TOP    = "#0A2018";  // deep jade sanctuary
const CH1_BG_MID    = "#0B1D28";  // healing navy
const CH1_BG_BOTTOM = "#0B1825";  // sanctuary base (matches UI.sanctuaryBg)

// ── Type colours per Ch1 node types ─────────────────────────────────────────

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
  xf:   number;
  y:    number;
  side: NodeSide;
  r:    number;
}

const NODE_LAYOUT: NL[] = [
  { id: "c1n1", xf: 0.67, y: 60,  side: "right",  r: 28 },
  { id: "c1n2", xf: 0.24, y: 180, side: "left",   r: 28 },
  { id: "c1n3", xf: 0.70, y: 300, side: "right",  r: 28 },
  { id: "c1n4", xf: 0.21, y: 420, side: "left",   r: 28 },
  { id: "c1n5", xf: 0.68, y: 530, side: "right",  r: 28 },
  { id: "c1n6", xf: 0.47, y: 665, side: "center", r: 34 },
];

const CANVAS_H = 800;

// ── Chapter 1 data ────────────────────────────────────────────────────────────

const CH1         = CHAPTERS[0]!;
const CH1_ENEMIES = ENEMIES.filter((e) => e.difficulty === 1 && !e.worldBoss);

// ── Node status ───────────────────────────────────────────────────────────────

type NodeStatus = "complete" | "next" | "available" | "placeholder";

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
  const anyWon   = CH1_ENEMIES.some((e) => (battleStars[e.id] ?? 0) >= 1);
  const bestStar = CH1_ENEMIES.reduce((b, e) => Math.max(b, battleStars[e.id] ?? 0), 0);
  let nextPicked = false;

  return NODE_LAYOUT.map((layout) => {
    const part     = CH1.parts.find((p) => p.id === layout.id)!;
    const complete = claimedNodes.includes(part.id);

    let eligible = false;
    if (!complete) {
      switch (part.type) {
        case "memory_fragment":
        case "story": {
          const sid = part.route?.split("sceneId=")?.[1];
          eligible  = sid ? storyScenesSeen.includes(sid) : true;
          break;
        }
        case "challenge":   eligible = true; break;
        case "reflection":  eligible = !!part.isPlaceholder; break;
        case "battle":      eligible = anyWon; break;
        case "mini_boss":   eligible = bestStar >= 2; break;
        default:            eligible = false;
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

function bez(x1: number, y1: number, x2: number, y2: number): string {
  const my = ((y1 + y2) / 2).toFixed(1);
  return `M ${x1.toFixed(1)} ${y1} C ${x1.toFixed(1)} ${my} ${x2.toFixed(1)} ${my} ${x2.toFixed(1)} ${y2}`;
}

// ── Waypoint dots along path ──────────────────────────────────────────────────

/** Compute 3 evenly-spaced points along a cubic bezier (rough approximation). */
function bezPoints(x1: number, y1: number, x2: number, y2: number): Array<{ x: number; y: number }> {
  const my = (y1 + y2) / 2;
  const pts: Array<{ x: number; y: number }> = [];
  for (const t of [0.25, 0.5, 0.75]) {
    // De Casteljau: C x1,my x2,my x2,y2
    const bx = (1 - t) ** 3 * x1 + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3 * x2;
    const by = (1 - t) ** 3 * y1 + 3 * (1 - t) ** 2 * t * my + 3 * (1 - t) * t ** 2 * my + t ** 3 * y2;
    pts.push({ x: bx, y: by });
  }
  return pts;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface Chapter1VisualMapProps {
  battleStars:     Record<string, number>;
  claimedNodes:    string[];
  storyScenesSeen: string[];
  chapterAccent:   string;
  onPartPress:     (part: ChapterPart) => void;
  onNodeClaim?:    (nodeId: string, stars: number) => Promise<void>;
  leadHeroSprite?: ImageSourcePropType;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Chapter1VisualMap({
  battleStars,
  claimedNodes,
  storyScenesSeen,
  chapterAccent,
  onPartPress,
  onNodeClaim,
  leadHeroSprite,
}: Chapter1VisualMapProps) {
  const [W, setW] = useState(0);
  const [missionPart, setMissionPart] = useState<ChapterPart | null>(null);

  const { pulse, pulseOuter, entranceAnims } = useVisualMapAnims(NODE_LAYOUT.length);

  const nodes = useMemo(
    () => buildNodeData(claimedNodes, battleStars, storyScenesSeen),
    [claimedNodes, battleStars, storyScenesSeen],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== W) setW(w);
  };

  // Intercept part press: show popup for battle/boss/ward nodes; direct launch for others
  const handleNodePress = (part: ChapterPart) => {
    if (part.type === "battle" || part.type === "mini_boss" || part.type === "ward_defense") {
      setMissionPart(part);
    } else {
      onPartPress(part);
    }
  };

  return (
    <View style={{ minHeight: CANVAS_H }} onLayout={onLayout}>
      {/* ── Chapter 1 background: Lotus Sanctuary gradient ── */}
      <LinearGradient
        colors={[CH1_BG_TOP, CH1_BG_MID, CH1_BG_BOTTOM]}
        style={[StyleSheet.absoluteFillObject, { borderRadius: 12 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        pointerEvents="none"
      />

      {/* Decorative lotus mist circles in background */}
      {W > 0 && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          {[
            { x: W * 0.1, y: 120, r: 80, op: "06" },
            { x: W * 0.85, y: 340, r: 60, op: "05" },
            { x: W * 0.3, y: 580, r: 90, op: "06" },
            { x: W * 0.7, y: 700, r: 50, op: "04" },
          ].map((c, i) => (
            <View
              key={i}
              style={{
                position:        "absolute",
                left:            c.x - c.r,
                top:             c.y - c.r,
                width:           c.r * 2,
                height:          c.r * 2,
                borderRadius:    c.r,
                backgroundColor: chapterAccent + c.op,
              }}
            />
          ))}
        </View>
      )}

      {W > 0 && (
        <>
          {/* ── Completed-segment glow (wide translucent path) ── */}
          <Svg width={W} height={CANVAS_H} style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {nodes.map((nd, i) => {
              if (i >= nodes.length - 1 || nd.status !== "complete") return null;
              return (
                <SvgPath
                  key={`glow-seg-${i}`}
                  d={bez(nd.layout.xf * W, nd.layout.y, nodes[i + 1].layout.xf * W, nodes[i + 1].layout.y)}
                  stroke={chapterAccent + "35"}
                  strokeWidth={10}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>

          {/* ── Main SVG path layer ── */}
          <Svg width={W} height={CANVAS_H} style={StyleSheet.absoluteFillObject} pointerEvents="none">
            {nodes.map((nd, i) => {
              if (i >= nodes.length - 1) return null;
              const ax = nd.layout.xf * W;
              const ay = nd.layout.y;
              const bx = nodes[i + 1].layout.xf * W;
              const by = nodes[i + 1].layout.y;
              const fromDone = nd.status === "complete";
              return (
                <React.Fragment key={`seg-${i}`}>
                  {/* Main path stroke */}
                  <SvgPath
                    d={bez(ax, ay, bx, by)}
                    stroke={fromDone ? chapterAccent + "CC" : "#3DC4A830"}
                    strokeWidth={fromDone ? 3 : 1.5}
                    strokeDasharray={fromDone ? undefined : "6 7"}
                    fill="none"
                    strokeLinecap="round"
                  />
                  {/* Waypoint dots along uncompleted path segments */}
                  {!fromDone && bezPoints(ax, ay, bx, by).map((pt, di) => (
                    <SvgCircle
                      key={`dot-${i}-${di}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={2}
                      fill={"#3DC4A840"}
                    />
                  ))}
                </React.Fragment>
              );
            })}
          </Svg>

          {/* ── Outer pulse rings (wider, slower phase) ── */}
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
                  left:            x - r - 24,
                  top:             y - r - 24,
                  width:           (r + 24) * 2,
                  height:          (r + 24) * 2,
                  borderRadius:    r + 24,
                  backgroundColor: tc + "12",
                  opacity:         pulseOuter,
                }}
              />
            );
          })}

          {/* ── Inner pulse glow rings ── */}
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
                  backgroundColor: tc + "28",
                  opacity:         pulse,
                }}
              />
            );
          })}

          {/* ── Illustrated node shapes (replaces plain circles) ── */}
          {nodes.map((nd, idx) => {
            const x = nd.layout.xf * W;
            const { r, y } = nd.layout;
            const tc          = TYPE_COLOR[nd.part.type] ?? chapterAccent;
            const isActionable = !!nd.part.route && !nd.part.isPlaceholder;
            const mapStatus: MapNodeStatus =
              nd.status === "complete"    ? "complete"    :
              nd.status === "next"        ? "next"        :
              nd.status === "placeholder" ? "placeholder" :
              "available";

            const entrAnim = entranceAnims[idx]!;
            const scale = entrAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

            return (
              <Animated.View
                key={`node-${nd.part.id}`}
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
                  status={mapStatus}
                  accentColor={tc}
                  r={r}
                  isActionable={isActionable}
                  onPress={() => handleNodePress(nd.part)}
                  testID={`ch1-node-${nd.part.id}`}
                />
              </Animated.View>
            );
          })}

          {/* ── Node labels ── */}
          {nodes.map((nd) => {
            const x = nd.layout.xf * W;
            const { r, y, side } = nd.layout;
            const tc  = TYPE_COLOR[nd.part.type] ?? chapterAccent;
            const tl  = TYPE_LABEL[nd.part.type] ?? nd.part.type.toUpperCase();
            const dim = nd.status === "placeholder";

            const def = getJourneyNodeDef(nd.part.id);
            const rwd = def ? computeJourneyReward(def, nd.claimStars) : null;
            const xp  = rwd?.playerXp || nd.part.rewardXp;

            let posStyle: object;
            if (side === "right") {
              posStyle = {
                position: "absolute",
                top:      y - 44,
                left:     SPACING.sm,
                right:    W - x + r + 10,
                alignItems: "flex-end",
              };
            } else if (side === "left") {
              posStyle = {
                position: "absolute",
                top:      y - 44,
                left:     x + r + 10,
                right:    SPACING.sm,
                alignItems: "flex-start",
              };
            } else {
              posStyle = {
                position: "absolute",
                top:      y + r + 12,
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
                <View style={[styles.typeBadge, { backgroundColor: tc + "22", borderColor: tc + "40" }]}>
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
                    { color: dim ? UI.textDim : nd.status === "next" ? UI.text : UI.textSoft },
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

                {/* TAP pill on active next-node */}
                {nd.status === "next" && !!nd.part.route && !nd.part.isPlaceholder && (
                  <View style={[
                    styles.tapPill,
                    { borderColor: tc + "60", backgroundColor: tc + "18" },
                    side === "right"  && { alignSelf: "flex-end" },
                    side === "center" && { alignSelf: "center"   },
                  ]}>
                    <Ionicons name="play" size={8} color={tc} />
                    <Text style={[styles.tapPillTxt, { color: tc }]}>TAP TO BEGIN</Text>
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
                    <Ionicons name="checkmark-circle" size={10} color="#3DC4A8" />
                    <Text style={styles.clearedTxt}>CLEARED</Text>
                  </View>
                )}

                {/* Anticipation teasers */}
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
                {nd.status !== "complete" && nd.eligible && getJourneyNodeDef(nd.part.id) && onNodeClaim && (
                  <NodeClaimBtn
                    side={side}
                    onClaim={() => onNodeClaim(nd.part.id, nd.claimStars)}
                  />
                )}
              </View>
            );
          })}

          {/* ── Lead hero traveler sprite ── */}
          {leadHeroSprite && nodes.map((nd) => {
            if (nd.status !== "next") return null;
            const x = nd.layout.xf * W;
            const { r, y } = nd.layout;
            const SR = 18;
            return (
              <View
                key={`hero-sprite-${nd.part.id}`}
                pointerEvents="none"
                style={{
                  position:        "absolute",
                  left:            x - SR,
                  top:             y - r - SR * 2 - 10,
                  width:           SR * 2,
                  height:          SR * 2,
                  borderRadius:    SR,
                  overflow:        "hidden",
                  borderWidth:     2.5,
                  borderColor:     UI.gold,
                  backgroundColor: UI.bgDeep,
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

      {/* ── Mission popup modal ── */}
      <MissionPopupModal
        part={missionPart}
        chapterAccent={chapterAccent}
        chapterNumber={1}
        battleStars={battleStars}
        onClose={() => setMissionPart(null)}
      />
    </View>
  );
}

// ── NodeClaimBtn ───────────────────────────────────────────────────────────────

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
      <Ionicons name="gift-outline" size={10} color="#000" />
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
    borderRadius:      4,
    borderWidth:       1,
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
    color:      "#E8C868",
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
    color:         "#3DC4A8",
    letterSpacing: 0.5,
  },
  claimBtn: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               3,
    backgroundColor:   UI.gold,
    borderRadius:      4,
    paddingHorizontal: 8,
    paddingVertical:   3,
    alignSelf:         "flex-start",
    marginTop:         2,
  },
  claimBtnTxt: {
    fontSize:      9,
    fontWeight:    "800",
    color:         "#0B1020",
    letterSpacing: 0.5,
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
  tapPill: {
    flexDirection:     "row",
    alignItems:        "center",
    gap:               3,
    borderWidth:       1,
    borderRadius:      4,
    paddingHorizontal: 6,
    paddingVertical:   3,
    alignSelf:         "flex-start",
    marginTop:         2,
  },
  tapPillTxt: {
    fontSize:      8,
    fontWeight:    "800",
    letterSpacing: 0.8,
  },
});
