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
  { id: "c1n1", xf: 0.74, y:  75, side: "right",  r: 44 },
  { id: "c1n2", xf: 0.20, y: 255, side: "left",   r: 44 },
  { id: "c1n3", xf: 0.76, y: 435, side: "right",  r: 44 },
  { id: "c1n4", xf: 0.18, y: 615, side: "left",   r: 44 },
  { id: "c1n5", xf: 0.74, y: 785, side: "right",  r: 44 },
  { id: "c1n6", xf: 0.50, y: 975, side: "center", r: 56 },
];

const CANVAS_H = 1110;

// ── Chapter 1 data ────────────────────────────────────────────────────────────

const CH1         = CHAPTERS[0]!;
const CH1_ENEMIES = ENEMIES.filter((e) => e.difficulty === 1 && !e.worldBoss);

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
  const anyWon   = CH1_ENEMIES.some((e) => (battleStars[e.id] ?? 0) >= 1);
  const bestStar = CH1_ENEMIES.reduce((b, e) => Math.max(b, battleStars[e.id] ?? 0), 0);
  let nextPicked = false;

  return NODE_LAYOUT.map((layout, i) => {
    const part     = CH1.parts.find((p) => p.id === layout.id)!;
    const complete = claimedNodes.includes(part.id);

    // Sequential locking: node N only accessible if node N-1 has been claimed
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
          eligible  = sid ? storyScenesSeen.includes(sid) : true;
          break;
        }
        case "mini_boss": {
          // Claimable after beating the specific boss enemy; WD-style (no enemyId) auto-eligible
          const enemyId = part.route?.match(/enemyId=([^&]+)/)?.[1];
          eligible = enemyId ? (battleStars[enemyId] ?? 0) >= 1 : true;
          break;
        }
        case "challenge":   eligible = true; break;
        case "reflection":  eligible = true; break;
        case "battle":      eligible = anyWon; break;
        default:            eligible = false;
      }
    }

    const bossMiniEnemyId = part.type === "mini_boss"
      ? part.route?.match(/enemyId=([^&]+)/)?.[1]
      : undefined;
    const claimStars =
      part.type === "battle"
        ? Math.max(1, bestStar)
        : part.type === "mini_boss"
        ? Math.max(1, bossMiniEnemyId ? (battleStars[bossMiniEnemyId] ?? 0) : bestStar)
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

// ── Token size for hero map marker ────────────────────────────────────────────


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

  const bestStar = useMemo(
    () => CH1_ENEMIES.reduce((b, e) => Math.max(b, battleStars[e.id] ?? 0), 0),
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

  // Intercept part press: show popup for actionable nodes; auto-claim reflection nodes with no route
  const handleNodePress = (part: ChapterPart) => {
    if (part.route && !part.isPlaceholder) {
      setMissionPart(part);
    } else if (part.type === 'reflection' && !claimedNodes.includes(part.id) && onNodeClaim) {
      onNodeClaim(part.id, 3).catch(() => {});
    } else {
      onPartPress(part);
    }
  };

  return (
    <View style={{ minHeight: CANVAS_H }} onLayout={onLayout}>
      {/* ── Ch1 background: V3 Lotus Recall Sanctuary illustrated map ── */}
      <Image
        source={require("@/assets/map-bg/journey_map_ch1_sanctuary.png")}
        style={[StyleSheet.absoluteFillObject, { borderRadius: 12 }]}
        contentFit="cover"
      />
      {/* Ink & Mist: warm umber readability overlay (replaces jade teal) */}
      <View
        style={[StyleSheet.absoluteFillObject, { backgroundColor: "#1A0B0550", borderRadius: 12 }]}
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
                chapter={1}
                accentColor={chapterAccent}
                canvasW={W}
                canvasH={CANVAS_H}
              />
            );
          })}


          {/* ── Illustrated node shapes (replaces plain circles) ── */}
          {nodes.map((nd, idx) => {
            const x = nd.layout.xf * W;
            const { r, y } = nd.layout;
            const tc          = TYPE_COLOR[nd.part.type] ?? chapterAccent;
            const isLocked    = nd.status === "locked";
            // Reflection nodes with no route are tap-to-claim; all nodes respect sequential lock
            const isReflectionAutoClaimable =
              nd.part.type === 'reflection' && !nd.part.isPlaceholder &&
              !nd.part.route && !isLocked && !claimedNodes.includes(nd.part.id);
            const isActionable = isReflectionAutoClaimable ||
              (!!nd.part.route && !nd.part.isPlaceholder && !isLocked);
            const mapStatus: MapNodeStatus =
              nd.status === "complete"    ? "complete"    :
              nd.status === "next"        ? "next"        :
              nd.status === "placeholder" ? "placeholder" :
              isLocked                    ? "locked"      :
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
                  nodeStars={(() => {
                    const eid = nd.part.route?.match(/enemyId=([^&]+)/)?.[1];
                    return eid ? (battleStars[eid] ?? 0) : 0;
                  })()}
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
                pointerEvents="box-none"
                style={[styles.labelBase, posStyle]}
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
    marginTop:         8,
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
