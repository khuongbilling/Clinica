/**
 * GenericChapterVisualMap — visual game-map path for any chapter (Ch6–10).
 *
 * Dynamically renders a chapter's nodes in a zigzag connected path using
 * SVG cubic-bezier curves. Works for any node count (6–8).
 *
 * Layout rules:
 *  · Node 0       → right (xf 0.65)
 *  · Alternates   → left (xf 0.27) / right
 *  · Last node    → center (xf 0.50)
 *
 * Push 12 anticipation hooks (added per chapter):
 *  · Penultimate required node cleared → "One More Stand" teaser
 *  · Misted "next chapter" gate below canvas (Ch10 shows "Phase 1 Complete")
 *
 * Used inside ChapterJourneyMap for chapters 6–10.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import * as RNSvg from "react-native-svg";

import { CHAPTERS, type Chapter, type ChapterPart } from "@/src/game/chapterJourney";
import { ENEMIES } from "@/src/game/content";
import {
  computeJourneyReward,
  getJourneyNodeDef,
} from "@/src/game/journeyRewards";
import { COLORS, SPACING } from "@/src/theme/colors";

// ── SVG type shim (React 19 / rn-svg compat) ─────────────────────────────────

const Svg     = (RNSvg as any).default as React.ComponentType<any>;
const SvgPath = (RNSvg as any).Path   as React.ComponentType<any>;

// ── Type visual config ────────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  story:           "#B0DEFF",
  memory_fragment: "#F59E0B",
  challenge:       "#22D3EE",
  battle:          "#EF4444",
  mini_boss:       "#F97316",
  ward_defense:    "#FB923C",
  realm:           "#10B981",
  reflection:      "#A78BFA",
  mode_preview:    "#60A5FA",
  lesson:          "#34D399",
  minigame:        "#34D399",
  chain:           "#FB923C",
  community:       "#F472B6",
  arena:           "#8B5CF6",
  reward:          "#D4AF37",
};

const TYPE_LABEL: Record<string, string> = {
  story:           "STORY",
  memory_fragment: "MEMORY",
  challenge:       "CHALLENGE",
  battle:          "SHIFT",
  mini_boss:       "TRIAL",
  ward_defense:    "WARD DEF.",
  realm:           "REALM",
  reflection:      "REFLECTION",
  mode_preview:    "PREVIEW",
  lesson:          "LESSON",
  minigame:        "LAB",
  chain:           "CHAIN",
  community:       "COMMUNITY",
  arena:           "ARENA",
  reward:          "FINALE",
};

// ── Node geometry ─────────────────────────────────────────────────────────────

type NodeSide = "left" | "right" | "center";

interface NL {
  id:   string;
  xf:   number;
  y:    number;
  side: NodeSide;
  r:    number;
}

const NODE_SPACING = 120;
const START_Y      = 62;

function getNodeRadius(type: string): number {
  switch (type) {
    case "mini_boss":    return 36;
    case "battle":       return 30;
    case "ward_defense": return 30;
    case "realm":        return 32;
    case "arena":        return 28;
    case "minigame":     return 28;
    default:             return 26;
  }
}

function computeLayout(parts: ChapterPart[]): NL[] {
  return parts.map((p, i) => {
    const isLast = i === parts.length - 1;
    const side: NodeSide = isLast ? "center" : (i % 2 === 0 ? "right" : "left");
    const xf              = isLast ? 0.50 : (i % 2 === 0 ? 0.65 : 0.27);
    return {
      id:   p.id,
      xf,
      y:    START_Y + i * NODE_SPACING,
      side,
      r:    getNodeRadius(p.type),
    };
  });
}

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
  parts:           ChapterPart[],
  layout:          NL[],
  claimedNodes:    string[],
  battleStars:     Record<string, number>,
  storyScenesSeen: string[],
  chapterEnemies:  typeof ENEMIES,
): ND[] {
  const anyWon   = chapterEnemies.some((e) => (battleStars[e.id] ?? 0) >= 1);
  const bestStar = chapterEnemies.reduce(
    (b, e) => Math.max(b, battleStars[e.id] ?? 0), 0,
  );
  let nextPicked = false;

  return layout.map((nl, i) => {
    const part     = parts.find((p) => p.id === nl.id)!;
    const complete = claimedNodes.includes(part.id);

    const prevId   = i > 0 ? layout[i - 1].id : null;
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
        case "battle":
          // Placeholder battles are auto-eligible; real battles need a win
          eligible = part.isPlaceholder ? true : anyWon;
          break;
        case "mini_boss":
          eligible = part.isPlaceholder ? true : prevDone;
          break;
        case "ward_defense":
          eligible = true;
          break;
        case "realm":
          eligible = !!part.isPlaceholder;
          break;
        default:
          // mode_preview, lesson, minigame, chain, community, arena, reward,
          // challenge, reflection — all auto-eligible when chapter is active
          eligible = true;
          break;
      }
    }

    const claimStars =
      (part.type === "battle" || part.type === "mini_boss") && !part.isPlaceholder
        ? Math.max(1, bestStar)
        : 3;

    let status: NodeStatus;
    if (complete)                status = "complete";
    else if (!prevDone)          status = "locked";
    else if (part.isPlaceholder) status = "placeholder";
    else if (!nextPicked && part.route) { status = "next"; nextPicked = true; }
    else                         status = "available";

    return { part, layout: nl, status, eligible, claimStars };
  });
}

// ── SVG bezier path ───────────────────────────────────────────────────────────

function bez(x1: number, y1: number, x2: number, y2: number): string {
  const my = ((y1 + y2) / 2).toFixed(1);
  return `M ${x1.toFixed(1)} ${y1} C ${x1.toFixed(1)} ${my} ${x2.toFixed(1)} ${my} ${x2.toFixed(1)} ${y2}`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface GenericChapterVisualMapProps {
  chapter:         Chapter;
  battleStars:     Record<string, number>;
  claimedNodes:    string[];
  storyScenesSeen: string[];
  chapterAccent:   string;
  onPartPress:     (part: ChapterPart) => void;
  onNodeClaim?:    (nodeId: string, stars: number) => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function GenericChapterVisualMap({
  chapter,
  battleStars,
  claimedNodes,
  storyScenesSeen,
  chapterAccent,
  onPartPress,
  onNodeClaim,
}: GenericChapterVisualMapProps) {
  const [W, setW] = useState(0);

  const layout   = useMemo(() => computeLayout(chapter.parts), [chapter.parts]);
  const CANVAS_H = START_Y + (chapter.parts.length - 1) * NODE_SPACING + 80;

  const chapterEnemies = useMemo(
    () => ENEMIES.filter((e) => e.difficulty === chapter.number && !e.worldBoss),
    [chapter.number],
  );

  const pulse = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 1100, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0.3, duration: 1100, useNativeDriver: false }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const nodes = useMemo(
    () => buildNodeData(chapter.parts, layout, claimedNodes, battleStars, storyScenesSeen, chapterEnemies),
    [chapter.parts, layout, claimedNodes, battleStars, storyScenesSeen, chapterEnemies],
  );

  // P12 anticipation: show teaser when the second-to-last required node is cleared
  const requiredNodes = chapter.requiredCompletionNodes ?? [];
  const penultimateRequired = requiredNodes.length >= 2 ? requiredNodes[requiredNodes.length - 2] : null;
  const lastRequired        = requiredNodes.length > 0  ? requiredNodes[requiredNodes.length - 1] : null;
  const showFinalTeaser = !!(
    penultimateRequired &&
    lastRequired &&
    claimedNodes.includes(penultimateRequired) &&
    !claimedNodes.includes(lastRequired)
  );

  // Next chapter for mist gate
  const nextChapter = CHAPTERS[chapter.number]; // chapter.number is 1-indexed, array is 0-indexed → next

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== W) setW(w);
  };

  return (
    <View onLayout={onLayout}>
      <View style={{ minHeight: CANVAS_H }}>
        {W > 0 && (
          <>
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

            {/* ─── Pulse glow rings (next node) ─── */}
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

            {/* ─── Node circles ─── */}
            {nodes.map((nd) => {
              const x  = nd.layout.xf * W;
              const { r, y } = nd.layout;
              const tc           = TYPE_COLOR[nd.part.type] ?? chapterAccent;
              const isLocked     = nd.status === "locked";
              const isBossLocked = isLocked && nd.part.type === "mini_boss";
              const isWDLocked   = isLocked && nd.part.type === "ward_defense";
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

              const bw =
                nd.status === "complete" || nd.status === "next" ? 3 : 2;

              return (
                <Pressable
                  key={`circle-${nd.part.id}`}
                  style={{
                    position:        "absolute",
                    left:            x - r,
                    top:             y - r,
                    width:           r * 2,
                    height:          r * 2,
                    borderRadius:    r,
                    borderWidth:     bw,
                    borderColor,
                    backgroundColor: bgColor,
                    alignItems:      "center",
                    justifyContent:  "center",
                    opacity:         isLocked ? 0.45 : 1,
                  }}
                  onPress={isActionable ? () => onPartPress(nd.part) : undefined}
                  hitSlop={10}
                  testID={`ch${chapter.number}-node-${nd.part.id}`}
                >
                  {nd.status === "complete" ? (
                    <Ionicons name="checkmark" size={Math.round(r * 0.78)} color={chapterAccent} />
                  ) : isLocked ? (
                    isBossLocked ? (
                      <Ionicons name="skull-outline" size={Math.round(r * 0.7)} color={tc + "60"} />
                    ) : isWDLocked ? (
                      <Ionicons name="shield-outline" size={Math.round(r * 0.6)} color={tc + "50"} />
                    ) : (
                      <Ionicons name="lock-closed" size={Math.round(r * 0.6)} color={COLORS.onSurfaceTertiary} />
                    )
                  ) : (
                    <Ionicons
                      name={nd.part.icon as any}
                      size={Math.round(r * 0.7)}
                      color={nd.status === "placeholder" ? tc + "55" : tc}
                    />
                  )}
                </Pressable>
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
              const xp  = rwd?.playerXp ?? nd.part.rewardXp ?? 0;

              // P12 finale teaser: shown on the node just before the last required node
              const showOneMoreStand = showFinalTeaser && nd.part.id === penultimateRequired;

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

                  {/* Title */}
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

                  {/* XP chip */}
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

                  {/* P12 anticipation: one more stand */}
                  {showOneMoreStand && (
                    <View style={[
                      styles.teaserRow,
                      side === "right"  && { alignSelf: "flex-end" },
                      side === "center" && { alignSelf: "center" },
                    ]}>
                      <Ionicons name="arrow-down" size={8} color={chapterAccent + "BB"} />
                      <Text style={[styles.teaserTxt, { color: chapterAccent + "BB" }]}>
                        One More Stand
                      </Text>
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
          </>
        )}
      </View>

      {/* P13: Chapter clear card — shown when all required nodes are done */}
      {requiredNodes.length > 0 && requiredNodes.every((id) => claimedNodes.includes(id)) && (
        <View style={[styles.chClearCard, { borderColor: chapterAccent + "50" }]}>
          <View style={styles.chClearHeader}>
            <Ionicons name="trophy-outline" size={14} color={chapterAccent} />
            <Text style={[styles.chClearTitle, { color: chapterAccent }]}>
              CHAPTER {chapter.number} CLEARED
            </Text>
          </View>
          <Text style={styles.chClearSub}>
            {nextChapter
              ? `${nextChapter.theme} is now revealed.`
              : "The final chapter stands before you."}
          </Text>
        </View>
      )}

      {/* ─── Misted next-chapter gate ─── */}
      <View style={styles.nextChGate}>
        <View style={styles.nextChDivider} />
        <View style={styles.nextChContent}>
          <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary + "80"} />
          <View style={{ flex: 1 }}>
            {chapter.number === 10 ? (
              <>
                <Text style={styles.nextChLabel}>PHASE 1 COMPLETE</Text>
                <Text style={styles.nextChSub}>
                  The Silent Infarction is behind you. Phase 2 opens new wards.
                </Text>
              </>
            ) : nextChapter ? (
              <>
                <Text style={styles.nextChLabel}>
                  CHAPTER {chapter.number + 1} — {nextChapter.theme.toUpperCase()}
                </Text>
                <Text style={styles.nextChSub}>
                  {requiredNodes.length >= 2
                    ? `Clears when ${chapter.parts.find(p => p.id === requiredNodes[requiredNodes.length - 2])?.title ?? "penultimate"} + ${chapter.parts.find(p => p.id === lastRequired)?.title ?? "finale"} are complete`
                    : `Complete this chapter to unlock the next path`}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      </View>
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
  // ── Next-chapter mist gate ────────────────────────────────────────────────
  nextChGate: {
    marginTop:    24,
    marginBottom: 8,
    opacity:      0.55,
  },
  nextChDivider: {
    height:          1,
    backgroundColor: COLORS.border + "60",
    marginBottom:    12,
  },
  nextChContent: {
    flexDirection:     "row",
    alignItems:        "flex-start",
    gap:               8,
    paddingHorizontal: 4,
  },
  nextChLabel: {
    fontSize:      10,
    fontWeight:    "700",
    color:         COLORS.onSurfaceTertiary,
    letterSpacing: 0.8,
  },
  nextChSub: {
    fontSize:   9,
    color:      COLORS.onSurfaceTertiary + "AA",
    marginTop:  2,
    lineHeight: 13,
  },
  // P13: chapter clear card
  chClearCard: {
    marginTop:        8,
    marginHorizontal: 4,
    padding:          10,
    borderRadius:     6,
    borderWidth:      1,
    backgroundColor:  "rgba(0,0,0,0.06)",
    gap:              4,
  },
  chClearHeader: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  chClearTitle: {
    fontSize:      11,
    fontWeight:    "800",
    letterSpacing: 1,
  },
  chClearSub: {
    fontSize:   11,
    color:      COLORS.onSurfaceTertiary,
    lineHeight: 15,
    fontStyle:  "italic",
  },
});
