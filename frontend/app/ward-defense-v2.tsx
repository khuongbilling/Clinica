/**
 * Ward Defense V2 — Lotus Healing Sanctum
 *
 * ART-FIRST RENDERING PHILOSOPHY:
 *   The background image contains the full environment — stone path, platforms,
 *   disease gate arch, vital lantern shrine. CSS overlays are:
 *   - Hero sprites placed exactly on top of the art's stone platform positions
 *   - Tiny dot indicators when a pad is selectable and empty
 *   - HP bars, cue badges on enemies
 *   - Projectile glows
 *   NOTHING ELSE. No CSS platform discs. No glowing underlay. No floating rings.
 *
 * COORDINATE SYSTEM — IMAGE-FIRST COVER MODE:
 *   getImgBounds uses Math.MAX (cover) so image always fills the board edge-to-edge.
 *   All overlay positions computed from imgPx(fx, fy, b) which maps [0..1, 0..1]
 *   fractions to absolute pixel positions within the rendered image bounds.
 */
import React from "react";
import {
  View, Text, Animated, Pressable,
  StyleSheet, LayoutChangeEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

/* ── Path + tile constants — must mirror ward-defense.tsx exactly ─────────── */
/* U-shaped enemy lane: Disease Gate on LEFT WALL → down-left → across bottom
   → up-right → Vital Lantern on RIGHT WALL.  All fy > 0.22 so both endpoints
   remain visible even after cover-mode vertical cropping on wide web screens. */
const PATH_WPS: [number, number][] = [
  [0.12, 0.30],   /* Disease Gate — left wall, upper portion */
  [0.12, 0.82],   /* bottom-left corner */
  [0.88, 0.82],   /* bottom-right corner */
  [0.88, 0.30],   /* Vital Lantern — right wall, upper portion */
];

/* Six deployment tiles — 2×3 stone platform cluster in the center of the U.
   Positions calibrated for the lotus sanctuary art (left/right path corridors
   at fx≈0.12 and fx≈0.88; center arena fx=0.20-0.80). */
const DEPLOY_TILES: [number, number][] = [
  [0.32, 0.43], [0.50, 0.43], [0.68, 0.43],   /* top row    */
  [0.32, 0.62], [0.50, 0.62], [0.68, 0.62],   /* bottom row */
];

/* ── Illustrated assets ───────────────────────────────────────────────────── */
const IMG_BOARD = require("../assets/images/ward_board_scene.png");

const IMG_UNITS: Record<string, any> = {
  ward_scout:  require("../assets/heroes/battle/apprentice_seer.png"),
  mist_caster: require("../assets/heroes/battle/village_caretaker.png"),
  o2_healer:   require("../assets/heroes/battle/novice_guardian.png"),
};

const IMG_ENEMIES: Record<string, any> = {
  breathless_wisp:    require("../assets/images/enemy_breathless_wisp.png"),
  wheeze_sprite:      require("../assets/images/enemy_wheeze_sprite.png"),
  mucus_slime:        require("../assets/images/enemy_mucus_slime.png"),
  hypoxia_wraith:     require("../assets/images/enemy_hypoxia_wraith.png"),
  bronchospasm_drake: require("../assets/images/enemy_bronchospasm_drake.png"),
};

const ENEMY_COLOR: Record<string, string> = {
  breathless_wisp:    "#93c5fd",
  wheeze_sprite:      "#34d399",
  mucus_slime:        "#86efac",
  hypoxia_wraith:     "#c4b5fd",
  bronchospasm_drake: "#fb923c",
};

/* ── Props ────────────────────────────────────────────────────────────────── */
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

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function cl(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function lp(a: number, b: number, t: number)   { return a + (b - a) * cl(t, 0, 1); }

function getEnemyFrac(e: { pathIndex: number; pathProgress: number }): [number, number] {
  const pi   = cl(e.pathIndex, 0, PATH_WPS.length - 2);
  const from = PATH_WPS[pi];
  const to   = PATH_WPS[pi + 1];
  return [lp(from[0], to[0], e.pathProgress), lp(from[1], to[1], e.pathProgress)];
}

/* ── Image-bounds — COVER mode fills board edge-to-edge ──────────────────── */
/* 896×1280 = 7:10 actual image ratio — use exact values for accurate overlays */
const IMG_AR_W = 7, IMG_AR_H = 10;
type ImgBounds = { iw: number; ih: number; ox: number; oy: number };

function getImgBounds(aw: number, ah: number): ImgBounds {
  /* Cover: scale so the LARGER dimension fills the container */
  const scale = Math.max(aw / IMG_AR_W, ah / IMG_AR_H);
  const iw    = IMG_AR_W * scale;
  const ih    = IMG_AR_H * scale;
  return { iw, ih, ox: (aw - iw) / 2, oy: (ah - ih) / 2 };
}

function imgPx(fx: number, fy: number, b: ImgBounds): [number, number] {
  return [b.ox + fx * b.iw, b.oy + fy * b.ih];
}

/* ════════════════════════════════════════════════════════════════════════════
   BOARD SCENE — explicit pixel dimensions are the only approach proven to
   work reliably in RN-web nested flex containers. Negative `top` (cover mode)
   is handled by the parent's overflow:hidden clipping.
════════════════════════════════════════════════════════════════════════════ */
function BoardScene({ aw, ah }: { aw: number; ah: number }) {
  const w     = aw > 10 ? aw : 360;
  const h     = ah > 10 ? ah : 540;
  const scale = Math.max(w / IMG_AR_W, h / IMG_AR_H);
  const iw    = IMG_AR_W * scale;
  const ih    = IMG_AR_H * scale;
  const left  = (w - iw) / 2;
  const top   = (h - ih) / 2;

  return (
    <ExpoImage
      key={`board-${Math.round(iw)}-${Math.round(ih)}`}
      source={IMG_BOARD}
      style={{ position: "absolute", left, top, width: iw, height: ih }}
      contentFit="fill"
      cachePolicy="none"
    />
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DISEASE PORTAL — minimal floating label above the gate arch in the art
════════════════════════════════════════════════════════════════════════════ */
function DiseasePortal({
  imgBounds: b, aw, ah, spawnQueueLen,
}: { imgBounds: ImgBounds; aw: number; ah: number; spawnQueueLen: number }) {
  const [px, py] = imgPx(PATH_WPS[0][0], PATH_WPS[0][1], b);
  const left = cl(px - 34, 4, aw - 80);
  const top  = cl(py - 36, 4, ah * 0.45);

  return (
    <View style={{ position: "absolute", left, top, zIndex: 22, alignItems: "flex-start" }}>
      {spawnQueueLen > 0 && (
        <View style={{
          backgroundColor: "#3b0764ee",
          borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
          borderWidth: 1, borderColor: "#a855f7",
          marginBottom: 3,
        }}>
          <Text style={{ color: "#e9d5ff", fontSize: 7.5, fontWeight: "800" }}>
            ⚡ {spawnQueueLen}
          </Text>
        </View>
      )}
      <View style={{
        backgroundColor: "#160828dd",
        borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
        borderWidth: 1, borderColor: "#7c3aed88",
      }}>
        <Text style={{ color: "#c4b5fd", fontSize: 6.5, fontWeight: "800", letterSpacing: 1 }}>
          DISEASE GATE
        </Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   VITAL LANTERN — minimal stability display above the shrine arch in the art
════════════════════════════════════════════════════════════════════════════ */
function VitalLantern({
  stability, imgBounds: b, aw, ah,
}: { stability: number; imgBounds: ImgBounds; aw: number; ah: number }) {
  const [px, py] = imgPx(PATH_WPS[PATH_WPS.length - 1][0], PATH_WPS[PATH_WPS.length - 1][1], b);
  const pct   = cl(stability, 0, 100);
  const glow  = pct > 60 ? "#22d3ee" : pct > 30 ? "#facc15" : "#ef4444";
  const right = cl(aw - px - 34, 4, aw - 4);
  const top   = cl(py - 30, 4, ah - 60);

  return (
    <View style={{ position: "absolute", right, top, zIndex: 22, alignItems: "flex-end" }}>
      <View style={{
        backgroundColor: "#061a1add",
        borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2,
        borderWidth: 1, borderColor: glow + "88",
        marginBottom: 3,
      }}>
        <Text style={{ color: "#a7f3d0", fontSize: 6.5, fontWeight: "800", letterSpacing: 1 }}>
          VITAL LANTERN
        </Text>
      </View>
      {/* Stability bar */}
      <View style={{
        width: 64, height: 6, backgroundColor: "#00000060",
        borderRadius: 3, overflow: "hidden",
        borderWidth: 1, borderColor: glow + "60",
      }}>
        <View style={{
          width: `${pct}%` as any, height: "100%",
          backgroundColor: glow, borderRadius: 3,
        }}/>
      </View>
      <Text style={{ color: glow, fontSize: 7, fontWeight: "700", marginTop: 2 }}>
        {pct}%
      </Text>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DEPLOY PAD — COMPLETELY TRANSPARENT touch zone
   The art's stone platform IS the visual platform. This component only:
   • Shows the hero sprite when occupied (standing on the art platform)
   • Shows a tiny green dot when empty + unit selected + can afford
   • Never renders any background, border, shadow or gradient overlay
════════════════════════════════════════════════════════════════════════════ */
interface DPProps {
  tileIdx: number;
  unit: any;
  selectedUnit: string | null;
  canAfford: boolean;
  isMergeCandidate: boolean;
  onPress: () => void;
  imgBounds: ImgBounds;
  unitColors: Record<string, string>;
  bobY: Animated.AnimatedInterpolation<number>;
}

function DeployPad({
  tileIdx, unit, selectedUnit, canAfford, isMergeCandidate,
  onPress, imgBounds: b, unitColors, bobY,
}: DPProps) {
  const [fx, fy]   = DEPLOY_TILES[tileIdx];
  const [px, py]   = imgPx(fx, fy, b);
  const isOccupied = !!unit;

  /* Hero sprite sits above the art platform. The art platform top surface is
     approximately 12px above the coordinate centre (isometric perspective). */
  const SPRITE_W  = 58;
  const SPRITE_H  = 72;
  const PLATFORM_OFFSET = 14;   /* px above py where platform top surface is */
  const HIT_W     = 72;
  const HIT_H     = SPRITE_H + PLATFORM_OFFSET + 24;

  const heroImg   = IMG_UNITS[unit?.typeId] ?? IMG_UNITS.ward_scout;
  const unitColor = isOccupied ? (unitColors[unit.typeId] ?? "#60a5fa") : null;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        left: px - HIT_W / 2,
        top:  py - SPRITE_H - PLATFORM_OFFSET,
        width: HIT_W,
        height: HIT_H,
        alignItems: "center",
        zIndex: 15,
        /* TRANSPARENT — no background, no border, no shadow */
      }}
    >
      {isOccupied ? (
        /* ── Occupied: hero sprite floating slightly above art platform ── */
        <Animated.View style={{
          transform: [{ translateY: bobY }],
          alignItems: "center",
        }}>
          {/* Merge gold halo ring */}
          {isMergeCandidate && (
            <View style={{
              position: "absolute",
              top: -8, left: -8, right: -8, bottom: -8,
              borderRadius: 50,
              borderWidth: 2, borderColor: "#FFD700cc",
              backgroundColor: "#FFD70010",
            }}/>
          )}

          {/* Cast flash ring */}
          {(unit.castFlash ?? 0) > 0 && (
            <View style={{
              position: "absolute",
              top: -5, left: -5, right: -5, bottom: -5,
              borderRadius: 48,
              borderWidth: 2.5, borderColor: (unitColor ?? "#22d3ee") + "cc",
            }}/>
          )}

          {/* Level badge */}
          {(unit.level ?? 1) > 1 && (
            <View style={{
              position: "absolute", top: 0, right: -8, zIndex: 18,
              backgroundColor: (unit.level ?? 1) >= 3 ? "#FFD700" : "#a78bfa",
              borderRadius: 5, paddingHorizontal: 4, paddingVertical: 1,
            }}>
              <Text style={{ color: "#0a0a1a", fontSize: 5.5, fontWeight: "900" }}>
                Lv.{unit.level}
              </Text>
            </View>
          )}

          {/* Hero battle sprite — same art as bottom hand card */}
          <ExpoImage
            source={heroImg}
            style={{ width: SPRITE_W, height: SPRITE_H }}
            contentFit="contain"
          />

          {/* Soft ground shadow */}
          <View style={{
            width: 40, height: 5, borderRadius: 20,
            backgroundColor: "#00000075",
            marginTop: -5,
          }}/>
        </Animated.View>
      ) : (
        /* ── Empty: lotus-ring pad indicator when a unit is selected ──────── */
        /* Shows a 64×64 circle centered on the art's stone platform position,
           giving a clear tap target that visually matches the art's platform. */
        selectedUnit && (
          <View style={{
            position: "absolute",
            left: HIT_W / 2 - 32,       /* center on platform fx  */
            top:  SPRITE_H + PLATFORM_OFFSET - 32,  /* center on platform fy */
            width: 64, height: 64, borderRadius: 32,
            backgroundColor: canAfford ? "#22d3ee16" : "#33415510",
            borderWidth: 2.5,
            borderColor: canAfford ? "#22d3eecc" : "#47556966",
            alignItems: "center", justifyContent: "center",
          }}>
            {/* Inner concentric ring — lotus medallion feel */}
            <View style={{
              width: 38, height: 38, borderRadius: 19,
              borderWidth: 1.5,
              borderColor: canAfford ? "#22d3ee77" : "#47556944",
            }}/>
          </View>
        )
      )}
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ENEMY ON PATH
════════════════════════════════════════════════════════════════════════════ */
function EnemyOnPath({
  enemy, bobY, imgBounds: b,
}: { enemy: any; bobY: Animated.AnimatedInterpolation<number>; imgBounds: ImgBounds }) {
  const [fx, fy] = getEnemyFrac(enemy);
  const [px, py] = imgPx(fx, fy, b);

  const hpPct    = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const barColor = hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#facc15" : "#ef4444";
  const isFlash  = (enemy.hitFlash ?? 0) > 0;
  const isBoss   = enemy.typeId === "bronchospasm_drake";
  const sprW     = isBoss ? 70 : 52;
  const sprH     = isBoss ? 70 : 52;
  const barW     = isBoss ? 62 : 46;
  const accentC  = ENEMY_COLOR[enemy.typeId] ?? "#94a3b8";
  const img      = IMG_ENEMIES[enemy.typeId];

  return (
    <Animated.View style={{
      position: "absolute",
      left: px - sprW / 2,
      top:  py - sprH - 28,
      alignItems: "center",
      zIndex: 14,
      transform: [{ translateY: bobY }],
    }}>
      {/* HP bar */}
      <View style={{
        width: barW, height: 5, backgroundColor: "#00000090",
        borderRadius: 3, marginBottom: 2, overflow: "hidden",
        borderWidth: 0.5, borderColor: "#ffffff20",
      }}>
        <View style={{
          width: `${hpPct * 100}%` as any, height: "100%",
          backgroundColor: barColor, borderRadius: 3,
        }}/>
      </View>

      {/* Clinical cue badge */}
      <View style={{
        backgroundColor: accentC + "22", borderRadius: 4,
        paddingHorizontal: 4, paddingVertical: 1, marginBottom: 3,
        borderWidth: 0.5, borderColor: accentC + "70",
        maxWidth: barW + 16,
      }}>
        <Text
          style={{ color: accentC, fontSize: 6, fontWeight: "700", textAlign: "center" }}
          numberOfLines={1}
        >
          {enemy.clue ?? enemy.name ?? "?"}
        </Text>
      </View>

      {isBoss && (
        <Text style={{ color: accentC, fontSize: 8, fontWeight: "700", marginBottom: 1 }}>
          {enemy.hp}
        </Text>
      )}

      {isFlash && (
        <View style={{
          position: "absolute", top: 20, left: 0, right: 0, bottom: 5,
          backgroundColor: "#ffffff28", borderRadius: 10, zIndex: 15,
        }}/>
      )}

      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{
          position: "absolute", top: 16, right: -10,
          backgroundColor: "#A78BFA22", borderRadius: 4, paddingHorizontal: 3,
        }}>
          <Text style={{ color: "#A78BFA", fontSize: 6 }}>↓</Text>
        </View>
      )}

      {img ? (
        <ExpoImage source={img} style={{ width: sprW, height: sprH }} contentFit="contain" />
      ) : (
        <View style={{
          width: sprW, height: sprH, borderRadius: sprW / 2,
          backgroundColor: accentC + "33", borderWidth: 2, borderColor: accentC,
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: isBoss ? 24 : 18 }}>
            {enemy.typeId === "bronchospasm_drake" ? "🐉"
              : enemy.typeId === "hypoxia_wraith" ? "👻"
              : enemy.typeId === "mucus_slime" ? "🫧" : "💨"}
          </Text>
        </View>
      )}

      <View style={{
        width: isBoss ? 50 : 36, height: 5, borderRadius: 25,
        backgroundColor: "#000000a0", marginTop: -3,
      }}/>
    </Animated.View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PROJECTILE
════════════════════════════════════════════════════════════════════════════ */
function ProjectileDot({ p, imgBounds: b }: { p: any; imgBounds: ImgBounds }) {
  const fx  = lp(p.fromFx, p.toFx, p.progress);
  const fy  = lp(p.fromFy, p.toFy, p.progress);
  const [px, py] = imgPx(fx, fy, b);
  const col = p.color ?? "#22d3ee";
  return (
    <View style={{
      position: "absolute",
      left: px - 6, top: py - 6,
      width: 12, height: 12, borderRadius: 6,
      backgroundColor: col + "50", borderWidth: 2, borderColor: col,
      alignItems: "center", justifyContent: "center", zIndex: 13,
    }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: "#fff" }}/>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN BOARD EXPORT
════════════════════════════════════════════════════════════════════════════ */
export function WardBoardV2({
  aw, ah, onLayout,
  enemies, deployedUnits, projectiles,
  stability, phase, wave,
  selectedUnit, bobY,
  spawnQueueLen, mergeTileSet, onTilePress, canAfford, unitColors,
}: WardBoardV2Props) {
  const imgBounds = getImgBounds(aw > 20 ? aw : 360, ah > 20 ? ah : 500);

  return (
    <View
      style={{ flex: 1, position: "relative", overflow: "hidden", backgroundColor: "#050912" }}
      onLayout={onLayout}
    >
      {/* 1. Background art — explicit pixel dimensions, cover-mode crop, cachePolicy:none */}
      <BoardScene aw={aw > 10 ? aw : 360} ah={ah > 10 ? ah : 540} />

      {/* 2. Vignette — subtle atmospheric darkening at edges */}
      <LinearGradient
        colors={["#00000055", "#00000000", "#00000000", "#00000055"]}
        start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
        style={[StyleSheet.absoluteFillObject, { zIndex: 1, pointerEvents: "none" }]}
      />

      {/* 3. Disease gate label */}
      {aw > 20 && (
        <DiseasePortal imgBounds={imgBounds} aw={aw} ah={ah} spawnQueueLen={spawnQueueLen} />
      )}

      {/* 4. Vital lantern stability display */}
      {aw > 20 && (
        <VitalLantern stability={stability} imgBounds={imgBounds} aw={aw} ah={ah} />
      )}

      {/* 5. Deployment pads — transparent zones with hero sprites */}
      {aw > 20 && DEPLOY_TILES.map((_, i) => (
        <DeployPad
          key={i} tileIdx={i}
          unit={deployedUnits.find((u: any) => u.tileIndex === i)}
          selectedUnit={selectedUnit}
          canAfford={canAfford}
          isMergeCandidate={mergeTileSet.has(i)}
          onPress={() => onTilePress(i)}
          imgBounds={imgBounds}
          unitColors={unitColors}
          bobY={bobY}
        />
      ))}

      {/* 6. Projectiles */}
      {projectiles.map((p: any) => (
        <ProjectileDot key={p.uid} p={p} imgBounds={imgBounds} />
      ))}

      {/* 7. Enemy sprites — float along path */}
      {enemies.map((e: any) => (
        <EnemyOnPath key={e.uid} enemy={e} bobY={bobY} imgBounds={imgBounds} />
      ))}

      {/* 8. Wave-pause dim — dark overlay so clinical panel reads clearly */}
      {phase === "wave_pause" && (
        <View style={[StyleSheet.absoluteFillObject, {
          backgroundColor: "#00000055", zIndex: 28,
        }]}/>
      )}
    </View>
  );
}

export default WardBoardV2;
