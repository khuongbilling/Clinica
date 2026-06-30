/**
 * Ward Defense V2 — Lotus Healing Sanctum
 * Buddhism-influenced donghua/anime fantasy-medical tower defense visual layer.
 * All gameplay state is passed in as props from the parent ward-defense.tsx.
 * This file contains ONLY visuals — no game logic lives here.
 */
import React from "react";
import {
  View, Text, Animated, Pressable,
  StyleSheet, LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";

/* ── Path + tile constants (must mirror ward-defense.tsx) ──────────────────── */
const ROAD_W = 40;
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
const TILE_SIZE = 52;

/* ── Prop interfaces ────────────────────────────────────────────────────────── */
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

/* ══════════════════════════════════════════════════════════════════════════════
   ① SCENIC PATH — warm cream stone with mortar joints and teal rune stripe
══════════════════════════════════════════════════════════════════════════════ */
function SanctuaryPath({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;
  const STEP = 28;
  const slabs: { cx: number; cy: number; angle: number; alt: boolean }[] = [];

  PATH_WPS.slice(0, -1).forEach((wp, seg) => {
    const to = PATH_WPS[seg + 1];
    const x1 = wp[0] * aw, y1 = wp[1] * ah;
    const x2 = to[0] * aw, y2 = to[1] * ah;
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const n = Math.max(1, Math.floor(len / STEP));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      slabs.push({ cx: x1 + dx * t, cy: y1 + dy * t, angle, alt: (i + seg) % 2 === 0 });
    }
  });

  return (
    <>
      {/* Drop shadows below each segment */}
      {PATH_WPS.slice(0, -1).map((wp, seg) => {
        const to = PATH_WPS[seg + 1];
        const x1 = wp[0] * aw, y1 = wp[1] * ah;
        const x2 = to[0] * aw, y2 = to[1] * ah;
        const len = Math.sqrt((x2-x1)**2 + (y2-y1)**2);
        const ang = Math.atan2(y2-y1, x2-x1) * 180 / Math.PI;
        return (
          <View key={`shd${seg}`} style={{
            position:"absolute", left:(x1+x2)/2-len/2,
            top:(y1+y2)/2-(ROAD_W+14)/2,
            width:len, height:ROAD_W+14,
            backgroundColor:"#00000055",
            transform:[{rotate:`${ang}deg`}], zIndex:2,
          }}/>
        );
      })}
      {/* Drop shadows at corners */}
      {PATH_WPS.slice(1,-1).map(([fx,fy],i)=>(
        <View key={`cshd${i}`} style={{
          position:"absolute",
          left:fx*aw-(ROAD_W+14)/2, top:fy*ah-(ROAD_W+14)/2,
          width:ROAD_W+14, height:ROAD_W+14,
          borderRadius:(ROAD_W+14)/2,
          backgroundColor:"#00000055", zIndex:2,
        }}/>
      ))}
      {/* Warm cream stone base lane */}
      {PATH_WPS.slice(0,-1).map((wp,seg)=>{
        const to = PATH_WPS[seg+1];
        const x1=wp[0]*aw,y1=wp[1]*ah,x2=to[0]*aw,y2=to[1]*ah;
        const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
        const ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
        return (
          <View key={`base${seg}`} style={{
            position:"absolute", left:(x1+x2)/2-len/2,
            top:(y1+y2)/2-ROAD_W/2,
            width:len, height:ROAD_W,
            backgroundColor:"#c8b07a",
            transform:[{rotate:`${ang}deg`}], zIndex:3,
          }}/>
        );
      })}
      {/* Corner junction caps */}
      {PATH_WPS.slice(1,-1).map(([fx,fy],i)=>(
        <View key={`cap${i}`} style={{
          position:"absolute",
          left:fx*aw-ROAD_W/2, top:fy*ah-ROAD_W/2,
          width:ROAD_W, height:ROAD_W, borderRadius:ROAD_W/2,
          backgroundColor:"#c8b07a", zIndex:3,
        }}/>
      ))}
      {/* Paving slabs */}
      {slabs.map((s,i)=>(
        <View key={`slab${i}`} style={{
          position:"absolute",
          left:s.cx-13, top:s.cy-(ROAD_W-8)/2,
          width:26, height:ROAD_W-8,
          backgroundColor:s.alt?"#d4c090":"#b89c68",
          borderWidth:1, borderColor:"#9a8050",
          borderRadius:3,
          transform:[{rotate:`${s.angle}deg`}], zIndex:4,
        }}/>
      ))}
      {/* Gold edge highlight strip (top of road) */}
      {PATH_WPS.slice(0,-1).map((wp,seg)=>{
        const to=PATH_WPS[seg+1];
        const x1=wp[0]*aw,y1=wp[1]*ah,x2=to[0]*aw,y2=to[1]*ah;
        const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
        const ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
        return (
          <View key={`hi${seg}`} style={{
            position:"absolute", left:(x1+x2)/2-len/2,
            top:(y1+y2)/2-ROAD_W/2,
            width:len, height:2.5,
            backgroundColor:"#e8cc8880",
            transform:[{rotate:`${ang}deg`}], zIndex:5,
          }}/>
        );
      })}
      {/* Teal rune center stripe — directional glow */}
      {PATH_WPS.slice(0,-1).map((wp,seg)=>{
        const to=PATH_WPS[seg+1];
        const x1=wp[0]*aw,y1=wp[1]*ah,x2=to[0]*aw,y2=to[1]*ah;
        const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
        const ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
        return (
          <View key={`rune${seg}`} style={{
            position:"absolute", left:(x1+x2)/2-len/2,
            top:(y1+y2)/2-1.5,
            width:len, height:3,
            backgroundColor:"#22d3ee44",
            transform:[{rotate:`${ang}deg`}], zIndex:6,
          }}/>
        );
      })}
      {/* Small directional arrow markers */}
      {PATH_WPS.slice(0,-1).map((wp,seg)=>{
        const to=PATH_WPS[seg+1];
        const x1=wp[0]*aw,y1=wp[1]*ah,x2=to[0]*aw,y2=to[1]*ah;
        const mx=(x1+x2)/2, my=(y1+y2)/2;
        const ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
        return (
          <View key={`arr${seg}`} style={{
            position:"absolute", left:mx-5, top:my-5,
            width:10, height:10,
            backgroundColor:"#d4a84055",
            borderRadius:2,
            transform:[{rotate:`${ang+45}deg`}], zIndex:7,
          }}/>
        );
      })}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ② CENTER DEPLOY PLATFORM — raised stone sanctum base
══════════════════════════════════════════════════════════════════════════════ */
function CenterPlatformBase({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;
  // Two platform zones behind the 3+3 deploy tile layout
  const zones = [
    { l: 0.23, t: 0.17, r: 0.82, b: 0.37 }, // top zone (tiles at y=0.27)
    { l: 0.18, t: 0.57, r: 0.82, b: 0.77 }, // bottom zone (tiles at y=0.67)
  ];
  return (
    <>
      {zones.map((z, i) => {
        const left = z.l * aw, top = z.t * ah;
        const w = (z.r - z.l) * aw, h = (z.b - z.t) * ah;
        return (
          <View key={`plat${i}`} style={{
            position:"absolute", left, top, width:w, height:h,
            borderRadius:10, zIndex:8,
          }}>
            {/* Stone base shadow */}
            <View style={[StyleSheet.absoluteFillObject, {
              borderRadius:10, backgroundColor:"#00000055",
              top:4, left:4,
            }]}/>
            {/* Stone base surface */}
            <LinearGradient
              colors={["#8a9888","#6a7a68","#5a6858"]}
              start={{x:0.1,y:0}} end={{x:0.9,y:1}}
              style={[StyleSheet.absoluteFillObject, {borderRadius:10}]}
            />
            {/* Gold border frame */}
            <View style={[StyleSheet.absoluteFillObject, {
              borderRadius:10, borderWidth:2, borderColor:"#c8a04080",
            }]}/>
            {/* Inner inset shadow */}
            <View style={{
              position:"absolute", top:6, left:6, right:6, bottom:6,
              borderRadius:7, borderWidth:1, borderColor:"#ffffff15",
            }}/>
            {/* Lotus sigil center line */}
            <View style={{
              position:"absolute", top:"50%", left:"15%", right:"15%", height:1,
              backgroundColor:"#d4a84030",
            }}/>
            {/* Corner lotus petals */}
            {[[8,8],[-8,8],[8,-8],[-8,-8]].map(([dx,dy],j)=>(
              <View key={j} style={{
                position:"absolute",
                left:w/2+dx-5, top:h/2+dy-5,
                width:10, height:10, borderRadius:5,
                backgroundColor:"#d4a84018", borderWidth:1, borderColor:"#d4a84030",
              }}/>
            ))}
          </View>
        );
      })}
      {/* Connecting bridge between the two zones */}
      <View style={{
        position:"absolute",
        left:0.42*aw, top:0.37*ah,
        width:0.18*aw, height:0.20*ah,
        zIndex:7,
      }}>
        <LinearGradient
          colors={["#6a7a6890","#5a6858a0"]}
          start={{x:0,y:0}} end={{x:0,y:1}}
          style={[StyleSheet.absoluteFillObject, {borderRadius:4}]}
        />
        <View style={[StyleSheet.absoluteFillObject, {
          borderRadius:4, borderWidth:1, borderColor:"#c8a04040",
        }]}/>
      </View>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ③ LOTUS LANTERNS — decorative path lanterns
══════════════════════════════════════════════════════════════════════════════ */
function PathLanterns({ aw, ah }: { aw: number; ah: number }) {
  const lanternPositions = [
    [0.14, 0.25], [0.86, 0.25], [0.14, 0.65], [0.86, 0.65],
  ] as [number, number][];
  return (
    <>
      {lanternPositions.map(([fx, fy], i) => (
        <View key={i} style={{
          position:"absolute",
          left:fx*aw-9, top:fy*ah-16,
          alignItems:"center", zIndex:6,
        }}>
          {/* Glow aura */}
          <View style={{
            position:"absolute", top:-4, left:-6,
            width:30, height:30, borderRadius:15,
            backgroundColor:"#d4a84012",
          }}/>
          {/* Lantern pole */}
          <View style={{ width:2, height:10, backgroundColor:"#8a6030", borderRadius:1 }}/>
          {/* Lantern body */}
          <View style={{
            width:14, height:16, borderRadius:5,
            backgroundColor:"#1a0d00",
            borderWidth:1.5, borderColor:"#c87820",
            alignItems:"center", justifyContent:"center",
            overflow:"hidden",
          }}>
            <LinearGradient
              colors={["#d4780050","#d4a80030","transparent"]}
              start={{x:0.5,y:0}} end={{x:0.5,y:1}}
              style={StyleSheet.absoluteFillObject}
            />
            <Text style={{ fontSize:7, color:"#d4a800cc" }}>✦</Text>
          </View>
          {/* Tassel */}
          <View style={{ width:1.5, height:5, backgroundColor:"#c87820", borderRadius:1 }}/>
          <View style={{ width:4, height:3, borderRadius:2, backgroundColor:"#c87820cc" }}/>
        </View>
      ))}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ④ DISEASE PORTAL — purple swirling void gate (enemy spawn)
══════════════════════════════════════════════════════════════════════════════ */
function DiseasePortalV2({ aw, ah }: { aw: number; ah: number }) {
  const [fx, fy] = PATH_WPS[0];
  const px = fx * aw, py = fy * ah;
  const spikes = [0,45,90,135,180,225,270,315];
  return (
    <View style={{
      position:"absolute",
      left:px-44, top:Math.max(4, py-44),
      alignItems:"center", zIndex:20,
    }}>
      {/* Label tag */}
      <View style={{
        backgroundColor:"#3b0764cc", borderRadius:6,
        paddingHorizontal:6, paddingVertical:2,
        marginBottom:3, borderWidth:1, borderColor:"#a855f7",
      }}>
        <Text style={{ color:"#e9d5ff", fontSize:7, fontWeight:"800", letterSpacing:0.6 }}>
          DISEASE GATE
        </Text>
      </View>

      {/* Spike ring container */}
      <View style={{ width:88, height:88, alignItems:"center", justifyContent:"center" }}>
        {/* Outer glow halo */}
        <View style={{
          position:"absolute", width:88, height:88, borderRadius:44,
          backgroundColor:"#7c3aed0a",
          borderWidth:1, borderColor:"#7c3aed18",
        }}/>
        {/* 8 spike diamonds */}
        {spikes.map((deg,i)=>{
          const rad = deg*Math.PI/180;
          const r = 40;
          const sx = 44+Math.sin(rad)*r - (i%2===0?5:3.5);
          const sy = 44-Math.cos(rad)*r - (i%2===0?5:3.5);
          return (
            <View key={i} style={{
              position:"absolute", left:sx, top:sy,
              width:i%2===0?10:7, height:i%2===0?10:7,
              borderRadius:2,
              backgroundColor:i%2===0?"#a855f7dd":"#7c3aed88",
              transform:[{rotate:"45deg"}],
            }}/>
          );
        })}
        {/* Portal ring */}
        <View style={{
          width:68, height:68, borderRadius:34,
          backgroundColor:"#0a0014",
          borderWidth:3, borderColor:"#7c3aed",
          alignItems:"center", justifyContent:"center", overflow:"hidden",
        }}>
          {/* Void gradient */}
          <LinearGradient
            colors={["#2e1065","#130929","#060011"]}
            start={{x:0.3,y:0}} end={{x:0.7,y:1}}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Inner swirl rings */}
          <View style={{
            position:"absolute", width:52, height:52, borderRadius:26,
            borderWidth:1.5, borderColor:"#7c3aed50",
          }}/>
          <View style={{
            position:"absolute", width:38, height:38, borderRadius:19,
            borderWidth:1, borderColor:"#a855f740",
          }}/>
          <View style={{
            position:"absolute", width:24, height:24, borderRadius:12,
            borderWidth:1.5, borderColor:"#c084fc60",
          }}/>
          {/* Skull / void eye */}
          <View style={{
            width:22, height:18, borderRadius:11,
            backgroundColor:"#7c3aed20",
            borderWidth:2, borderColor:"#c084fccc",
            alignItems:"center", justifyContent:"center",
          }}>
            <View style={{ width:9, height:9, borderRadius:5, backgroundColor:"#a855f7ee" }}/>
          </View>
        </View>
      </View>

      {/* Base cracks */}
      <View style={{ flexDirection:"row", gap:4, marginTop:2 }}>
        {[-12,0,12].map((r,i)=>(
          <View key={i} style={{
            width:1.5, height:6+Math.abs(r/4),
            borderRadius:1, backgroundColor:"#7c3aed35",
            transform:[{rotate:`${r}deg`}],
          }}/>
        ))}
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⑤ VITAL LANTERN — glowing lotus healing core (protected objective)
══════════════════════════════════════════════════════════════════════════════ */
function VitalLanternV2({ stability, aw, ah }: { stability:number; aw:number; ah:number }) {
  const [fx, fy] = PATH_WPS[PATH_WPS.length-1];
  const px = fx*aw, py = fy*ah;
  const stPct = Math.max(0, Math.min(100, stability));
  const glow = stPct > 60 ? "#22d3ee" : stPct > 30 ? "#facc15" : "#ef4444";

  return (
    <View style={{
      position:"absolute",
      left:px-44, top:Math.min(ah-100, py-44),
      alignItems:"center", zIndex:20,
    }}>
      {/* Label */}
      <View style={{
        backgroundColor:"#0c2a2acc", borderRadius:6,
        paddingHorizontal:6, paddingVertical:2,
        marginBottom:3, borderWidth:1, borderColor:glow+"80",
      }}>
        <Text style={{ color:"#a7f3d0", fontSize:7, fontWeight:"800", letterSpacing:0.6 }}>
          VITAL LANTERN
        </Text>
      </View>

      {/* Stability bar */}
      <View style={{
        width:64, height:5, backgroundColor:"#0d202060",
        borderRadius:3, marginBottom:4, overflow:"hidden",
        borderWidth:1, borderColor:"#ffffff20",
      }}>
        <View style={{
          width:`${stPct}%` as any, height:"100%",
          backgroundColor:glow, borderRadius:3,
        }}/>
      </View>

      {/* Outer glow ring */}
      <View style={{
        position:"absolute", top:28, left:4,
        width:80, height:80, borderRadius:40,
        backgroundColor:glow+"0d",
        borderWidth:1.5, borderColor:glow+"22",
      }}/>

      {/* Shrine column */}
      <View style={{
        width:14, height:28,
        backgroundColor:"#1a3a2a",
        borderRadius:4, borderWidth:1.5, borderColor:"#22d3ee40",
        alignItems:"center", justifyContent:"center",
      }}>
        <View style={{ width:2, height:18, backgroundColor:glow+"50", borderRadius:1 }}/>
      </View>

      {/* Main lantern body */}
      <View style={{
        width:58, height:58, borderRadius:12,
        backgroundColor:"#081a14",
        borderWidth:2.5, borderColor:glow,
        alignItems:"center", justifyContent:"center",
        overflow:"hidden", marginTop:-4,
      }}>
        <LinearGradient
          colors={[glow+"40","#0a1e16","#040e0a"]}
          start={{x:0.2,y:0}} end={{x:0.8,y:1}}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Inner glow rings */}
        <View style={{
          position:"absolute", width:44, height:44, borderRadius:22,
          borderWidth:1.5, borderColor:glow+"50",
        }}/>
        <View style={{
          position:"absolute", width:30, height:30, borderRadius:15,
          borderWidth:1, borderColor:glow+"70",
        }}/>
        {/* Lotus center */}
        <View style={{
          width:20, height:20, borderRadius:10,
          backgroundColor:glow+"30",
          borderWidth:2, borderColor:glow+"cc",
          alignItems:"center", justifyContent:"center",
        }}>
          <Text style={{ fontSize:10 }}>✦</Text>
        </View>
        {/* Four lotus petals */}
        {[0,90,180,270].map((deg,i)=>{
          const rad=deg*Math.PI/180;
          const r=19;
          return (
            <View key={i} style={{
              position:"absolute",
              left:29+Math.sin(rad)*r-5,
              top:29-Math.cos(rad)*r-5,
              width:10, height:10, borderRadius:5,
              backgroundColor:glow+"25",
              borderWidth:1, borderColor:glow+"60",
            }}/>
          );
        })}
      </View>

      {/* Base pedestal */}
      <View style={{
        width:68, height:10, borderRadius:5,
        backgroundColor:"#1a3a2a",
        borderWidth:1.5, borderColor:glow+"50",
        marginTop:-2,
      }}>
        <LinearGradient
          colors={[glow+"20","transparent"]}
          start={{x:0.5,y:0}} end={{x:0.5,y:1}}
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⑥ DISEASE ENEMY SPRITES — round pathogen organisms
══════════════════════════════════════════════════════════════════════════════ */
type SpriteProps2 = { hitFlash: boolean; bobY: Animated.AnimatedInterpolation<number> };

/* DYSPNEA WISP — silver hollow orb, wispy exhale tendrils, gasping mouth */
function DyspneaWispSprite({ hitFlash, bobY }: SpriteProps2) {
  const c = hitFlash ? "#fff" : "#bfdbfe";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* Exhale wisps trailing right */}
      {[{t:6,l:34,w:18},{t:14,l:36,w:24},{t:22,l:34,w:16}].map((w,i)=>(
        <View key={i} style={{
          position:"absolute", top:w.t, left:w.l,
          width:w.w, height:3.5, borderRadius:2,
          backgroundColor:"#93c5fd"+(["44","28","1a"][i]),
        }}/>
      ))}
      {/* Spike container 64×64 */}
      <View style={{ width:64, height:64, alignItems:"center", justifyContent:"center" }}>
        {/* Outer halo */}
        <View style={{
          position:"absolute", width:64, height:64, borderRadius:32,
          backgroundColor:"#93c5fd0a", borderWidth:1, borderColor:"#93c5fd20",
        }}/>
        {/* 6 wispy spikes */}
        {[0,60,120,180,240,300].map((deg,i)=>{
          const rad=deg*Math.PI/180;
          const r=28;
          return (
            <View key={i} style={{
              position:"absolute",
              left:32+Math.sin(rad)*r-4,
              top:32-Math.cos(rad)*r-7,
              width:8, height:14, borderRadius:4,
              backgroundColor:c+"55",
              transform:[{rotate:`${deg}deg`}],
            }}/>
          );
        })}
        {/* Main orb */}
        <View style={{
          width:44, height:44, borderRadius:22,
          borderWidth:2, borderColor:c+"cc",
          overflow:"hidden", backgroundColor:"#0f2a4a",
        }}>
          <LinearGradient colors={[c+"cc","#3b82f6","#0f2a4a"]}
            start={{x:0.2,y:0}} end={{x:0.8,y:1}}
            style={StyleSheet.absoluteFillObject}/>
          {/* Shine */}
          <View style={{
            position:"absolute", top:5, left:7,
            width:13, height:7, borderRadius:7,
            backgroundColor:"#ffffff35",
          }}/>
          {/* Hollow socket eyes */}
          {[8,24].map((l,i)=>(
            <View key={i} style={{
              position:"absolute", top:13, left:l,
              width:11, height:9, borderRadius:5,
              backgroundColor:"#040d1a",
              borderWidth:1.5, borderColor:c+"90",
              alignItems:"center", justifyContent:"center",
            }}>
              <View style={{
                width:4, height:4, borderRadius:2,
                borderWidth:1.5, borderColor:c+"bb",
              }}/>
            </View>
          ))}
          {/* Gasping O mouth */}
          <View style={{
            position:"absolute", bottom:7, alignSelf:"center",
            width:13, height:8, borderRadius:7,
            backgroundColor:"#040d1a",
            borderWidth:1.5, borderColor:c+"70",
          }}/>
        </View>
      </View>
      <View style={{ width:28, height:4, borderRadius:14, backgroundColor:"#00000060", marginTop:-2 }}/>
    </Animated.View>
  );
}

/* WHEEZE SPIRIT — lime-green spiky coronavirus ball, 12 spike crown */
function WheezeSpiritSprite({ hitFlash, bobY }: SpriteProps2) {
  const c = hitFlash ? "#fff" : "#4ade80";
  const dark = "#052e16";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* Spike container 68×68 */}
      <View style={{ width:68, height:68, alignItems:"center", justifyContent:"center" }}>
        {/* 12 corona spikes */}
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg,i)=>{
          const rad=deg*Math.PI/180;
          const r=30;
          const isMain = i%3===0;
          const sz = isMain ? 10 : 7;
          return (
            <View key={i} style={{
              position:"absolute",
              left:34+Math.sin(rad)*r-sz/2,
              top:34-Math.cos(rad)*r-sz/2,
              width:sz, height:sz, borderRadius:1.5,
              backgroundColor:isMain?c:c+"88",
              transform:[{rotate:"45deg"}],
            }}/>
          );
        })}
        {/* Main orb */}
        <View style={{
          width:46, height:46, borderRadius:23,
          borderWidth:2.5, borderColor:c,
          overflow:"hidden", backgroundColor:dark,
        }}>
          <LinearGradient colors={[c+"bb","#16a34a","#052e16"]}
            start={{x:0.2,y:0}} end={{x:0.8,y:1}}
            style={StyleSheet.absoluteFillObject}/>
          <View style={{
            position:"absolute", top:5, left:7,
            width:14, height:8, borderRadius:8,
            backgroundColor:"#ffffff28",
          }}/>
          {/* Eyes */}
          {[8,26].map((l,i)=>(
            <View key={i} style={{
              position:"absolute", top:13, left:l,
              width:11, height:11, borderRadius:6,
              backgroundColor:"#030f07",
              borderWidth:1.5, borderColor:c+"80",
              alignItems:"center", justifyContent:"center",
            }}>
              <View style={{ width:4, height:4, borderRadius:2, backgroundColor:c }}/>
            </View>
          ))}
          {/* Grin */}
          <View style={{
            position:"absolute", bottom:8, alignSelf:"center",
            width:16, height:6, borderRadius:8,
            borderTopLeftRadius:0, borderTopRightRadius:0,
            backgroundColor:"#030f07", borderWidth:1, borderColor:c+"55",
          }}/>
        </View>
      </View>
      <View style={{ width:32, height:4, borderRadius:16, backgroundColor:"#00000060", marginTop:-2 }}/>
    </Animated.View>
  );
}

/* MUCUS BLOB — yellow-green translucent, 6 drip tentacles, droopy eyes */
function MucusBlobSprite({ hitFlash, bobY }: SpriteProps2) {
  const c = hitFlash ? "#fff" : "#a3e635";
  const dark = "#1a2e05";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* Drop shadow behind blob */}
      <View style={{
        position:"absolute", top:4, left:4,
        width:52, height:42, borderRadius:22,
        backgroundColor:"#00000055",
      }}/>
      {/* Main blob body */}
      <View style={{
        width:52, height:42, borderRadius:22,
        borderTopLeftRadius:14, borderTopRightRadius:28,
        borderBottomLeftRadius:10, borderBottomRightRadius:20,
        borderWidth:2.5, borderColor:c,
        overflow:"hidden", backgroundColor:dark,
      }}>
        <LinearGradient colors={[c+"bb","#4d7c0f","#1a2e05"]}
          start={{x:0.15,y:0}} end={{x:0.85,y:1}}
          style={StyleSheet.absoluteFillObject}/>
        {/* Translucent highlight */}
        <View style={{
          position:"absolute", top:5, left:7,
          width:16, height:9, borderRadius:9,
          backgroundColor:"#ffffff30",
        }}/>
        {/* Bubble bumps */}
        {[{t:5,l:33,s:7},{t:12,l:40,s:5}].map((b,i)=>(
          <View key={i} style={{
            position:"absolute", top:b.t, left:b.l,
            width:b.s, height:b.s, borderRadius:b.s/2,
            backgroundColor:dark, borderWidth:1, borderColor:c+"50",
          }}/>
        ))}
        {/* Droopy eyes */}
        {[5,22].map((l,i)=>(
          <View key={i} style={{
            position:"absolute", top:8, left:l,
            width:12, height:10, borderRadius:5,
            borderBottomLeftRadius:1, borderBottomRightRadius:1,
            backgroundColor:dark, borderWidth:1, borderColor:c+"60",
            alignItems:"center", justifyContent:"center",
          }}>
            <View style={{ width:5, height:5, borderRadius:3, backgroundColor:"#bbf7d0" }}/>
          </View>
        ))}
      </View>
      {/* 6 drip tentacles */}
      <View style={{ flexDirection:"row", gap:1, marginTop:-4 }}>
        {[{w:8,h:10},{w:5,h:14},{w:9,h:9},{w:5,h:12},{w:8,h:10},{w:6,h:8}].map((d,i)=>(
          <View key={i} style={{
            width:d.w, height:d.h, borderRadius:999,
            backgroundColor:"#4d7c0f", borderWidth:1, borderColor:c+"40",
            marginTop:i%2===1?5:0,
          }}/>
        ))}
      </View>
      <View style={{ width:36, height:4, borderRadius:18, backgroundColor:"#00000060", marginTop:1 }}/>
    </Animated.View>
  );
}

/* HYPOXIA WRAITH — deep purple void orb, 8 radiating energy beams, hollow eyes */
function HypoxiaWraithSprite({ hitFlash, bobY }: SpriteProps2) {
  const c = hitFlash ? "#fff" : "#c084fc";
  const dark = "#1e0540";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* Energy beam container 72×72 */}
      <View style={{ width:72, height:72, alignItems:"center", justifyContent:"center" }}>
        {/* Outer void glow */}
        <View style={{
          position:"absolute", width:72, height:72, borderRadius:36,
          backgroundColor:"#7c3aed08", borderWidth:1, borderColor:"#7c3aed20",
        }}/>
        {/* 8 radiating beams */}
        {[0,45,90,135,180,225,270,315].map((deg,i)=>{
          const rad=deg*Math.PI/180;
          const r=28;
          const isMain=i%2===0;
          return (
            <View key={i} style={{
              position:"absolute",
              left:36+Math.sin(rad)*r-(isMain?3:2),
              top:36-Math.cos(rad)*r-(isMain?9:6),
              width:isMain?6:4, height:isMain?18:12,
              borderRadius:3,
              backgroundColor:c+(isMain?"88":"44"),
              transform:[{rotate:`${deg}deg`}],
            }}/>
          );
        })}
        {/* Main orb */}
        <View style={{
          width:48, height:48, borderRadius:24,
          borderWidth:2.5, borderColor:c,
          overflow:"hidden", backgroundColor:dark,
        }}>
          <LinearGradient colors={[c+"99","#5b21b6","#1e0540"]}
            start={{x:0.2,y:0}} end={{x:0.8,y:1}}
            style={StyleSheet.absoluteFillObject}/>
          {/* Shine */}
          <View style={{
            position:"absolute", top:5, left:7,
            width:14, height:8, borderRadius:8,
            backgroundColor:"#ffffff20",
          }}/>
          {/* Void rings */}
          <View style={{
            position:"absolute", width:36, height:36, borderRadius:18,
            borderWidth:1, borderColor:c+"40", top:6, left:6,
          }}/>
          {/* Hollow socket eyes */}
          {[8,26].map((l,i)=>(
            <View key={i} style={{
              position:"absolute", top:14, left:l,
              width:12, height:10, borderRadius:5,
              backgroundColor:"#090020",
              borderWidth:2, borderColor:c+"cc",
            }}/>
          ))}
          {/* Thin slash mouth */}
          <View style={{
            position:"absolute", bottom:9, left:9, right:9,
            height:2.5, borderRadius:2,
            backgroundColor:c+"60",
          }}/>
        </View>
      </View>
      <View style={{ width:32, height:4, borderRadius:16, backgroundColor:"#00000070", marginTop:-2 }}/>
    </Animated.View>
  );
}

/* BRONCHOSPASM BOSS — orange-red 3-ring constrictor, spikes, fierce crown */
function BronchospasmBossSprite({ hitFlash, bobY }: SpriteProps2) {
  const c = hitFlash ? "#fff" : "#f97316";
  const dark = "#431407";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      {/* Boss crown spikes */}
      <View style={{ flexDirection:"row", gap:4, marginBottom:-6, zIndex:10 }}>
        {[-20,0,20].map((rot,i)=>(
          <View key={i} style={{
            width:10, height:i===1?22:16, borderRadius:5,
            borderTopLeftRadius:2, borderTopRightRadius:2,
            backgroundColor:dark, borderWidth:1.5, borderColor:c+"90",
            transform:[{rotate:`${rot}deg`}],
          }}/>
        ))}
      </View>
      {/* Spike ring container 80×80 */}
      <View style={{ width:80, height:80, alignItems:"center", justifyContent:"center" }}>
        {/* 8 outer spikes on ring */}
        {[0,45,90,135,180,225,270,315].map((deg,i)=>{
          const rad=deg*Math.PI/180;
          const r=36;
          return (
            <View key={i} style={{
              position:"absolute",
              left:40+Math.sin(rad)*r-5,
              top:40-Math.cos(rad)*r-5,
              width:10, height:10, borderRadius:2,
              backgroundColor:c+(i%2===0?"ee":"88"),
              transform:[{rotate:"45deg"}],
            }}/>
          );
        })}
        {/* Outer ring */}
        <View style={{
          position:"absolute", width:70, height:70, borderRadius:35,
          borderWidth:4, borderColor:c,
          backgroundColor:"#7c2d1230",
        }}>
          <LinearGradient colors={[c+"22","transparent"]}
            start={{x:0.3,y:0}} end={{x:0.7,y:1}}
            style={[StyleSheet.absoluteFillObject, {borderRadius:34}]}/>
        </View>
        {/* Mid ring */}
        <View style={{
          position:"absolute", width:52, height:52, borderRadius:26,
          borderWidth:3, borderColor:c+"cc",
          backgroundColor:"#431407",
        }}>
          <LinearGradient colors={[c+"33","#431407"]}
            start={{x:0.2,y:0}} end={{x:0.8,y:1}}
            style={[StyleSheet.absoluteFillObject, {borderRadius:25}]}/>
        </View>
        {/* Inner core */}
        <View style={{
          width:34, height:34, borderRadius:17,
          borderWidth:2.5, borderColor:"#fbbf24",
          backgroundColor:"#1a0800",
          overflow:"hidden",
          alignItems:"center", justifyContent:"center",
        }}>
          <LinearGradient colors={[c+"88","#431407"]}
            start={{x:0.2,y:0}} end={{x:0.8,y:1}}
            style={StyleSheet.absoluteFillObject}/>
          {/* Fierce slit eyes */}
          {[4,18].map((l,i)=>(
            <View key={i} style={{
              position:"absolute", top:9, left:l,
              width:11, height:8, borderRadius:4,
              backgroundColor:dark, borderWidth:2, borderColor:"#fbbf24",
              alignItems:"center", justifyContent:"center",
            }}>
              <View style={{ width:3, height:7, borderRadius:2, backgroundColor:dark }}/>
              <View style={{ position:"absolute", width:2.5, height:2.5, borderRadius:1.5, backgroundColor:"#fbbf24", top:1, right:1 }}/>
            </View>
          ))}
        </View>
      </View>
      <View style={{ width:50, height:5, borderRadius:25, backgroundColor:"#000000cc", marginTop:-2 }}/>
    </Animated.View>
  );
}

function EnemySpriteV2({ typeId, hitFlash, bobY }: {
  typeId: string; hitFlash: boolean; bobY: Animated.AnimatedInterpolation<number>;
}) {
  switch (typeId) {
    case "breathless_wisp":    return <DyspneaWispSprite    hitFlash={hitFlash} bobY={bobY}/>;
    case "wheeze_sprite":      return <WheezeSpiritSprite   hitFlash={hitFlash} bobY={bobY}/>;
    case "mucus_slime":        return <MucusBlobSprite       hitFlash={hitFlash} bobY={bobY}/>;
    case "hypoxia_wraith":     return <HypoxiaWraithSprite  hitFlash={hitFlash} bobY={bobY}/>;
    case "bronchospasm_drake": return <BronchospasmBossSprite hitFlash={hitFlash} bobY={bobY}/>;
    default: return <View style={{ width:46, height:46, borderRadius:23, backgroundColor:"#334155" }}/>;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⑦ HEALER UNIT SPRITES — chibi donghua/anime 2.5D battle sprites
══════════════════════════════════════════════════════════════════════════════ */

/* WARD SCOUT — blue-white nurse, assessment pose, clipboard talisman */
function WardScoutSpriteV2({ castFlash }: { castFlash: boolean }) {
  const trim = castFlash ? "#2563eb" : "#60a5fa";
  const coat = castFlash ? "#dbeafe" : "#f0f9ff";
  const skin = "#fcd9b0";
  const hair = "#1e3a5f";
  return (
    <View style={{ width:54, height:72, position:"relative" }}>
      {/* Legs */}
      <View style={{ position:"absolute", bottom:8, left:14, width:10, height:18, borderRadius:5, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:8, left:26, width:10, height:16, borderRadius:5, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a", transform:[{rotate:"-7deg"}] }}/>
      {/* Shoes */}
      <View style={{ position:"absolute", bottom:2, left:8, width:17, height:8, borderRadius:4, backgroundColor:"#1e3a5f", borderWidth:1.5, borderColor:trim }}/>
      <View style={{ position:"absolute", bottom:1, left:22, width:17, height:8, borderRadius:4, backgroundColor:"#1e3a5f", borderWidth:1.5, borderColor:trim, transform:[{rotate:"-5deg"}] }}/>
      {/* Back arm */}
      <View style={{ position:"absolute", top:27, left:2, width:10, height:22, borderRadius:5, backgroundColor:"#dbeafe", borderWidth:1.5, borderColor:trim, transform:[{rotate:"-30deg"}] }}/>
      {/* Coat body shadow */}
      <View style={{ position:"absolute", top:28, left:10, width:38, height:36, borderRadius:10, borderTopLeftRadius:18, backgroundColor:"#0f172a50" }}/>
      {/* Coat body */}
      <View style={{ position:"absolute", top:25, left:6, width:38, height:36, borderRadius:10, borderTopLeftRadius:18, borderTopRightRadius:6, borderWidth:2, borderColor:trim, overflow:"hidden", backgroundColor:coat }}>
        <LinearGradient colors={["#ffffff","#dbeafe","#bfdbfe60"]} start={{x:0.1,y:0}} end={{x:0.9,y:1}} style={StyleSheet.absoluteFillObject}/>
        {/* Left lapel */}
        <View style={{ position:"absolute", top:0, left:4, width:10, height:18, borderRadius:4, borderTopLeftRadius:10, backgroundColor:trim+"40" }}/>
        {/* Buttons */}
        {[9,17,25].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:22, width:5, height:5, borderRadius:3, backgroundColor:trim }}/>
        ))}
        {/* Belt */}
        <View style={{ position:"absolute", top:21, left:0, right:0, height:3, backgroundColor:trim+"60" }}/>
        {/* Red cross badge */}
        <View style={{ position:"absolute", top:5, right:5, width:9, height:9 }}>
          <View style={{ position:"absolute", top:3, left:0, right:0, height:3, borderRadius:1, backgroundColor:"#ef4444" }}/>
          <View style={{ position:"absolute", left:3, top:0, bottom:0, width:3, borderRadius:1, backgroundColor:"#ef4444" }}/>
        </View>
      </View>
      {/* Clipboard talisman — front arm */}
      <View style={{ position:"absolute", top:30, left:36, zIndex:6 }}>
        <View style={{ width:16, height:20, borderRadius:3, backgroundColor:"#f0f9ff", borderWidth:2, borderColor:trim, alignItems:"center" }}>
          {[4,8,12,16].map((t,i)=>(
            <View key={i} style={{ position:"absolute", top:t, left:2, right:2, height:1.5, borderRadius:1, backgroundColor:trim+"80" }}/>
          ))}
          {/* Clip */}
          <View style={{ position:"absolute", top:-3, left:4, right:4, height:5, borderRadius:2, backgroundColor:trim }}/>
        </View>
        {/* Arm holding clipboard */}
        <View style={{ position:"absolute", bottom:-4, left:-6, width:10, height:14, borderRadius:5, backgroundColor:skin, borderWidth:1.5, borderColor:"#f8c890", transform:[{rotate:"15deg"}] }}/>
      </View>
      {/* Head shadow */}
      <View style={{ position:"absolute", top:6, left:12, width:32, height:32, borderRadius:16, backgroundColor:"#0f172a50" }}/>
      {/* Head */}
      <View style={{ position:"absolute", top:3, left:9, width:32, height:32, borderRadius:16, backgroundColor:skin, borderWidth:2, borderColor:"#f8c890", overflow:"visible" }}>
        {/* Hair top */}
        <View style={{ position:"absolute", top:-5, left:-2, width:36, height:16, borderRadius:14, backgroundColor:hair }}/>
        {/* Hair side bun */}
        <View style={{ position:"absolute", top:0, right:-5, width:12, height:12, borderRadius:6, backgroundColor:hair, borderWidth:1.5, borderColor:hair }}/>
        {/* Nurse cap */}
        <View style={{ position:"absolute", top:-9, left:4, width:22, height:9, borderRadius:4, backgroundColor:coat, borderWidth:1.5, borderColor:trim }}>
          <View style={{ position:"absolute", top:2, left:7, width:8, height:3 }}>
            <View style={{ position:"absolute", top:1, left:0, right:0, height:1.5, borderRadius:1, backgroundColor:"#ef4444" }}/>
            <View style={{ position:"absolute", top:0, left:3, bottom:0, width:1.5, borderRadius:1, backgroundColor:"#ef4444" }}/>
          </View>
        </View>
        {/* Eyes */}
        <View style={{ position:"absolute", top:10, left:5, right:5, flexDirection:"row", justifyContent:"space-between" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:10, height:10, borderRadius:5, backgroundColor:"#1e3a5f", borderWidth:1, borderColor:"#60a5fa30", alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:4, height:4, borderRadius:2, backgroundColor:"#60a5fa" }}/>
              <View style={{ position:"absolute", top:1, right:1, width:2.5, height:2.5, borderRadius:1.5, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        {/* Blush dots */}
        {[{l:3,t:18},{l:20,t:18}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, left:b.l, width:6, height:3, borderRadius:3, backgroundColor:"#fca5a530" }}/>
        ))}
        {/* Mouth */}
        <View style={{ position:"absolute", bottom:5, alignSelf:"center", width:8, height:3, borderRadius:3, borderTopLeftRadius:0, borderTopRightRadius:0, backgroundColor:"#e67e9040" }}/>
      </View>
    </View>
  );
}

/* MIST CASTER — jade-green herbalist, potion vial staff */
function MistCasterSpriteV2({ castFlash }: { castFlash: boolean }) {
  const trim = castFlash ? "#16a34a" : "#22c55e";
  const robe = castFlash ? "#bbf7d0" : "#f0fdf4";
  const skin = "#fcd9b0";
  const hair = "#2d3a1a";
  return (
    <View style={{ width:54, height:74, position:"relative" }}>
      {/* Robe hem/skirt flowing */}
      <View style={{ position:"absolute", bottom:6, left:6, width:38, height:24, borderRadius:8, borderTopLeftRadius:0, borderTopRightRadius:0, borderBottomLeftRadius:14, borderBottomRightRadius:14, backgroundColor:"#14532d", borderWidth:1.5, borderColor:trim+"60" }}/>
      {/* Shoes */}
      <View style={{ position:"absolute", bottom:0, left:8, width:14, height:7, borderRadius:4, backgroundColor:hair, borderWidth:1.5, borderColor:trim }}/>
      <View style={{ position:"absolute", bottom:0, left:24, width:14, height:7, borderRadius:4, backgroundColor:hair, borderWidth:1.5, borderColor:trim }}/>
      {/* Back arm/sleeve */}
      <View style={{ position:"absolute", top:26, left:0, width:12, height:24, borderRadius:6, backgroundColor:"#14532d", borderWidth:1.5, borderColor:trim+"70", transform:[{rotate:"-20deg"}] }}/>
      {/* Robe body */}
      <View style={{ position:"absolute", top:24, left:4, width:40, height:38, borderRadius:10, borderTopLeftRadius:18, borderTopRightRadius:8, borderWidth:2, borderColor:trim, overflow:"hidden", backgroundColor:"#14532d" }}>
        <LinearGradient colors={[trim+"55","#14532d","#052e16"]} start={{x:0.15,y:0}} end={{x:0.85,y:1}} style={StyleSheet.absoluteFillObject}/>
        {/* Robe sash */}
        <View style={{ position:"absolute", top:18, left:0, right:0, height:4, backgroundColor:trim+"70" }}/>
        {/* Herb pouch on belt */}
        <View style={{ position:"absolute", top:20, left:6, width:10, height:9, borderRadius:4, backgroundColor:"#78350f", borderWidth:1, borderColor:"#d97706" }}/>
        {/* Left robe panel decoration */}
        <View style={{ position:"absolute", top:5, right:4, width:8, height:14, borderRadius:3, backgroundColor:trim+"30" }}/>
      </View>
      {/* Vial staff — left arm holding up */}
      <View style={{ position:"absolute", top:8, left:38, zIndex:8 }}>
        {/* Staff pole */}
        <View style={{ width:4, height:36, borderRadius:2, backgroundColor:"#78350f", borderWidth:1, borderColor:"#d97706" }}/>
        {/* Vial bulb at top */}
        <View style={{ position:"absolute", top:-4, left:-4, width:12, height:16, borderRadius:6, borderWidth:2, borderColor:trim+"cc", backgroundColor:"#0a1a0a", overflow:"hidden", alignItems:"center", justifyContent:"center" }}>
          <LinearGradient colors={[trim+"cc","#14532d"]} start={{x:0.3,y:0}} end={{x:0.7,y:1}} style={StyleSheet.absoluteFillObject}/>
          <View style={{ width:3, height:8, borderRadius:2, backgroundColor:trim+"ee" }}/>
        </View>
        {/* Mist puffs */}
        {castFlash && [0,1,2].map(i=>(
          <View key={i} style={{ position:"absolute", top:-12-i*6, left:-3+i*3, width:8, height:5, borderRadius:4, backgroundColor:trim+"40" }}/>
        ))}
        {/* Arm */}
        <View style={{ position:"absolute", top:20, left:-8, width:10, height:16, borderRadius:5, backgroundColor:skin, borderWidth:1.5, borderColor:"#f8c890", transform:[{rotate:"10deg"}] }}/>
      </View>
      {/* Head shadow */}
      <View style={{ position:"absolute", top:5, left:12, width:32, height:32, borderRadius:16, backgroundColor:"#05160a50" }}/>
      {/* Head */}
      <View style={{ position:"absolute", top:2, left:8, width:32, height:32, borderRadius:16, backgroundColor:skin, borderWidth:2, borderColor:"#f8c890", overflow:"visible" }}>
        {/* Hair */}
        <View style={{ position:"absolute", top:-6, left:-1, width:34, height:18, borderRadius:14, backgroundColor:hair }}/>
        {/* Herbal crown/leaf ornament */}
        <View style={{ position:"absolute", top:-10, left:6 }}>
          {[-15,0,15].map((r,i)=>(
            <View key={i} style={{ position:"absolute", top:i===1?0:2, left:i===0?0:i===1?8:16, width:8, height:12, borderRadius:4, backgroundColor:"#16a34a", transform:[{rotate:`${r}deg`}] }}/>
          ))}
        </View>
        {/* Eyes */}
        <View style={{ position:"absolute", top:10, left:5, right:5, flexDirection:"row", justifyContent:"space-between" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:10, height:10, borderRadius:5, backgroundColor:"#14532d", borderWidth:1, borderColor:trim+"40", alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:4, height:4, borderRadius:2, backgroundColor:trim }}/>
              <View style={{ position:"absolute", top:1, right:1, width:2.5, height:2.5, borderRadius:1.5, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        {/* Blush */}
        {[{l:3,t:18},{l:20,t:18}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, left:b.l, width:6, height:3, borderRadius:3, backgroundColor:"#fca5a530" }}/>
        ))}
        {/* Smile */}
        <View style={{ position:"absolute", bottom:5, alignSelf:"center", width:10, height:4, borderRadius:5, borderTopLeftRadius:0, borderTopRightRadius:0, backgroundColor:"#e67e9040" }}/>
      </View>
    </View>
  );
}

/* O2 HEALER — white-teal medic, oxygen flask apparatus */
function O2HealerSpriteV2({ castFlash }: { castFlash: boolean }) {
  const trim = castFlash ? "#0891b2" : "#22d3ee";
  const coat = castFlash ? "#cffafe" : "#f0fdff";
  const skin = "#fcd9b0";
  const hair = "#374151";
  return (
    <View style={{ width:54, height:72, position:"relative" }}>
      {/* Legs */}
      <View style={{ position:"absolute", bottom:8, left:14, width:10, height:18, borderRadius:5, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:8, left:26, width:10, height:16, borderRadius:5, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a", transform:[{rotate:"-7deg"}] }}/>
      {/* Shoes */}
      <View style={{ position:"absolute", bottom:2, left:8, width:17, height:8, borderRadius:4, backgroundColor:"#164e63", borderWidth:1.5, borderColor:trim }}/>
      <View style={{ position:"absolute", bottom:1, left:22, width:17, height:8, borderRadius:4, backgroundColor:"#164e63", borderWidth:1.5, borderColor:trim, transform:[{rotate:"-5deg"}] }}/>
      {/* Back arm */}
      <View style={{ position:"absolute", top:27, left:2, width:10, height:22, borderRadius:5, backgroundColor:"#cffafe", borderWidth:1.5, borderColor:trim, transform:[{rotate:"-28deg"}] }}/>
      {/* Coat body shadow */}
      <View style={{ position:"absolute", top:28, left:10, width:38, height:36, borderRadius:10, borderTopLeftRadius:18, backgroundColor:"#0f172a50" }}/>
      {/* Coat body */}
      <View style={{ position:"absolute", top:25, left:6, width:38, height:36, borderRadius:10, borderTopLeftRadius:18, borderTopRightRadius:6, borderWidth:2, borderColor:trim, overflow:"hidden", backgroundColor:coat }}>
        <LinearGradient colors={["#ffffff","#cffafe","#a5f3fc60"]} start={{x:0.1,y:0}} end={{x:0.9,y:1}} style={StyleSheet.absoluteFillObject}/>
        {/* Left lapel */}
        <View style={{ position:"absolute", top:0, left:4, width:10, height:18, borderRadius:4, borderTopLeftRadius:10, backgroundColor:trim+"40" }}/>
        {/* Buttons */}
        {[9,17,25].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:22, width:5, height:5, borderRadius:3, backgroundColor:trim }}/>
        ))}
        {/* Teal belt/sash */}
        <View style={{ position:"absolute", top:21, left:0, right:0, height:4, backgroundColor:trim+"50" }}/>
        {/* O2 badge */}
        <View style={{ position:"absolute", top:5, right:5, width:11, height:11, borderRadius:6, backgroundColor:trim+"30", borderWidth:1, borderColor:trim, alignItems:"center", justifyContent:"center" }}>
          <Text style={{ fontSize:5, color:trim, fontWeight:"800" }}>O₂</Text>
        </View>
      </View>
      {/* Oxygen flask — front held up */}
      <View style={{ position:"absolute", top:22, left:38, zIndex:8 }}>
        {/* Flask tank */}
        <View style={{ width:14, height:22, borderRadius:7, backgroundColor:"#164e63", borderWidth:2, borderColor:trim, overflow:"hidden", alignItems:"center" }}>
          <LinearGradient colors={[trim+"60","#164e63"]} start={{x:0.3,y:0}} end={{x:0.7,y:1}} style={StyleSheet.absoluteFillObject}/>
          <Text style={{ position:"absolute", top:4, fontSize:7, color:trim+"dd", fontWeight:"700" }}>O₂</Text>
          <View style={{ position:"absolute", bottom:3, left:3, right:3, height:4, borderRadius:2, backgroundColor:trim+"30" }}/>
        </View>
        {/* Flask nozzle */}
        <View style={{ position:"absolute", top:-5, left:4, width:6, height:7, borderRadius:3, backgroundColor:"#0e7490", borderWidth:1, borderColor:trim }}/>
        {/* Glow puffs if casting */}
        {castFlash && [0,1].map(i=>(
          <View key={i} style={{ position:"absolute", top:-10-i*5, left:1+i*4, width:9, height:6, borderRadius:5, backgroundColor:trim+"35" }}/>
        ))}
        {/* Arm */}
        <View style={{ position:"absolute", top:12, left:-8, width:10, height:14, borderRadius:5, backgroundColor:skin, borderWidth:1.5, borderColor:"#f8c890", transform:[{rotate:"12deg"}] }}/>
      </View>
      {/* Head shadow */}
      <View style={{ position:"absolute", top:6, left:12, width:32, height:32, borderRadius:16, backgroundColor:"#0f172a50" }}/>
      {/* Head */}
      <View style={{ position:"absolute", top:3, left:9, width:32, height:32, borderRadius:16, backgroundColor:skin, borderWidth:2, borderColor:"#f8c890", overflow:"visible" }}>
        {/* Hair */}
        <View style={{ position:"absolute", top:-5, left:-1, width:34, height:16, borderRadius:14, backgroundColor:hair }}/>
        {/* Hair bun right */}
        <View style={{ position:"absolute", top:1, right:-4, width:11, height:11, borderRadius:6, backgroundColor:hair }}/>
        {/* Medical headband */}
        <View style={{ position:"absolute", top:-2, left:1, width:28, height:5, borderRadius:3, backgroundColor:trim+"60" }}>
          <View style={{ position:"absolute", top:0, left:9, width:9, height:5 }}>
            <View style={{ position:"absolute", top:1, left:0, right:0, height:3, borderRadius:1, backgroundColor:"#fff" }}/>
            <View style={{ position:"absolute", top:0, left:3, bottom:0, width:3, borderRadius:1, backgroundColor:"#fff" }}/>
          </View>
        </View>
        {/* Eyes */}
        <View style={{ position:"absolute", top:10, left:5, right:5, flexDirection:"row", justifyContent:"space-between" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:10, height:10, borderRadius:5, backgroundColor:"#164e63", borderWidth:1, borderColor:trim+"50", alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:4, height:4, borderRadius:2, backgroundColor:trim }}/>
              <View style={{ position:"absolute", top:1, right:1, width:2.5, height:2.5, borderRadius:1.5, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        {/* Blush */}
        {[{l:3,t:18},{l:20,t:18}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, left:b.l, width:6, height:3, borderRadius:3, backgroundColor:"#fca5a530" }}/>
        ))}
        <View style={{ position:"absolute", bottom:5, alignSelf:"center", width:8, height:3, borderRadius:3, borderTopLeftRadius:0, borderTopRightRadius:0, backgroundColor:"#e67e9040" }}/>
      </View>
    </View>
  );
}

function HealerSpriteV2({ typeId, castFlash }: { typeId: string; castFlash: boolean }) {
  switch (typeId) {
    case "ward_scout":  return <WardScoutSpriteV2  castFlash={castFlash}/>;
    case "mist_caster": return <MistCasterSpriteV2 castFlash={castFlash}/>;
    case "o2_healer":   return <O2HealerSpriteV2   castFlash={castFlash}/>;
    default: return <View style={{ width:46, height:60, borderRadius:8, backgroundColor:"#334155" }}/>;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⑧ DEPLOY PAD — octagonal lotus healing platform
══════════════════════════════════════════════════════════════════════════════ */
interface DeployPadV2Props {
  tileIdx: number;
  unit: any;
  selectedUnit: string | null;
  canAfford: boolean;
  isMergeCandidate: boolean;
  onPress: () => void;
  aw: number; ah: number;
  unitColors: Record<string, string>;
  bobY: Animated.AnimatedInterpolation<number>;
}

function DeployPadV2({
  tileIdx, unit, selectedUnit, canAfford, isMergeCandidate, onPress, aw, ah, unitColors, bobY,
}: DeployPadV2Props) {
  const [fx, fy] = DEPLOY_TILES[tileIdx];
  const px = fx * aw, py = fy * ah;
  const isOccupied = !!unit;
  const padColor = isOccupied ? (unitColors[unit.typeId] ?? "#60a5fa") : (canAfford ? "#22d3ee" : "#475569");
  const sz = TILE_SIZE;

  return (
    <Pressable
      onPress={onPress}
      style={{
        position:"absolute",
        left:px - sz/2 - 2, top:py - sz/2 - 18,
        width:sz+4, height:sz+26,
        alignItems:"center",
        zIndex:15,
      }}
    >
      {/* Deployed healer sprite — above pad */}
      {isOccupied && (
        <View style={{ marginBottom:-6, zIndex:16 }}>
          <HealerSpriteV2 typeId={unit.typeId} castFlash={unit.castFlash ?? false}/>
        </View>
      )}

      {/* Merge glow ring */}
      {isMergeCandidate && (
        <View style={{
          position:"absolute", bottom:2,
          width:sz+12, height:sz+12,
          borderRadius:sz/2+6,
          borderWidth:2, borderColor:"#ffd70088",
          backgroundColor:"#ffd70018",
        }}/>
      )}

      {/* Platform pad — octagonal appearance */}
      {/* Outer border/shadow ring */}
      <View style={{
        width:sz, height:sz,
        borderRadius:12,
        backgroundColor:"#00000055",
        position:"absolute", bottom:2, left:4,
      }}/>
      {/* Main platform */}
      <View style={{
        width:sz, height:sz,
        borderRadius:12,
        overflow:"hidden",
        borderWidth:2,
        borderColor: isMergeCandidate ? "#ffd700" : padColor + "cc",
        backgroundColor: isOccupied ? "#0d1a14" : "#0a1410",
      }}>
        <LinearGradient
          colors={isOccupied
            ? [padColor+"44","#0d1a14","#0a1410"]
            : canAfford
              ? ["#22d3ee18","#0c2a24","#0a1410"]
              : ["#47556930","#0a1010","#080e0e"]}
          start={{x:0.2,y:0}} end={{x:0.8,y:1}}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Corner lotus petals */}
        {[0,90,180,270].map((deg,i)=>{
          const rad=deg*Math.PI/180;
          const r=(sz-16)/2;
          return (
            <View key={i} style={{
              position:"absolute",
              left:sz/2+Math.sin(rad)*r-5,
              top:sz/2-Math.cos(rad)*r-5,
              width:10, height:10, borderRadius:5,
              backgroundColor:padColor+(isOccupied?"30":"18"),
              borderWidth:1, borderColor:padColor+(isOccupied?"60":"30"),
            }}/>
          );
        })}
        {/* Inner ring */}
        <View style={{
          position:"absolute",
          left:sz/2-14, top:sz/2-14,
          width:28, height:28, borderRadius:14,
          borderWidth:1.5, borderColor:padColor+(isOccupied?"80":"40"),
        }}/>
        {/* Empty pad: + deploy indicator */}
        {!isOccupied && canAfford && selectedUnit && (
          <>
            <View style={{ position:"absolute", top:"50%", left:"15%", right:"15%", height:2, backgroundColor:padColor+"60", marginTop:-1 }}/>
            <View style={{ position:"absolute", left:"50%", top:"15%", bottom:"15%", width:2, backgroundColor:padColor+"60", marginLeft:-1 }}/>
          </>
        )}
        {/* Occupied: unit category label */}
        {isOccupied && (
          <Text style={{
            position:"absolute", bottom:4, alignSelf:"center",
            fontSize:6, fontWeight:"800", color:padColor,
            letterSpacing:0.4,
          }}>
            {unit.typeId === "ward_scout" ? "ASSESS" : unit.typeId === "mist_caster" ? "TREAT" : "SUPP"}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⑨ ENEMY ON PATH — rendered disease blob on board
══════════════════════════════════════════════════════════════════════════════ */
function EnemyOnBoardV2({
  enemy, bobY, aw, ah,
}: { enemy: any; bobY: Animated.AnimatedInterpolation<number>; aw: number; ah: number }) {
  const x = enemy.x * aw, y = enemy.y * ah;
  const hpPct = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const barColor = hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#facc15" : "#ef4444";

  return (
    <View style={{
      position:"absolute",
      left:x-36, top:y-50,
      alignItems:"center", zIndex:14,
    }}>
      {/* HP bar */}
      <View style={{
        width:44, height:5, backgroundColor:"#00000080",
        borderRadius:3, marginBottom:2, overflow:"hidden",
        borderWidth:1, borderColor:"#ffffff20",
      }}>
        <View style={{
          width:`${hpPct*100}%` as any, height:"100%",
          backgroundColor:barColor, borderRadius:3,
        }}/>
      </View>
      {/* Clinical cue label */}
      <View style={{
        backgroundColor:"#00000080", borderRadius:4,
        paddingHorizontal:4, paddingVertical:1, marginBottom:1,
        borderWidth:0.5, borderColor:enemy.color+"60",
      }}>
        <Text style={{ color:enemy.color, fontSize:6, fontWeight:"700" }}>
          {enemy.clue ?? enemy.name}
        </Text>
      </View>
      {/* Disease sprite */}
      <EnemySpriteV2 typeId={enemy.typeId} hitFlash={enemy.hitFlash ?? false} bobY={bobY}/>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⑩ PROJECTILE VIEW
══════════════════════════════════════════════════════════════════════════════ */
function ProjectileV2({ p, aw, ah }: { p: any; aw: number; ah: number }) {
  const px = p.x * aw, py = p.y * ah;
  const col = p.color ?? "#22d3ee";
  return (
    <View style={{
      position:"absolute",
      left:px-5, top:py-5,
      width:10, height:10, borderRadius:5,
      backgroundColor:col+"dd",
      borderWidth:1.5, borderColor:"#fff8",
      zIndex:13,
      shadowColor:col, shadowRadius:4, shadowOpacity:0.8,
    }}/>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⑪ WAVE PAUSE OVERLAY
══════════════════════════════════════════════════════════════════════════════ */
function WavePauseOverlayV2({ wave }: { wave: number }) {
  return (
    <View style={{
      ...StyleSheet.absoluteFillObject,
      alignItems:"center", justifyContent:"center",
      backgroundColor:"#00000070", zIndex:30,
    }}>
      <View style={{
        backgroundColor:"#0c1a14f0", borderRadius:16,
        padding:24, alignItems:"center",
        borderWidth:2, borderColor:"#22d3ee60",
        minWidth:180,
      }}>
        <Text style={{ color:"#22d3ee", fontSize:11, fontWeight:"700", letterSpacing:1.5, marginBottom:6 }}>
          ✦ WAVE {wave + 2} INCOMING ✦
        </Text>
        <Text style={{ color:"#a7f3d0", fontSize:9 }}>Deploy your healers…</Text>
      </View>
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⑫ MAIN V2 BOARD EXPORT
══════════════════════════════════════════════════════════════════════════════ */
export function WardBoardV2({
  aw, ah, onLayout,
  enemies, deployedUnits, projectiles,
  stability, phase,
  selectedUnit, ap, bobY,
  spawnQueueLen, mergeTileSet, onTilePress, canAfford, unitColors,
}: WardBoardV2Props) {
  return (
    <View
      style={{ flex:1, position:"relative", overflow:"hidden" }}
      onLayout={onLayout}
    >
      {/* ── 1. Illustrated scene background ── */}
      <ExpoImage
        source={require("../assets/images/board_main_bg.png")}
        style={[StyleSheet.absoluteFillObject, { opacity:0.72 }]}
        contentFit="cover"
      />

      {/* ── 2. Warm atmospheric vignette ── */}
      <LinearGradient
        colors={["#0a0f1880","#00000000","#0a0f1840"]}
        start={{x:0,y:0}} end={{x:0,y:1}}
        style={StyleSheet.absoluteFillObject}
      />

      {/* ── 3. Center platform bases ── */}
      {aw > 20 && <CenterPlatformBase aw={aw} ah={ah}/>}

      {/* ── 4. Scenic stone path ── */}
      {aw > 20 && <SanctuaryPath aw={aw} ah={ah}/>}

      {/* ── 5. Decorative lanterns ── */}
      {aw > 20 && <PathLanterns aw={aw} ah={ah}/>}

      {/* ── 6. Corruption portal (enemy spawn) ── */}
      {aw > 20 && <DiseasePortalV2 aw={aw} ah={ah}/>}

      {/* ── 7. Vital Lantern (protected objective) ── */}
      {aw > 20 && <VitalLanternV2 stability={stability} aw={aw} ah={ah}/>}

      {/* ── 8. Deploy pads + healer sprites ── */}
      {aw > 20 && DEPLOY_TILES.map((_, i) => (
        <DeployPadV2
          key={i}
          tileIdx={i}
          unit={deployedUnits.find((u:any) => u.tileIndex === i)}
          selectedUnit={selectedUnit}
          canAfford={canAfford}
          isMergeCandidate={mergeTileSet.has(i)}
          onPress={() => onTilePress(i)}
          aw={aw} ah={ah}
          unitColors={unitColors}
          bobY={bobY}
        />
      ))}

      {/* ── 9. Projectiles ── */}
      {projectiles.map((p:any) => (
        <ProjectileV2 key={p.uid} p={p} aw={aw} ah={ah}/>
      ))}

      {/* ── 10. Enemies on path ── */}
      {enemies.map((e:any) => (
        <EnemyOnBoardV2 key={e.uid} enemy={e} bobY={bobY} aw={aw} ah={ah}/>
      ))}

      {/* ── 11. Spawn queue warning ── */}
      {spawnQueueLen > 0 && (
        <View style={{
          position:"absolute", top:6, left:6,
          backgroundColor:"#7c3aedcc", borderRadius:8,
          paddingHorizontal:8, paddingVertical:3,
          borderWidth:1, borderColor:"#c084fc",
          zIndex:25,
        }}>
          <Text style={{ color:"#f3e8ff", fontSize:8, fontWeight:"700" }}>
            ⚡ {spawnQueueLen} enemies incoming
          </Text>
        </View>
      )}

      {/* ── 12. Wave pause overlay ── */}
      {phase === "wave_pause" && <WavePauseOverlayV2 wave={0}/>}
    </View>
  );
}

export default WardBoardV2;
