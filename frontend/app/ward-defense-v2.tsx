/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * RENDERING APPROACH — IMAGE-FIRST:
 *   The board background, all unit sprites, and all enemy sprites are now
 *   actual PNG image assets generated as illustrated artwork.  No more
 *   CSS-rectangle "sticker" art.  React Native Views are used only for
 *   interactive overlays (deploy pads, health bars, HUD badges, projectiles).
 *
 * Enemy movement: positions computed from pathIndex + pathProgress
 * Projectiles:    positions computed from fromFx / toFx / progress
 */
import React from "react";
import {
  View, Text, Image, Animated, Pressable,
  StyleSheet, LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/* ── Path + tile constants — must mirror ward-defense.tsx ─────────────────── */
const PATH_WPS: [number, number][] = [
  [0.88, 0.09],
  [0.14, 0.09],
  [0.14, 0.47],
  [0.86, 0.47],
  [0.86, 0.88],
  [0.11, 0.88],
];

const DEPLOY_TILES: [number, number][] = [
  [0.38, 0.27], [0.55, 0.27], [0.72, 0.27],
  [0.30, 0.67], [0.50, 0.67], [0.70, 0.67],
];

/* ── Illustrated image assets ─────────────────────────────────────────────── */
/* These are AI-generated PNGs — NOT CSS shapes */
const IMG_BOARD   = require("../assets/images/ward_board_scene.png");
const IMG_UNITS: Record<string, any> = {
  ward_scout:  require("../assets/images/sprite_ward_scout.png"),
  mist_caster: require("../assets/images/sprite_mist_caster.png"),
  o2_healer:   require("../assets/images/sprite_o2_healer.png"),
};
const IMG_ENEMIES: Record<string, any> = {
  breathless_wisp:    require("../assets/images/enemy_breathless_wisp.png"),
  wheeze_sprite:      require("../assets/images/enemy_wheeze_sprite.png"),
  mucus_slime:        require("../assets/images/enemy_mucus_slime.png"),
  hypoxia_wraith:     require("../assets/images/enemy_hypoxia_wraith.png"),
  bronchospasm_drake: require("../assets/images/enemy_bronchospasm_drake.png"),
};

/* ── Enemy accent colors (for HP bars / cue badges) ──────────────────────── */
const ENEMY_COLOR: Record<string, string> = {
  breathless_wisp:    "#93c5fd",
  wheeze_sprite:      "#34d399",
  mucus_slime:        "#86efac",
  hypoxia_wraith:     "#c4b5fd",
  bronchospasm_drake: "#fb923c",
};

/* ── Prop interface ───────────────────────────────────────────────────────── */
export interface WardBoardV2Props {
  aw: number; ah: number;
  onLayout: (e: LayoutChangeEvent) => void;
  enemies: any[];
  deployedUnits: any[];
  projectiles: any[];
  stability: number;
  phase: string;
  wave: number;
  selectedUnit: string | null;
  ap: number;
  bobY: Animated.AnimatedInterpolation<number>;
  spawnQueueLen: number;
  mergeTileSet: Set<number>;
  onTilePress: (i: number) => void;
  canAfford: boolean;
  unitColors: Record<string, string>;
}

/* ── Pure helpers ─────────────────────────────────────────────────────────── */
function cl(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lp(a: number, b: number, t: number)   { return a + (b - a) * cl(t, 0, 1); }

function getEnemyFrac(e: { pathIndex: number; pathProgress: number }): [number, number] {
  const pi   = cl(e.pathIndex, 0, PATH_WPS.length - 2);
  const from = PATH_WPS[pi];
  const to   = PATH_WPS[pi + 1];
  return [lp(from[0], to[0], e.pathProgress), lp(from[1], to[1], e.pathProgress)];
}

/* ════════════════════════════════════════════════════════════════════════════
   BOARD SCENE — illustrated PNG background + thin directional guide overlay
════════════════════════════════════════════════════════════════════════════ */
function BoardScene({ aw, ah }: { aw: number; ah: number }) {
  /* Direction arrows along path midpoints */
  const arrows: { cx: number; cy: number; deg: number }[] = [];
  for (let seg = 0; seg < PATH_WPS.length - 1; seg++) {
    const [ax, ay] = PATH_WPS[seg];
    const [bx, by] = PATH_WPS[seg + 1];
    const cx = (ax + bx) / 2 * aw;
    const cy = (ay + by) / 2 * ah;
    const deg = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
    arrows.push({ cx, cy, deg });
  }

  return (
    <>
      {/* Illustrated board background */}
      <Image
        source={IMG_BOARD}
        style={StyleSheet.absoluteFillObject}
        resizeMode="cover"
      />
      {/* Subtle darkening overlay at edges — improves sprite/UI readability */}
      <LinearGradient
        colors={["#00000040", "#00000000", "#00000000", "#00000050"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { pointerEvents: "none" } as any]}
      />
      {/* Path direction arrows — subtle guide over the illustrated path */}
      {aw > 20 && arrows.map((a, i) => (
        <View key={i} style={{
          position: "absolute",
          left: a.cx - 10, top: a.cy - 10,
          width: 20, height: 20,
          alignItems: "center", justifyContent: "center",
          transform: [{ rotate: `${a.deg}deg` }],
          zIndex: 2,
          opacity: 0.55,
        }}>
          <View style={{ width: 0, height: 0,
            borderTopWidth: 6, borderBottomWidth: 6, borderLeftWidth: 10,
            borderTopColor: "transparent", borderBottomColor: "transparent",
            borderLeftColor: "#fde68a",
          }}/>
        </View>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DISEASE PORTAL — purple void gate overlay at PATH_WPS[0]
════════════════════════════════════════════════════════════════════════════ */
function DiseasePortal({ aw, ah }: { aw: number; ah: number }) {
  const [fx, fy] = PATH_WPS[0];
  const px = fx * aw, py = fy * ah;
  return (
    <View style={{
      position: "absolute",
      left: Math.min(px - 38, aw - 84), top: Math.max(2, py - 44),
      alignItems: "center", zIndex: 20,
    }}>
      {/* Label */}
      <View style={{
        backgroundColor: "#3b0764e8", borderRadius: 6,
        paddingHorizontal: 7, paddingVertical: 2, marginBottom: 4,
        borderWidth: 1, borderColor: "#a855f7",
      }}>
        <Text style={{ color: "#e9d5ff", fontSize: 7, fontWeight: "800", letterSpacing: 0.8 }}>
          DISEASE GATE
        </Text>
      </View>
      {/* Portal ring */}
      <View style={{
        width: 54, height: 54, borderRadius: 27,
        backgroundColor: "#2e1065d0",
        borderWidth: 3, borderColor: "#a855f7",
        alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        <LinearGradient
          colors={["#4c1d95", "#1e0535", "#0a0018"]}
          start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ position: "absolute", width: 42, height: 42, borderRadius: 21,
          borderWidth: 1.5, borderColor: "#7c3aed80" }}/>
        <View style={{ position: "absolute", width: 26, height: 26, borderRadius: 13,
          borderWidth: 1, borderColor: "#a855f760" }}/>
        <View style={{
          width: 14, height: 12, borderRadius: 7,
          backgroundColor: "#7c3aed40", borderWidth: 2, borderColor: "#c084fccc",
          alignItems: "center", justifyContent: "center",
        }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#a855f7ee" }}/>
        </View>
      </View>
      {/* Spike accents */}
      <View style={{ flexDirection: "row", gap: 5, marginTop: 3 }}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{
            width: 2, height: 7, borderRadius: 1,
            backgroundColor: "#a855f760",
            transform: [{ rotate: `${(i - 1) * 15}deg` }],
          }}/>
        ))}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VITAL LANTERN — glowing healing core at PATH_WPS[last]
════════════════════════════════════════════════════════════════════════════ */
function VitalLantern({ stability, aw, ah }: { stability: number; aw: number; ah: number }) {
  const [fx, fy] = PATH_WPS[PATH_WPS.length - 1];
  const px = fx * aw, py = fy * ah;
  const pct  = cl(stability, 0, 100);
  const glow = pct > 60 ? "#22d3ee" : pct > 30 ? "#facc15" : "#ef4444";

  return (
    <View style={{
      position: "absolute",
      left: Math.max(2, px - 40), top: Math.min(ah - 120, py - 88),
      alignItems: "center", zIndex: 20,
    }}>
      {/* Label */}
      <View style={{
        backgroundColor: "#0c2a2ae8", borderRadius: 6,
        paddingHorizontal: 7, paddingVertical: 2, marginBottom: 3,
        borderWidth: 1, borderColor: glow + "80",
      }}>
        <Text style={{ color: "#a7f3d0", fontSize: 7, fontWeight: "800", letterSpacing: 0.5 }}>
          VITAL LANTERN
        </Text>
      </View>
      {/* Stability bar */}
      <View style={{
        width: 64, height: 5, backgroundColor: "#0d202070",
        borderRadius: 3, marginBottom: 4, overflow: "hidden",
        borderWidth: 1, borderColor: "#ffffff30",
      }}>
        <View style={{ width: `${pct}%` as any, height: "100%",
          backgroundColor: glow, borderRadius: 3 }}/>
      </View>
      {/* Outer glow */}
      <View style={{
        position: "absolute", top: 26, left: 0, width: 78, height: 78, borderRadius: 39,
        backgroundColor: glow + "0e", borderWidth: 1.5, borderColor: glow + "25",
      }}/>
      {/* Shrine pillar */}
      <View style={{
        width: 12, height: 26, backgroundColor: "#1a3a2a",
        borderRadius: 3, borderWidth: 1.5, borderColor: glow + "50",
        alignItems: "center", justifyContent: "center",
      }}>
        <View style={{ width: 2, height: 16, backgroundColor: glow + "60", borderRadius: 1 }}/>
      </View>
      {/* Lantern body */}
      <View style={{
        width: 56, height: 56, borderRadius: 12,
        backgroundColor: "#081a14", borderWidth: 2.5, borderColor: glow,
        alignItems: "center", justifyContent: "center",
        overflow: "hidden", marginTop: -3,
      }}>
        <LinearGradient
          colors={[glow + "45", "#0a1e16", "#040e0a"]}
          start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={{ position: "absolute", width: 42, height: 42, borderRadius: 21,
          borderWidth: 1.5, borderColor: glow + "55" }}/>
        <View style={{ position: "absolute", width: 26, height: 26, borderRadius: 13,
          borderWidth: 1, borderColor: glow + "80" }}/>
        <View style={{
          width: 18, height: 18, borderRadius: 9,
          backgroundColor: glow + "35", borderWidth: 2, borderColor: glow + "cc",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 10 }}>✦</Text>
        </View>
      </View>
      {/* Pedestal */}
      <View style={{
        width: 66, height: 10, borderRadius: 5,
        backgroundColor: "#1a3a2a", borderWidth: 1.5, borderColor: glow + "50", marginTop: -2,
      }}/>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DEPLOY PAD — transparent pressable zone over the illustrated platform
   Shows a subtle glow ring when empty, the unit image sprite when occupied
════════════════════════════════════════════════════════════════════════════ */
interface DPProps {
  tileIdx: number; unit: any;
  selectedUnit: string | null; canAfford: boolean;
  isMergeCandidate: boolean; onPress: () => void;
  aw: number; ah: number;
  unitColors: Record<string, string>;
  bobY: Animated.AnimatedInterpolation<number>;
}

function DeployPad({ tileIdx, unit, selectedUnit, canAfford, isMergeCandidate, onPress, aw, ah, unitColors, bobY }: DPProps) {
  const [fx, fy]   = DEPLOY_TILES[tileIdx];
  const px = fx * aw, py = fy * ah;
  const isOccupied = !!unit;
  const padColor   = isOccupied
    ? (unitColors[unit.typeId] ?? "#60a5fa")
    : canAfford ? "#22d3ee" : "#64748b";
  const SZ = 58; /* tile hit zone */

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: px - SZ / 2 - 4, top: py - SZ / 2 - 36,
        width: SZ + 8, height: SZ + 44,
        alignItems: "center", zIndex: 15,
      }}
    >
      {/* Unit image sprite — stands above the tile */}
      {isOccupied && (
        <Animated.View style={{
          marginBottom: -4,
          transform: [{ translateY: bobY }],
          zIndex: 16,
        }}>
          {/* Level badge */}
          {(unit.level ?? 1) > 1 && (
            <View style={{
              position: "absolute", top: -4, right: -4, zIndex: 17,
              backgroundColor: (unit.level ?? 1) >= 3 ? "#FFD700" : "#a78bfa",
              borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1,
            }}>
              <Text style={{ color: "#0a0a1a", fontSize: 5, fontWeight: "800" }}>
                Lv.{unit.level}
              </Text>
            </View>
          )}
          {/* Cast flash ring */}
          {(unit.castFlash ?? 0) > 0 && (
            <View style={{
              position: "absolute", top: -5, left: -5, right: -5, bottom: -5,
              borderRadius: 40, borderWidth: 2.5, borderColor: padColor + "aa", zIndex: 15,
            }}/>
          )}
          {/* Merge glow */}
          {isMergeCandidate && (
            <View style={{
              position: "absolute", top: -8, left: -8, right: -8, bottom: -8,
              borderRadius: 44, borderWidth: 2, borderColor: "#FFD70099",
              backgroundColor: "#FFD70015", zIndex: 15,
            }}/>
          )}
          {/* The illustrated unit sprite image */}
          <Image
            source={IMG_UNITS[unit.typeId] ?? IMG_UNITS.ward_scout}
            style={{ width: 54, height: 66 }}
            resizeMode="contain"
          />
          {/* Ground shadow under sprite */}
          <View style={{
            width: 40, height: 6, borderRadius: 20,
            backgroundColor: "#000000aa", alignSelf: "center", marginTop: -4,
          }}/>
        </Animated.View>
      )}

      {/* Tile interactive zone */}
      <View style={{
        width: SZ, height: SZ, borderRadius: 12,
        backgroundColor: isOccupied ? padColor + "12" : canAfford ? "#22d3ee10" : "#00000025",
        borderWidth: isOccupied ? 2 : 1.5,
        borderColor: isOccupied
          ? padColor + "cc"
          : isMergeCandidate
            ? "#FFD700aa"
            : canAfford
              ? "#22d3ee80"
              : "#64748b50",
        alignItems: "center", justifyContent: "center",
      }}>
        {/* Empty pad — "+" deploy indicator */}
        {!isOccupied && (
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            <View style={{
              width: 24, height: 2.5, borderRadius: 1.5,
              backgroundColor: canAfford ? "#22d3ee60" : "#64748b40",
            }}/>
            <View style={{
              width: 2.5, height: 24, borderRadius: 1.5,
              position: "absolute",
              backgroundColor: canAfford ? "#22d3ee60" : "#64748b40",
            }}/>
          </View>
        )}
        {/* Occupied — unit category label strip */}
        {isOccupied && (
          <View style={{
            position: "absolute", bottom: 3,
            backgroundColor: padColor + "22", borderRadius: 4,
            paddingHorizontal: 5, paddingVertical: 1,
          }}>
            <Text style={{ color: padColor, fontSize: 6, fontWeight: "800", letterSpacing: 0.3 }}>
              {unit.typeId === "ward_scout" ? "ASSESS"
                : unit.typeId === "mist_caster" ? "TREAT" : "SUPPORT"}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ENEMY ON PATH — illustrated disease-spirit image with HP bar + cue badge
   Position is computed from pathIndex + pathProgress (FIXED — not enemy.x)
════════════════════════════════════════════════════════════════════════════ */
function EnemyOnPath({
  enemy, bobY, aw, ah,
}: { enemy: any; bobY: Animated.AnimatedInterpolation<number>; aw: number; ah: number }) {
  const [fx, fy] = getEnemyFrac(enemy);
  const px = fx * aw;
  const py = fy * ah;

  const hpPct    = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const barColor = hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#facc15" : "#ef4444";
  const isFlash  = (enemy.hitFlash ?? 0) > 0;
  const isBoss   = enemy.typeId === "bronchospasm_drake";
  const sprW     = isBoss ? 68 : 50;
  const sprH     = isBoss ? 68 : 50;
  const barW     = isBoss ? 60 : 44;
  const accentC  = ENEMY_COLOR[enemy.typeId] ?? "#94a3b8";
  const img      = IMG_ENEMIES[enemy.typeId];

  return (
    <Animated.View style={{
      position: "absolute",
      left: px - sprW / 2,
      top: py - sprH - 28,
      alignItems: "center",
      zIndex: 14,
      transform: [{ translateY: bobY }],
    }}>
      {/* HP bar */}
      <View style={{
        width: barW, height: 5, backgroundColor: "#00000090",
        borderRadius: 3, marginBottom: 2, overflow: "hidden",
        borderWidth: 0.5, borderColor: "#ffffff25",
      }}>
        <View style={{ width: `${hpPct * 100}%` as any, height: "100%",
          backgroundColor: barColor, borderRadius: 3 }}/>
      </View>

      {/* Clinical cue badge */}
      <View style={{
        backgroundColor: accentC + "28", borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1, marginBottom: 3,
        borderWidth: 0.5, borderColor: accentC + "80",
        maxWidth: barW + 20,
      }}>
        <Text
          style={{ color: accentC, fontSize: 6.5, fontWeight: "700", textAlign: "center" }}
          numberOfLines={1}
        >
          {enemy.clue ?? enemy.name ?? "?"}
        </Text>
      </View>

      {/* Boss HP number */}
      {isBoss && (
        <Text style={{ color: accentC, fontSize: 8, fontWeight: "700", marginBottom: 1 }}>
          {enemy.hp}
        </Text>
      )}

      {/* Hit flash overlay */}
      {isFlash && (
        <View style={{
          position: "absolute", top: 22, left: 0, right: 0, bottom: 6,
          backgroundColor: "#ffffff35", borderRadius: 10, zIndex: 15,
        }}/>
      )}

      {/* Slow indicator */}
      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{
          position: "absolute", top: 18, right: -10,
          backgroundColor: "#A78BFA22", borderRadius: 4, paddingHorizontal: 3,
        }}>
          <Text style={{ color: "#A78BFA", fontSize: 6 }}>↓</Text>
        </View>
      )}

      {/* ILLUSTRATED enemy sprite image */}
      {img ? (
        <Image
          source={img}
          style={{ width: sprW, height: sprH }}
          resizeMode="contain"
        />
      ) : (
        /* Fallback — plain tinted circle if image missing */
        <View style={{
          width: sprW, height: sprH, borderRadius: sprW / 2,
          backgroundColor: accentC + "33", borderWidth: 2, borderColor: accentC,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: isBoss ? 24 : 18 }}>
            {enemy.typeId === "bronchospasm_drake" ? "🐉"
              : enemy.typeId === "hypoxia_wraith" ? "👻"
              : enemy.typeId === "mucus_slime" ? "🫧"
              : "💨"}
          </Text>
        </View>
      )}

      {/* Ground shadow */}
      <View style={{
        width: isBoss ? 50 : 36, height: 5, borderRadius: 25,
        backgroundColor: "#000000a0", marginTop: -3,
      }}/>
    </Animated.View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PROJECTILE — glowing healing orb in flight (position FIXED from fromFx/toFx)
════════════════════════════════════════════════════════════════════════════ */
function ProjectileDot({ p, aw, ah }: { p: any; aw: number; ah: number }) {
  const px  = lp(p.fromFx, p.toFx, p.progress) * aw;
  const py  = lp(p.fromFy, p.toFy, p.progress) * ah;
  const col = p.color ?? "#22d3ee";
  return (
    <View style={{
      position: "absolute",
      left: px - 8, top: py - 8,
      width: 16, height: 16, borderRadius: 8,
      backgroundColor: col + "55", borderWidth: 2.5, borderColor: col,
      alignItems: "center", justifyContent: "center", zIndex: 13,
    }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#ffffff" }}/>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   WAVE PAUSE OVERLAY
════════════════════════════════════════════════════════════════════════════ */
function WavePauseOverlay({ wave }: { wave: number }) {
  return (
    <View style={[StyleSheet.absoluteFillObject, {
      alignItems: "center", justifyContent: "center",
      backgroundColor: "#00000070", zIndex: 30,
    }]}>
      <View style={{
        backgroundColor: "#0a1810f5", borderRadius: 18,
        padding: 26, alignItems: "center",
        borderWidth: 2, borderColor: "#22d3ee55", minWidth: 200,
      }}>
        <Text style={{
          color: "#22d3ee", fontSize: 13, fontWeight: "700",
          letterSpacing: 1.5, marginBottom: 6,
        }}>
          ✦  WAVE {wave + 2} INCOMING  ✦
        </Text>
        <Text style={{ color: "#a7f3d0", fontSize: 10.5 }}>
          Deploy your healers before the wave…
        </Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN BOARD EXPORT — used by ward-defense.tsx
════════════════════════════════════════════════════════════════════════════ */
export function WardBoardV2({
  aw, ah, onLayout,
  enemies, deployedUnits, projectiles,
  stability, phase, wave,
  selectedUnit, bobY,
  spawnQueueLen, mergeTileSet, onTilePress, canAfford, unitColors,
}: WardBoardV2Props) {
  return (
    <View
      style={{ flex: 1, position: "relative", overflow: "hidden" }}
      onLayout={onLayout}
    >
      {/* ── 1. Illustrated board scene (background image + arrow guides) ── */}
      <BoardScene aw={aw} ah={ah} />

      {/* ── 2. Disease Portal overlay (top-right, enemy spawn) ── */}
      {aw > 20 && <DiseasePortal aw={aw} ah={ah} />}

      {/* ── 3. Vital Lantern overlay (bottom-left, objective) ── */}
      {aw > 20 && <VitalLantern stability={stability} aw={aw} ah={ah} />}

      {/* ── 4. Deploy pads — transparent touch zones over illustrated platform ── */}
      {aw > 20 && DEPLOY_TILES.map((_, i) => (
        <DeployPad
          key={i} tileIdx={i}
          unit={deployedUnits.find((u: any) => u.tileIndex === i)}
          selectedUnit={selectedUnit}
          canAfford={canAfford}
          isMergeCandidate={mergeTileSet.has(i)}
          onPress={() => onTilePress(i)}
          aw={aw} ah={ah}
          unitColors={unitColors}
          bobY={bobY}
        />
      ))}

      {/* ── 5. Projectiles ── */}
      {projectiles.map((p: any) => (
        <ProjectileDot key={p.uid} p={p} aw={aw} ah={ah} />
      ))}

      {/* ── 6. Enemy sprites (illustrated disease creatures) ── */}
      {enemies.map((e: any) => (
        <EnemyOnPath key={e.uid} enemy={e} bobY={bobY} aw={aw} ah={ah} />
      ))}

      {/* ── 7. Spawn queue warning ── */}
      {spawnQueueLen > 0 && (
        <View style={{
          position: "absolute", top: 6, left: 6,
          backgroundColor: "#7c3aede0", borderRadius: 8,
          paddingHorizontal: 9, paddingVertical: 3,
          borderWidth: 1, borderColor: "#c084fc", zIndex: 25,
        }}>
          <Text style={{ color: "#f3e8ff", fontSize: 8, fontWeight: "700" }}>
            ⚡ {spawnQueueLen} approaching
          </Text>
        </View>
      )}

      {/* ── 8. Wave pause overlay ── */}
      {phase === "wave_pause" && <WavePauseOverlay wave={wave} />}
    </View>
  );
}

export default WardBoardV2;
