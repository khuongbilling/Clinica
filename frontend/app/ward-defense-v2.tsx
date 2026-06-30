/**
 * Ward Defense V2 — Lotus Healing Sanctum
 * Complete visual rebuild.
 *
 * CRITICAL FIXES vs. previous version:
 *  • Enemy positions now computed from pathIndex/pathProgress (were NaN before → enemies invisible)
 *  • Projectile positions now computed from fromFx/toFx/fromFy/toFy/progress (were NaN before)
 *  • Enemy and unit sprites upgraded to match the full-body chibi/donghua quality in ward-defense.tsx
 */
import React from "react";
import {
  View, Text, Animated, Pressable, StyleSheet, LayoutChangeEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/* ── Constants — must mirror ward-defense.tsx ─────────────────────────────── */
const ROAD_W    = 68;   /* wide, impactful stone lane */
const TILE_SIZE = 56;

const PATH_WPS: [number, number][] = [
  [0.88, 0.09],  /* 0 — Disease Portal */
  [0.14, 0.09],  /* 1 — top-left */
  [0.14, 0.47],  /* 2 — mid-left */
  [0.86, 0.47],  /* 3 — mid-right */
  [0.86, 0.88],  /* 4 — bottom-right */
  [0.11, 0.88],  /* 5 — Vital Lantern */
];

const DEPLOY_TILES: [number, number][] = [
  [0.38, 0.27], [0.55, 0.27], [0.72, 0.27],
  [0.30, 0.67], [0.50, 0.67], [0.70, 0.67],
];

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

/** FIXED: compute enemy position from game state (pathIndex + pathProgress) */
function getEnemyFrac(e: { pathIndex: number; pathProgress: number }): [number, number] {
  const pi   = cl(e.pathIndex, 0, PATH_WPS.length - 2);
  const from = PATH_WPS[pi], to = PATH_WPS[pi + 1];
  return [lp(from[0], to[0], e.pathProgress), lp(from[1], to[1], e.pathProgress)];
}

/* ════════════════════════════════════════════════════════════════════════════
   1. BOARD BACKGROUND — deep indigo sanctum atmosphere
════════════════════════════════════════════════════════════════════════════ */
function BoardBg({ aw, ah }: { aw: number; ah: number }) {
  return (
    <>
      <LinearGradient
        colors={["#040b18","#050e1c","#060f1e","#030810"]}
        start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Subtle floor tiles */}
      {aw > 20 && Array.from({ length: Math.ceil(ah / 38) + 1 }, (_, r) =>
        Array.from({ length: Math.ceil(aw / 52) + 1 }, (_, c) => (
          <View key={`ft${r}_${c}`} style={{
            position:"absolute", left:c*52-26, top:r*38-19,
            width:51, height:37,
            borderWidth:0.3, borderColor:"#1a2a3a15", zIndex:0,
          }}/>
        ))
      )}
      {/* Ambient rune glows */}
      {([
        [0.18,0.22,"#22d3ee",30],[0.76,0.18,"#a78bfa",22],
        [0.43,0.58,"#34d399",20],[0.80,0.68,"#22d3ee",16],
        [0.11,0.76,"#a78bfa",18],[0.57,0.35,"#fbbf24",14],
      ] as [number,number,string,number][]).map(([fx,fy,col,r],i)=>(
        <View key={`rg${i}`} style={{
          position:"absolute", left:fx*aw-r, top:fy*ah-r,
          width:r*2, height:r*2, borderRadius:r,
          backgroundColor:col+"06", borderWidth:0.5, borderColor:col+"14", zIndex:0,
        }}/>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   2. SANCTUARY PATH — warm sandstone lane, wide and readable
════════════════════════════════════════════════════════════════════════════ */
function SanctuaryPath({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;
  const N = PATH_WPS.length - 1;

  const slabs: { cx:number; cy:number; ang:number; alt:boolean }[] = [];
  for (let seg = 0; seg < N; seg++) {
    const [ax,ay] = PATH_WPS[seg], [bx,by] = PATH_WPS[seg+1];
    const dx=bx*aw-ax*aw, dy=by*ah-ay*ah;
    const len=Math.sqrt(dx*dx+dy*dy);
    const ang=Math.atan2(dy,dx)*180/Math.PI;
    const n=Math.max(1,Math.floor(len/24));
    for (let i=0;i<n;i++){
      const t=(i+0.5)/n;
      slabs.push({cx:ax*aw+dx*t, cy:ay*ah+dy*t, ang, alt:(i+seg)%2===0});
    }
  }

  const segs = PATH_WPS.slice(0,-1).map((wp,seg)=>{
    const to=PATH_WPS[seg+1];
    const x1=wp[0]*aw,y1=wp[1]*ah,x2=to[0]*aw,y2=to[1]*ah;
    const len=Math.sqrt((x2-x1)**2+(y2-y1)**2);
    const ang=Math.atan2(y2-y1,x2-x1)*180/Math.PI;
    return {x1,y1,x2,y2,len,ang,mx:(x1+x2)/2,my:(y1+y2)/2};
  });

  return (
    <>
      {/* Drop shadow */}
      {segs.map((s,i)=>(
        <View key={`shd${i}`} style={{
          position:"absolute", left:s.mx-s.len/2, top:s.my-(ROAD_W+18)/2,
          width:s.len, height:ROAD_W+18, backgroundColor:"#00000075",
          transform:[{rotate:`${s.ang}deg`}], zIndex:1,
        }}/>
      ))}
      {PATH_WPS.slice(1,-1).map(([fx,fy],i)=>(
        <View key={`cshd${i}`} style={{
          position:"absolute", left:fx*aw-(ROAD_W+18)/2, top:fy*ah-(ROAD_W+18)/2,
          width:ROAD_W+18, height:ROAD_W+18, borderRadius:(ROAD_W+18)/2,
          backgroundColor:"#00000075", zIndex:1,
        }}/>
      ))}
      {/* Dark border */}
      {segs.map((s,i)=>(
        <View key={`bdr${i}`} style={{
          position:"absolute", left:s.mx-s.len/2, top:s.my-(ROAD_W+8)/2,
          width:s.len, height:ROAD_W+8, backgroundColor:"#3a2c14",
          transform:[{rotate:`${s.ang}deg`}], zIndex:2,
        }}/>
      ))}
      {PATH_WPS.slice(1,-1).map(([fx,fy],i)=>(
        <View key={`bcap${i}`} style={{
          position:"absolute", left:fx*aw-(ROAD_W+8)/2, top:fy*ah-(ROAD_W+8)/2,
          width:ROAD_W+8, height:ROAD_W+8, borderRadius:(ROAD_W+8)/2,
          backgroundColor:"#3a2c14", zIndex:2,
        }}/>
      ))}
      {/* Stone lane base */}
      {segs.map((s,i)=>(
        <View key={`base${i}`} style={{
          position:"absolute", left:s.mx-s.len/2, top:s.my-ROAD_W/2,
          width:s.len, height:ROAD_W, backgroundColor:"#b8945a",
          transform:[{rotate:`${s.ang}deg`}], zIndex:3,
        }}/>
      ))}
      {PATH_WPS.slice(1,-1).map(([fx,fy],i)=>(
        <View key={`cap${i}`} style={{
          position:"absolute", left:fx*aw-ROAD_W/2, top:fy*ah-ROAD_W/2,
          width:ROAD_W, height:ROAD_W, borderRadius:ROAD_W/2,
          backgroundColor:"#b8945a", zIndex:3,
        }}/>
      ))}
      {/* Paving slabs */}
      {slabs.map((s,i)=>(
        <View key={`sl${i}`} style={{
          position:"absolute", left:s.cx-11, top:s.cy-(ROAD_W-14)/2,
          width:22, height:ROAD_W-14,
          backgroundColor:s.alt?"#caa870":"#a07848",
          borderWidth:1.5, borderColor:"#7a5828",
          borderRadius:3, transform:[{rotate:`${s.ang}deg`}], zIndex:4,
        }}/>
      ))}
      {/* Top highlight */}
      {segs.map((s,i)=>(
        <View key={`hi${i}`} style={{
          position:"absolute", left:s.mx-s.len/2, top:s.my-ROAD_W/2,
          width:s.len, height:3, backgroundColor:"#e8c87895",
          transform:[{rotate:`${s.ang}deg`}], zIndex:5,
        }}/>
      ))}
      {/* Teal rune stripe */}
      {segs.map((s,i)=>(
        <View key={`rune${i}`} style={{
          position:"absolute", left:s.mx-s.len/2, top:s.my-2,
          width:s.len, height:4, backgroundColor:"#22d3ee28",
          transform:[{rotate:`${s.ang}deg`}], zIndex:6,
        }}/>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   3. CENTER PLATFORM — raised stone deployment zones
════════════════════════════════════════════════════════════════════════════ */
function CenterPlatform({ aw, ah }: { aw: number; ah: number }) {
  if (aw < 20 || ah < 20) return null;
  const zones = [
    { l:0.22, t:0.15, r:0.82, b:0.39 },
    { l:0.19, t:0.56, r:0.82, b:0.79 },
  ];
  return (
    <>
      {zones.map((z, zi) => {
        const left=z.l*aw, top=z.t*ah, w=(z.r-z.l)*aw, h=(z.b-z.t)*ah;
        return (
          <View key={zi} style={{ position:"absolute", left, top, width:w, height:h, zIndex:7 }}>
            <View style={[StyleSheet.absoluteFillObject,{ borderRadius:12, backgroundColor:"#00000060", top:5, left:5 }]}/>
            <LinearGradient colors={["#7a8c78","#5e7060","#4a5a4a"]}
              start={{x:0.1,y:0}} end={{x:0.9,y:1}}
              style={[StyleSheet.absoluteFillObject,{borderRadius:12}]}/>
            <View style={[StyleSheet.absoluteFillObject,{ borderRadius:12, borderWidth:2, borderColor:"#c8a04075" }]}/>
            {/* 3-column grid lines */}
            {[1/3,2/3].map((f,i)=>(
              <View key={i} style={{ position:"absolute", left:f*w-0.5, top:6, bottom:6, width:1, backgroundColor:"#ffffff12" }}/>
            ))}
            <View style={{ position:"absolute", top:h/2-0.5, left:6, right:6, height:1, backgroundColor:"#ffffff08" }}/>
            {/* Lotus center */}
            <View style={{
              position:"absolute", left:w/2-14, top:h/2-14,
              width:28, height:28, borderRadius:14,
              borderWidth:1, borderColor:"#d4a84022", backgroundColor:"#d4a8400a",
            }}/>
          </View>
        );
      })}
      {/* Bridge between zones */}
      <View style={{
        position:"absolute", left:0.36*aw, top:0.39*ah,
        width:0.28*aw, height:0.17*ah, zIndex:6,
      }}>
        <LinearGradient colors={["#586a5690","#485848a0"]}
          start={{x:0,y:0}} end={{x:0,y:1}}
          style={[StyleSheet.absoluteFillObject,{borderRadius:4}]}/>
        <View style={[StyleSheet.absoluteFillObject,{ borderRadius:4, borderWidth:1, borderColor:"#c8a04030" }]}/>
      </View>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   4. DISEASE PORTAL — dramatic purple void gate
════════════════════════════════════════════════════════════════════════════ */
function DiseasePortal({ aw, ah }: { aw: number; ah: number }) {
  const [fx,fy] = PATH_WPS[0];
  const px=fx*aw, py=fy*ah;
  const SZ = 86;
  return (
    <View style={{
      position:"absolute",
      left:Math.min(px-SZ/2, aw-SZ-4), top:Math.max(4, py-SZ/2-22),
      alignItems:"center", zIndex:20,
    }}>
      <View style={{
        backgroundColor:"#3b0764cc", borderRadius:6,
        paddingHorizontal:7, paddingVertical:2, marginBottom:4,
        borderWidth:1, borderColor:"#a855f7",
      }}>
        <Text style={{ color:"#e9d5ff", fontSize:7, fontWeight:"800", letterSpacing:0.8 }}>
          DISEASE GATE
        </Text>
      </View>
      <View style={{ width:SZ, height:SZ, alignItems:"center", justifyContent:"center" }}>
        <View style={{
          position:"absolute", width:SZ, height:SZ, borderRadius:SZ/2,
          backgroundColor:"#7c3aed08", borderWidth:1.5, borderColor:"#7c3aed20",
        }}/>
        {[0,45,90,135,180,225,270,315].map((deg,i)=>{
          const rad=deg*Math.PI/180, r=SZ/2-6;
          const sx=SZ/2+Math.sin(rad)*r-(i%2===0?5:3.5);
          const sy=SZ/2-Math.cos(rad)*r-(i%2===0?5:3.5);
          return (
            <View key={i} style={{
              position:"absolute", left:sx, top:sy,
              width:i%2===0?10:7, height:i%2===0?10:7,
              borderRadius:2, backgroundColor:i%2===0?"#a855f7dd":"#7c3aed88",
              transform:[{rotate:"45deg"}],
            }}/>
          );
        })}
        <View style={{
          width:SZ-14, height:SZ-14, borderRadius:(SZ-14)/2,
          backgroundColor:"#0a0014", borderWidth:3, borderColor:"#7c3aed",
          alignItems:"center", justifyContent:"center", overflow:"hidden",
        }}>
          <LinearGradient colors={["#2e1065","#130929","#060011"]}
            start={{x:0.3,y:0}} end={{x:0.7,y:1}}
            style={StyleSheet.absoluteFillObject}/>
          <View style={{ position:"absolute", width:(SZ-14)*0.78, height:(SZ-14)*0.78,
            borderRadius:(SZ-14)*0.39, borderWidth:1.5, borderColor:"#7c3aed50" }}/>
          <View style={{ position:"absolute", width:(SZ-14)*0.55, height:(SZ-14)*0.55,
            borderRadius:(SZ-14)*0.275, borderWidth:1, borderColor:"#a855f740" }}/>
          <View style={{
            width:22, height:18, borderRadius:11,
            backgroundColor:"#7c3aed20", borderWidth:2, borderColor:"#c084fccc",
            alignItems:"center", justifyContent:"center",
          }}>
            <View style={{ width:9, height:9, borderRadius:5, backgroundColor:"#a855f7ee" }}/>
          </View>
        </View>
      </View>
      <View style={{ flexDirection:"row", gap:4, marginTop:2 }}>
        {[-12,0,12].map((r,i)=>(
          <View key={i} style={{ width:1.5, height:6+Math.abs(r/4), borderRadius:1,
            backgroundColor:"#7c3aed35", transform:[{rotate:`${r}deg`}] }}/>
        ))}
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   5. VITAL LANTERN — glowing lotus healing core
════════════════════════════════════════════════════════════════════════════ */
function VitalLantern({ stability, aw, ah }: { stability:number; aw:number; ah:number }) {
  const [fx,fy] = PATH_WPS[PATH_WPS.length-1];
  const px=fx*aw, py=fy*ah;
  const pct = cl(stability, 0, 100);
  const glow = pct>60 ? "#22d3ee" : pct>30 ? "#facc15" : "#ef4444";
  return (
    <View style={{
      position:"absolute",
      left:Math.max(4,px-44), top:Math.min(ah-130,py-90),
      alignItems:"center", zIndex:20,
    }}>
      <View style={{
        backgroundColor:"#0c2a2acc", borderRadius:6,
        paddingHorizontal:7, paddingVertical:2, marginBottom:3,
        borderWidth:1, borderColor:glow+"80",
      }}>
        <Text style={{ color:"#a7f3d0", fontSize:7, fontWeight:"800", letterSpacing:0.6 }}>VITAL LANTERN</Text>
      </View>
      <View style={{
        width:68, height:5, backgroundColor:"#0d202060",
        borderRadius:3, marginBottom:5, overflow:"hidden",
        borderWidth:1, borderColor:"#ffffff20",
      }}>
        <View style={{ width:`${pct}%` as any, height:"100%", backgroundColor:glow, borderRadius:3 }}/>
      </View>
      <View style={{ position:"absolute", top:28, left:2, width:84, height:84, borderRadius:42,
        backgroundColor:glow+"0a", borderWidth:1.5, borderColor:glow+"20" }}/>
      <View style={{ width:14, height:30, backgroundColor:"#1a3a2a",
        borderRadius:4, borderWidth:1.5, borderColor:glow+"40",
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:2, height:20, backgroundColor:glow+"50", borderRadius:1 }}/>
      </View>
      <View style={{
        width:62, height:62, borderRadius:14, backgroundColor:"#081a14",
        borderWidth:2.5, borderColor:glow,
        alignItems:"center", justifyContent:"center",
        overflow:"hidden", marginTop:-4,
      }}>
        <LinearGradient colors={[glow+"40","#0a1e16","#040e0a"]}
          start={{x:0.2,y:0}} end={{x:0.8,y:1}}
          style={StyleSheet.absoluteFillObject}/>
        <View style={{ position:"absolute", width:48, height:48, borderRadius:24,
          borderWidth:1.5, borderColor:glow+"50" }}/>
        <View style={{ position:"absolute", width:32, height:32, borderRadius:16,
          borderWidth:1, borderColor:glow+"70" }}/>
        <View style={{
          width:22, height:22, borderRadius:11,
          backgroundColor:glow+"30", borderWidth:2, borderColor:glow+"cc",
          alignItems:"center", justifyContent:"center",
        }}>
          <Text style={{ fontSize:11 }}>✦</Text>
        </View>
      </View>
      <View style={{
        width:72, height:12, borderRadius:6, backgroundColor:"#1a3a2a",
        borderWidth:1.5, borderColor:glow+"50", marginTop:-2,
      }}>
        <LinearGradient colors={[glow+"20","transparent"]}
          start={{x:0.5,y:0}} end={{x:0.5,y:1}}
          style={StyleSheet.absoluteFillObject}/>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   6. ENEMY SPRITES — full-body rendered disease organisms
   (Ported from ward-defense.tsx for visual quality parity)
════════════════════════════════════════════════════════════════════════════ */
type SP = { hitFlash:boolean; bobY:Animated.AnimatedInterpolation<number> };

/* BREATHLESS WISP — silver teardrop with hollow socket eyes */
function BreathlessWisp({ hitFlash, bobY }: SP) {
  const c=hitFlash?"#ffffff":"#bfdbfe"; const dark="#0f2a4a";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      <View style={{ position:"absolute", right:-10, top:14, gap:3 }}>
        {[24,16,30,12,20].map((w,i)=>(
          <View key={i} style={{ width:w, height:2, borderRadius:1,
            backgroundColor:c+(["80","50","90","38","65"][i]) }}/>
        ))}
      </View>
      <View style={{ position:"absolute", top:20, left:-20 }}>
        <View style={{ width:24, height:7, borderRadius:4, backgroundColor:"#bfdbfe30",
          borderWidth:1.5, borderColor:c+"70", transform:[{rotate:"-14deg"}] }}/>
        <View style={{ width:18, height:6, borderRadius:4, marginTop:6,
          backgroundColor:"#bfdbfe20", borderWidth:1, borderColor:c+"45",
          transform:[{rotate:"10deg"}] }}/>
      </View>
      <View style={{ width:36, height:56, borderRadius:18,
        borderTopLeftRadius:10, borderTopRightRadius:10,
        borderBottomLeftRadius:20, borderBottomRightRadius:20,
        backgroundColor:"#0f172a60", position:"absolute", top:4, left:4 }}/>
      <View style={{ width:36, height:56, borderRadius:18,
        borderTopLeftRadius:10, borderTopRightRadius:10,
        borderBottomLeftRadius:20, borderBottomRightRadius:20,
        borderWidth:2, borderColor:c, overflow:"hidden", backgroundColor:"#1e3a8a50" }}>
        <LinearGradient colors={[c+"80","#3b82f630","#1e3a8a15"]}
          start={{x:0.15,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:5, left:8, width:14, height:8,
          borderRadius:7, backgroundColor:"#ffffff30" }}/>
        <View style={{ position:"absolute", top:16, left:4, right:4,
          flexDirection:"row", justifyContent:"space-around" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:12, height:14, borderRadius:6,
              backgroundColor:"#0f172a", borderWidth:1.5, borderColor:dark,
              alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:5, height:8, borderRadius:3, backgroundColor:"#020617" }}/>
              <View style={{ position:"absolute", width:5, height:5, borderRadius:3, backgroundColor:c+"90" }}/>
              <View style={{ position:"absolute", top:2, right:1.5, width:2.5, height:2.5,
                borderRadius:1.5, backgroundColor:"#93c5fd" }}/>
            </View>
          ))}
        </View>
        <View style={{ position:"absolute", top:36, left:8, right:8, height:4,
          borderRadius:2, backgroundColor:"#0f172a", borderWidth:1, borderColor:dark }}/>
      </View>
      <View style={{ flexDirection:"row", gap:1, marginTop:-6 }}>
        {[{w:7,h:16,r:-16},{w:5,h:22,r:-5},{w:7,h:17,r:5},{w:4,h:13,r:16}].map((t,i)=>(
          <View key={i} style={{ width:t.w, height:t.h, borderRadius:999,
            backgroundColor:"#bfdbfe18", borderWidth:1, borderColor:c+"25",
            transform:[{rotate:`${t.r}deg`}] }}/>
        ))}
      </View>
    </Animated.View>
  );
}

/* WHEEZE SPRITE — angry goblin riding a cyclone vortex */
function WheezeSprite({ hitFlash, bobY }: SP) {
  const c=hitFlash?"#fff":"#34d399"; const dark="#065f46";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      <View style={{ position:"absolute", right:-8, top:20, gap:2.5 }}>
        {[20,13,26,10,18].map((w,i)=>(
          <View key={i} style={{ width:w, height:2, borderRadius:1,
            backgroundColor:c+(["65","40","80","30","55"][i]) }}/>
        ))}
      </View>
      <View style={{ position:"absolute", top:14, left:-18, width:22, height:9,
        borderRadius:5, backgroundColor:dark+"90",
        borderWidth:2, borderColor:c+"80", transform:[{rotate:"28deg"}] }}/>
      <View style={{ position:"absolute", top:12, right:-16, width:22, height:9,
        borderRadius:5, backgroundColor:dark+"90",
        borderWidth:2, borderColor:c, transform:[{rotate:"-20deg"}] }}/>
      <View style={{ width:40, height:28, borderRadius:12,
        borderTopLeftRadius:8, borderTopRightRadius:16,
        backgroundColor:"#0a0a0a70", position:"absolute", top:4, left:4 }}/>
      <View style={{ width:40, height:28, borderRadius:12,
        borderTopLeftRadius:8, borderTopRightRadius:16,
        borderWidth:2, borderColor:c, overflow:"hidden", backgroundColor:"#166534" }}>
        <LinearGradient colors={[c+"55","#1a6b4a","#065f46"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:2, left:3, right:3, height:7,
          borderRadius:4, borderBottomLeftRadius:2, borderBottomRightRadius:2,
          backgroundColor:dark }}/>
        <View style={{ position:"absolute", top:8, left:4, width:9, height:4,
          borderRadius:2, backgroundColor:dark, transform:[{rotate:"-12deg"}] }}/>
        <View style={{ position:"absolute", top:7, right:3, width:9, height:11,
          borderRadius:5, backgroundColor:dark,
          alignItems:"center", justifyContent:"center",
          borderWidth:1, borderColor:c+"60" }}>
          <View style={{ width:4, height:6, borderRadius:3, backgroundColor:c }}/>
          <View style={{ position:"absolute", top:1, right:1, width:2.5, height:2.5,
            borderRadius:1.5, backgroundColor:"#fff" }}/>
        </View>
        <View style={{ position:"absolute", bottom:1, left:4, right:4, height:5,
          borderRadius:2, borderTopLeftRadius:0, borderTopRightRadius:0,
          backgroundColor:dark, flexDirection:"row",
          justifyContent:"space-around", paddingTop:1 }}>
          {[0,1,2,3].map(i=>(
            <View key={i} style={{ width:5, height:3, borderRadius:1,
              borderBottomLeftRadius:3, borderBottomRightRadius:3,
              backgroundColor:"#ecfdf5" }}/>
          ))}
        </View>
      </View>
      <View style={{ width:42, height:34, borderRadius:21,
        borderTopLeftRadius:10, borderTopRightRadius:10,
        borderBottomLeftRadius:4, borderBottomRightRadius:4,
        borderWidth:2, borderColor:c, marginTop:-3, overflow:"hidden",
        backgroundColor:"#065f4660" }}>
        <LinearGradient colors={[c+"40","#065f4672","#064e3b20"]}
          start={{x:0.25,y:0}} end={{x:0.75,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        {[4,11,18,24].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:6, right:6, height:1.5,
            borderRadius:1, backgroundColor:c+(["50","35","28","18"][i]),
            transform:[{rotate:`${[-9,6,-7,4][i]}deg`}] }}/>
        ))}
      </View>
      <View style={{ width:8, height:10, borderRadius:4,
        borderBottomLeftRadius:999, borderBottomRightRadius:999,
        backgroundColor:dark, borderWidth:1.5, borderColor:c+"70", marginTop:-4 }}/>
      <View style={{ width:26, height:4, borderRadius:13,
        backgroundColor:"#000000aa", marginTop:2 }}/>
    </Animated.View>
  );
}

/* MUCUS SLIME — wide dome blob with reaching pseudopods and fang maw */
function MucusSlime({ hitFlash, bobY }: SP) {
  const c=hitFlash?"#fff":"#86efac"; const dark="#14532d"; const mid="#166534";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      <View style={{ position:"absolute", right:-4, top:12, gap:3 }}>
        {[{w:8,h:5},{w:5,h:9},{w:7,h:5}].map((d,i)=>(
          <View key={i} style={{ width:d.w, height:d.h, borderRadius:999, backgroundColor:c+"55" }}/>
        ))}
      </View>
      <View style={{ position:"absolute", top:8, left:-24, zIndex:4 }}>
        <View style={{ width:28, height:14, borderRadius:7,
          borderTopRightRadius:0, borderBottomRightRadius:2,
          backgroundColor:mid, borderWidth:2, borderColor:c,
          transform:[{rotate:"-6deg"}] }}/>
        <View style={{ position:"absolute", top:1, left:-12, width:14, height:14,
          borderRadius:7, backgroundColor:dark, borderWidth:2, borderColor:c,
          alignItems:"center", justifyContent:"center" }}>
          <View style={{ width:5, height:5, borderRadius:3, borderWidth:1.5, borderColor:c }}/>
        </View>
      </View>
      <View style={{ position:"absolute", top:28, left:-18, width:22, height:10,
        borderRadius:5, backgroundColor:mid, borderWidth:1.5, borderColor:c,
        transform:[{rotate:"18deg"}] }}/>
      <View style={{ width:56, height:40, borderRadius:20,
        borderTopLeftRadius:13, borderTopRightRadius:25,
        borderBottomLeftRadius:9, borderBottomRightRadius:17,
        backgroundColor:"#0a0a0a80", position:"absolute", top:4, left:4 }}/>
      <View style={{ width:56, height:40, borderRadius:20,
        borderTopLeftRadius:13, borderTopRightRadius:25,
        borderBottomLeftRadius:9, borderBottomRightRadius:17,
        borderWidth:2.5, borderColor:c, overflow:"hidden", backgroundColor:mid }}>
        <LinearGradient colors={[c+"60","#166534","#14532d"]}
          start={{x:0.15,y:0}} end={{x:0.85,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:5, left:8, width:15, height:8,
          borderRadius:8, backgroundColor:"#ffffff30" }}/>
        {[{t:5,l:33,s:7},{t:15,l:42,s:5},{t:7,l:19,s:4}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, left:b.l,
            width:b.s, height:b.s, borderRadius:b.s/2,
            backgroundColor:dark, borderWidth:1, borderColor:c+"50" }}/>
        ))}
        <View style={{ position:"absolute", top:7, left:6, flexDirection:"row", gap:9 }}>
          {[0,1].map(i=>(
            <View key={i} style={{ alignItems:"center" }}>
              <View style={{ width:13, height:8, borderRadius:4,
                borderBottomLeftRadius:1, borderBottomRightRadius:1,
                backgroundColor:dark, transform:[{rotate:`${i===0?-7:7}deg`}] }}/>
              <View style={{ width:10, height:10, borderRadius:5,
                backgroundColor:dark, marginTop:-1,
                borderWidth:1, borderColor:c+"60",
                alignItems:"center", justifyContent:"center" }}>
                <View style={{ width:4, height:4, borderRadius:2, backgroundColor:"#bbf7d0" }}/>
                <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
                  borderRadius:1, backgroundColor:"#fff" }}/>
              </View>
            </View>
          ))}
        </View>
        <View style={{ position:"absolute", bottom:3, left:6, right:4, height:10,
          borderRadius:5, borderTopLeftRadius:2, borderTopRightRadius:2,
          backgroundColor:dark, flexDirection:"row",
          justifyContent:"space-around", alignItems:"flex-start",
          paddingTop:1, paddingHorizontal:2 }}>
          {[0,1,2,3,4].map(i=>(
            <View key={i} style={{ width:4, height:i%2===0?8:5, borderRadius:1,
              borderBottomLeftRadius:4, borderBottomRightRadius:4,
              backgroundColor:c, opacity:i%2===0?1:0.7 }}/>
          ))}
        </View>
      </View>
      <View style={{ flexDirection:"row", gap:2, marginTop:-4 }}>
        {[{w:12,h:7},{w:7,h:11},{w:11,h:7},{w:6,h:5}].map((d,i)=>(
          <View key={i} style={{ width:d.w, height:d.h, borderRadius:999,
            backgroundColor:mid, borderWidth:1.5, borderColor:c+"45",
            marginTop:i%2===1?4:0 }}/>
        ))}
      </View>
      <View style={{ width:44, height:5, borderRadius:22,
        backgroundColor:"#000000bb", marginTop:-2 }}/>
    </Animated.View>
  );
}

/* HYPOXIA WRAITH — tall hooded death spirit with skeletal reaching hand */
function HypoxiaWraith({ hitFlash, bobY }: SP) {
  const c=hitFlash?"#fff":"#c4b5fd"; const cloak="#1a0040"; const deep="#0d001a";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      <View style={{ position:"absolute", bottom:14, left:-16, right:-16, height:20,
        borderRadius:12, backgroundColor:"#2e107035" }}/>
      <View style={{ position:"absolute", top:20, left:-24, zIndex:6 }}>
        <View style={{ width:13, height:11, borderRadius:5,
          backgroundColor:"#c8d0d8", borderWidth:1.5, borderColor:"#64748b" }}/>
        {[{l:0,t:-12,h:13,r:-13},{l:3,t:-15,h:16,r:-4},
          {l:7,t:-15,h:16,r:5},{l:11,t:-12,h:13,r:15}].map((f,i)=>(
          <View key={i} style={{ position:"absolute", left:f.l, top:f.t,
            width:4.5, height:f.h, borderRadius:2.5,
            backgroundColor:"#c8d0d8", borderWidth:1, borderColor:"#64748b",
            transform:[{rotate:`${f.r}deg`}] }}/>
        ))}
      </View>
      <View style={{ width:40, height:60, borderRadius:10,
        borderTopLeftRadius:4, borderTopRightRadius:20,
        borderBottomLeftRadius:8, borderBottomRightRadius:16,
        backgroundColor:"#0a0a0a80", position:"absolute", top:4, left:4 }}/>
      <View style={{ width:40, height:60, borderRadius:10,
        borderTopLeftRadius:4, borderTopRightRadius:20,
        borderBottomLeftRadius:8, borderBottomRightRadius:16,
        borderWidth:2, borderColor:c+"90",
        overflow:"hidden", backgroundColor:cloak }}>
        <LinearGradient colors={["#4c1d9565","#1a004098","#0d001a"]}
          start={{x:0.2,y:0}} end={{x:0.8,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:0, left:0, right:0, height:30,
          borderTopLeftRadius:4, borderTopRightRadius:20,
          backgroundColor:deep+"92" }}/>
        <View style={{ position:"absolute", top:12, left:7, right:7,
          flexDirection:"row", justifyContent:"space-between" }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:9, height:10, borderRadius:5,
              backgroundColor:"#6d28d9", borderWidth:1.5, borderColor:c,
              alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:4, height:4, borderRadius:2, backgroundColor:c }}/>
              <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
                borderRadius:1, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        <View style={{ position:"absolute", top:30, bottom:0, left:"47%", width:1.5,
          backgroundColor:c+"22" }}/>
      </View>
      <View style={{ flexDirection:"row", gap:1, marginTop:-12, zIndex:2 }}>
        {[{w:7,h:20,r:-14},{w:5,h:27,r:-5},{w:7,h:21,r:4},{w:5,h:16,r:15},{w:6,h:23,r:-7}].map((t,i)=>(
          <View key={i} style={{ width:t.w, height:t.h,
            borderRadius:3, borderBottomLeftRadius:999, borderBottomRightRadius:999,
            backgroundColor:cloak+"D0", borderWidth:1, borderColor:c+"22",
            transform:[{rotate:`${t.r}deg`}] }}/>
        ))}
      </View>
      <View style={{ width:32, height:5, borderRadius:16,
        backgroundColor:"#00000090", marginTop:-4 }}/>
    </Animated.View>
  );
}

/* BRONCHOSPASM DRAKE — boss dragon with spread wings and flame breath */
function BronchospasmDrake({ hitFlash, bobY }: SP) {
  const c=hitFlash?"#fff":"#fb923c"; const mid="#92330a"; const dk="#431407";
  return (
    <Animated.View style={{ alignItems:"center", transform:[{translateY:bobY}] }}>
      <View style={{ position:"absolute", top:20, left:-40, width:60, height:60,
        borderRadius:8, borderTopLeftRadius:50, borderTopRightRadius:4,
        borderWidth:2, borderColor:c+"85",
        overflow:"hidden", backgroundColor:"#7c2d1238",
        transform:[{rotate:"-10deg"}] }}>
        <LinearGradient colors={[c+"38","#7c2d1210","transparent"]}
          start={{x:0,y:0}} end={{x:1,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        {[{t:8,l:10,w:38,r:-36},{t:19,l:14,w:30,r:-23},{t:29,l:18,w:22,r:-13}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, left:b.l,
            width:b.w, height:2, borderRadius:1,
            backgroundColor:c+"65", transform:[{rotate:`${b.r}deg`}] }}/>
        ))}
      </View>
      <View style={{ position:"absolute", top:20, right:-40, width:60, height:60,
        borderRadius:8, borderTopLeftRadius:4, borderTopRightRadius:50,
        borderWidth:2, borderColor:c+"85",
        overflow:"hidden", backgroundColor:"#7c2d1238",
        transform:[{rotate:"10deg"}] }}>
        <LinearGradient colors={[c+"38","#7c2d1210","transparent"]}
          start={{x:1,y:0}} end={{x:0,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        {[{t:8,r:10,w:38,rot:36},{t:19,r:14,w:30,rot:23},{t:29,r:18,w:22,rot:13}].map((b,i)=>(
          <View key={i} style={{ position:"absolute", top:b.t, right:b.r,
            width:b.w, height:2, borderRadius:1,
            backgroundColor:c+"65", transform:[{rotate:`${b.rot}deg`}] }}/>
        ))}
      </View>
      <View style={{ flexDirection:"row", gap:22, marginBottom:-8, zIndex:7 }}>
        {[-22,22].map((rot,i)=>(
          <View key={i} style={{ width:10, height:24, borderRadius:5,
            borderTopLeftRadius:2, borderTopRightRadius:2,
            backgroundColor:dk, borderWidth:1.5, borderColor:c+"75",
            transform:[{rotate:`${rot}deg`}] }}/>
        ))}
      </View>
      <View style={{ width:66, height:60, borderRadius:18,
        borderTopLeftRadius:27, borderTopRightRadius:27,
        backgroundColor:"#0a0a0a80", position:"absolute", top:32, left:6 }}/>
      <View style={{ width:66, height:60, borderRadius:18,
        borderTopLeftRadius:27, borderTopRightRadius:27,
        borderWidth:2.5, borderColor:c, overflow:"hidden",
        backgroundColor:mid, zIndex:5 }}>
        <LinearGradient colors={[c+"45","#92330a","#431407"]}
          start={{x:0.15,y:0}} end={{x:0.85,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        {[14,24,38].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:"8%", right:"8%",
            height:1.5, backgroundColor:"#f9731430" }}/>
        ))}
        <View style={{ flexDirection:"row", gap:14, justifyContent:"center", marginTop:4 }}>
          {[0,1].map(i=>(
            <View key={i} style={{ width:15, height:14, borderRadius:8,
              backgroundColor:dk, borderWidth:2.5, borderColor:"#fbbf24",
              alignItems:"center", justifyContent:"center" }}>
              <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#fbbf24" }}/>
              <View style={{ position:"absolute", width:2.5, height:11,
                borderRadius:1.5, backgroundColor:dk }}/>
              <View style={{ position:"absolute", top:2, right:2, width:3, height:3,
                borderRadius:2, backgroundColor:"#fff" }}/>
            </View>
          ))}
        </View>
        <View style={{ width:38, height:17, borderRadius:7,
          borderTopLeftRadius:4, borderTopRightRadius:4,
          backgroundColor:dk, borderWidth:2, borderColor:c,
          marginTop:8, alignSelf:"center",
          flexDirection:"row", justifyContent:"space-around",
          alignItems:"flex-start", paddingTop:2, paddingHorizontal:3 }}>
          {[0,1,2,3,4].map(i=>(
            <View key={i} style={{ width:4, height:i%2===0?11:6, borderRadius:1.5,
              borderBottomLeftRadius:4, borderBottomRightRadius:4,
              backgroundColor:"#fde68a", opacity:i%2===0?1:0.8 }}/>
          ))}
        </View>
      </View>
      <View style={{ width:52, height:26, borderRadius:12,
        borderWidth:2, borderColor:c+"80", overflow:"hidden",
        backgroundColor:mid, marginTop:-6, zIndex:4 }}>
        <LinearGradient colors={[c+"32","#92330a","#431407"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
      </View>
      <View style={{ flexDirection:"row", gap:12, marginTop:-4, zIndex:5 }}>
        {[-7,7].map((rot,i)=>(
          <View key={i} style={{ alignItems:"center", transform:[{rotate:`${rot}deg`}] }}>
            <View style={{ width:14, height:16, borderRadius:7,
              backgroundColor:mid, borderWidth:2, borderColor:c+"80" }}/>
            <View style={{ flexDirection:"row", gap:1, marginTop:-3 }}>
              {[-10,0,10].map((cr,ci)=>(
                <View key={ci} style={{ width:5, height:8, borderRadius:999,
                  borderBottomLeftRadius:1, borderBottomRightRadius:1,
                  backgroundColor:dk, borderWidth:1, borderColor:c+"60",
                  transform:[{rotate:`${cr}deg`}] }}/>
              ))}
            </View>
          </View>
        ))}
      </View>
      {!hitFlash && (
        <View style={{ position:"absolute", left:-26, top:48, flexDirection:"column", gap:2 }}>
          {[{w:28,col:"#f97316"},{w:36,col:"#fbbf24"},{w:22,col:"#ef4444"},{w:32,col:"#fde68a"}].map((fl,i)=>(
            <View key={i} style={{ width:fl.w, height:5, borderRadius:999,
              borderTopLeftRadius:2, borderBottomLeftRadius:2,
              backgroundColor:fl.col+"72" }}/>
          ))}
        </View>
      )}
      <View style={{ width:58, height:6, borderRadius:29,
        backgroundColor:"#000000cc", marginTop:2 }}/>
    </Animated.View>
  );
}

function EnemySprite({ typeId, hitFlash, bobY }: { typeId:string; hitFlash:boolean; bobY:Animated.AnimatedInterpolation<number> }) {
  switch (typeId) {
    case "breathless_wisp":    return <BreathlessWisp    hitFlash={hitFlash} bobY={bobY}/>;
    case "wheeze_sprite":      return <WheezeSprite      hitFlash={hitFlash} bobY={bobY}/>;
    case "mucus_slime":        return <MucusSlime        hitFlash={hitFlash} bobY={bobY}/>;
    case "hypoxia_wraith":     return <HypoxiaWraith     hitFlash={hitFlash} bobY={bobY}/>;
    case "bronchospasm_drake": return <BronchospasmDrake hitFlash={hitFlash} bobY={bobY}/>;
    default: return <View style={{ width:36, height:46, borderRadius:8, backgroundColor:"#334155" }}/>;
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   7. UNIT SPRITES — full-body chibi/donghua healer characters
   (Ported from ward-defense.tsx for visual quality parity)
════════════════════════════════════════════════════════════════════════════ */

/* WARD SCOUT — Blue nurse, white coat, stethoscope, 3/4 pose */
function WardScoutSprite({ castFlash }: { castFlash:boolean }) {
  const trim=castFlash?"#2563eb":"#3b82f6";
  const coat=castFlash?"#bfdbfe":"#f0f9ff";
  const skin="#fde8c8"; const hair="#1c3557";
  return (
    <View style={{ width:52, height:68, position:"relative" }}>
      <View style={{ position:"absolute", bottom:10, left:14, width:9, height:18,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:10, left:24, width:9, height:16,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a",
        transform:[{rotate:"-8deg"}] }}/>
      <View style={{ position:"absolute", bottom:4, left:9, width:16, height:7,
        borderRadius:4, backgroundColor:coat, borderWidth:2, borderColor:trim }}/>
      <View style={{ position:"absolute", bottom:3, left:20, width:16, height:7,
        borderRadius:4, backgroundColor:coat, borderWidth:2, borderColor:trim,
        transform:[{rotate:"-5deg"}] }}/>
      <View style={{ position:"absolute", top:28, left:2, width:10, height:22,
        borderRadius:5, backgroundColor:"#d1d5db", borderWidth:1.5, borderColor:trim,
        transform:[{rotate:"-28deg"}] }}/>
      <View style={{ position:"absolute", top:29, left:8, width:38, height:36,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:6,
        backgroundColor:"#0f172a60" }}/>
      <View style={{ position:"absolute", top:26, left:5, width:38, height:36,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:6,
        borderWidth:2, borderColor:trim, overflow:"hidden", backgroundColor:coat }}>
        <LinearGradient colors={["#ffffff","#e0f0ff","#bfdbfe80"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:0, left:4, width:10, height:18,
          borderRadius:4, borderTopLeftRadius:10, backgroundColor:trim+"45" }}/>
        <View style={{ position:"absolute", top:0, right:0, bottom:0, width:7,
          borderTopRightRadius:5, borderBottomRightRadius:7, backgroundColor:trim+"30" }}/>
        {[9,17,25].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:21, width:5, height:5,
            borderRadius:3, backgroundColor:trim, borderWidth:1, borderColor:"#1d4ed8" }}/>
        ))}
        <View style={{ position:"absolute", top:20, left:0, right:0, height:3,
          backgroundColor:trim+"70" }}/>
        <View style={{ position:"absolute", bottom:5, left:5, width:11, height:9,
          borderRadius:4, borderWidth:1.5, borderColor:trim+"70" }}/>
      </View>
      <View style={{ position:"absolute", top:28, right:2, width:11, height:24,
        borderRadius:6, backgroundColor:coat, borderWidth:2, borderColor:trim,
        transform:[{rotate:"28deg"}] }}/>
      <View style={{ position:"absolute", top:50, right:-4, width:14, height:14,
        borderRadius:7, backgroundColor:"#94a3b8", borderWidth:2.5, borderColor:"#475569",
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:6, height:6, borderRadius:3, backgroundColor:"#0f172a" }}/>
        <View style={{ position:"absolute", top:1.5, right:1.5, width:3, height:3,
          borderRadius:2, backgroundColor:"#e2e8f0" }}/>
      </View>
      <View style={{ position:"absolute", top:22, left:19, width:11, height:8,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      <View style={{ position:"absolute", top:2, left:13, width:32, height:28,
        borderRadius:14, backgroundColor:"#0f172a60" }}/>
      <View style={{ position:"absolute", top:0, left:11, width:32, height:28,
        borderRadius:14, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c",
        overflow:"hidden" }}>
        <LinearGradient colors={["#fef3c7","#fde8c8","#e9a84c40"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:-10, left:-3, width:38, height:18,
          borderRadius:999, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:2, left:-6, width:9, height:20,
          borderRadius:5, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-6, right:3, width:7, height:14,
          borderRadius:4, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-5, left:7, width:22, height:10,
          borderRadius:5, borderBottomLeftRadius:0, borderBottomRightRadius:0,
          backgroundColor:"#f0f9ff", borderWidth:2, borderColor:trim }}>
          <View style={{ position:"absolute", left:6, top:2, width:9, height:2.5,
            backgroundColor:"#ef4444" }}/>
          <View style={{ position:"absolute", left:9, top:-2, width:2.5, height:7,
            backgroundColor:"#ef4444" }}/>
        </View>
        <View style={{ position:"absolute", top:16, right:2, width:8, height:5,
          borderRadius:4, backgroundColor:"#fca5a568" }}/>
        <View style={{ position:"absolute", top:10, left:4, width:5, height:7,
          borderRadius:3, backgroundColor:"#1e3a5f" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        <View style={{ position:"absolute", top:9, right:4, width:9, height:10,
          borderRadius:5, backgroundColor:"#1e3a5f" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:"#60a5fa",
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        <View style={{ position:"absolute", bottom:4, right:3, width:10, height:4,
          borderRadius:3, borderBottomWidth:2.5, borderColor:"#c2410c" }}/>
      </View>
      <View style={{ position:"absolute", bottom:0, left:8, width:34, height:4,
        borderRadius:17, backgroundColor:"#000000aa" }}/>
      {castFlash && (
        <View style={{ position:"absolute", top:-2, left:-2, right:-2, bottom:-2,
          borderRadius:14, borderWidth:2.5, borderColor:`${trim}80` }}/>
      )}
    </View>
  );
}

/* MIST CASTER — Amber alchemist mage, tall hat, casting staff */
function MistCasterSprite({ castFlash }: { castFlash:boolean }) {
  const accent=castFlash?"#fde68a":"#f59e0b";
  const robe=castFlash?"#4c1d95":"#1e1b4b";
  const skin="#fde8c8"; const hair="#0f172a";
  return (
    <View style={{ width:52, height:74, position:"relative" }}>
      <View style={{ position:"absolute", top:-12, right:7, width:6, height:86,
        borderRadius:3, backgroundColor:"#44260a", borderWidth:1.5, borderColor:accent+"80" }}>
        <View style={{ position:"absolute", top:-13, left:-10, width:26, height:26,
          borderRadius:13, borderWidth:3, borderColor:accent,
          backgroundColor:castFlash ? "#fde68a" : accent+"45",
          alignItems:"center", justifyContent:"center" }}>
          <View style={{ width:10, height:10, borderRadius:5,
            backgroundColor:castFlash ? "#fff" : accent }}/>
          <View style={{ position:"absolute", top:3, left:3, width:5, height:5,
            borderRadius:3, backgroundColor:"#ffffff50" }}/>
        </View>
        {[22,38,54].map((t,i)=>(
          <View key={i} style={{ position:"absolute", top:t, left:-2, right:-2, height:4,
            borderRadius:2, backgroundColor:accent+"65" }}/>
        ))}
      </View>
      <View style={{ position:"absolute", bottom:8, left:10, width:13, height:7,
        borderRadius:4, borderTopLeftRadius:0, backgroundColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:8, left:22, width:11, height:6,
        borderRadius:4, borderTopLeftRadius:0, backgroundColor:"#0f172a" }}/>
      <View style={{ position:"absolute", top:33, left:7, width:34, height:44,
        borderRadius:10, borderTopLeftRadius:14, borderTopRightRadius:6,
        backgroundColor:"#0f172a70" }}/>
      <View style={{ position:"absolute", top:30, left:4, width:34, height:44,
        borderRadius:10, borderTopLeftRadius:14, borderTopRightRadius:6,
        borderWidth:2, borderColor:accent+"70", overflow:"hidden", backgroundColor:robe }}>
        <LinearGradient colors={["#312e8160","#1e1b4b","#12103a"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", bottom:0, left:0, right:0, height:7,
          borderBottomLeftRadius:9, borderBottomRightRadius:9,
          backgroundColor:accent+"48" }}/>
        <View style={{ position:"absolute", top:16, left:0, right:0, height:4,
          backgroundColor:accent+"68" }}/>
        <View style={{ position:"absolute", top:2, left:10, width:9, height:9,
          borderRadius:2, backgroundColor:accent+"90",
          transform:[{rotate:"45deg"}] }}/>
      </View>
      <View style={{ position:"absolute", top:28, left:-6, width:18, height:30,
        borderRadius:9, borderTopLeftRadius:12,
        backgroundColor:robe, borderWidth:2, borderColor:accent+"70",
        transform:[{rotate:"-16deg"}] }}/>
      <View style={{ position:"absolute", top:14, left:-4, width:16, height:16,
        borderRadius:8, backgroundColor:accent+"60", borderWidth:2, borderColor:accent }}/>
      <View style={{ position:"absolute", top:30, right:16, width:13, height:26,
        borderRadius:7, borderTopRightRadius:10,
        backgroundColor:robe, borderWidth:2, borderColor:accent+"65",
        transform:[{rotate:"10deg"}] }}/>
      <View style={{ position:"absolute", top:26, left:17, width:10, height:8,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      <View style={{ position:"absolute", top:4, left:12, width:28, height:26,
        borderRadius:13, backgroundColor:"#0f172a70" }}/>
      <View style={{ position:"absolute", top:2, left:10, width:28, height:26,
        borderRadius:13, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c",
        overflow:"hidden" }}>
        <LinearGradient colors={["#fef3c7","#fde8c8","#e9a84c40"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:-8, left:-2, width:32, height:16,
          borderRadius:999, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:0, left:-5, width:8, height:22,
          borderRadius:4, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-4, right:-1, width:6, height:16,
          borderRadius:3, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-22, left:9, width:8, height:18,
          borderRadius:4, borderTopLeftRadius:1, borderTopRightRadius:1,
          backgroundColor:hair, borderWidth:1.5, borderColor:accent+"65",
          transform:[{rotate:"-5deg"}] }}/>
        <View style={{ position:"absolute", top:-8, left:0, width:28, height:9,
          borderRadius:5, borderBottomLeftRadius:2, borderBottomRightRadius:2,
          backgroundColor:hair, borderWidth:1.5, borderColor:accent+"65" }}>
          <View style={{ position:"absolute", bottom:0, left:0, right:0, height:3,
            backgroundColor:accent+"85" }}/>
          <View style={{ position:"absolute", bottom:0, left:6, width:5, height:5,
            borderRadius:1, backgroundColor:accent, transform:[{rotate:"45deg"}] }}/>
        </View>
        <View style={{ position:"absolute", top:14, right:2, width:7, height:4,
          borderRadius:4, backgroundColor:"#fca5a560" }}/>
        <View style={{ position:"absolute", top:10, left:3, width:5, height:6,
          borderRadius:3, backgroundColor:"#0f172a" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        <View style={{ position:"absolute", top:9, right:3, width:9, height:10,
          borderRadius:5, backgroundColor:"#0f172a" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:accent,
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        <View style={{ position:"absolute", bottom:4, right:3, width:9, height:4,
          borderRadius:2, borderBottomWidth:2, borderColor:"#92400e" }}/>
      </View>
      <View style={{ position:"absolute", bottom:4, left:8, width:28, height:4,
        borderRadius:14, backgroundColor:"#000000aa" }}/>
      {castFlash && (
        <View style={{ position:"absolute", top:-4, left:-4, right:-4, bottom:-4,
          borderRadius:14, borderWidth:2, borderColor:`${accent}70` }}/>
      )}
    </View>
  );
}

/* O2 HEALER — Green RT, O2 tank on back, mask outstretched */
function O2HealerSprite({ castFlash }: { castFlash:boolean }) {
  const accent=castFlash?"#6ee7b7":"#34d399";
  const vest=castFlash?"#065f46":"#064e3b";
  const skin="#fde8c8"; const hair="#1f2937";
  return (
    <View style={{ width:52, height:66, position:"relative" }}>
      <View style={{ position:"absolute", top:22, left:-5, width:14, height:34,
        borderRadius:7, backgroundColor:"#1e293b", borderWidth:2, borderColor:accent }}>
        <View style={{ position:"absolute", top:-5, left:1, width:12, height:7,
          borderRadius:3, backgroundColor:"#334155" }}/>
        <Text style={{ position:"absolute", top:8, left:0, right:0, textAlign:"center",
          color:accent, fontSize:7, fontWeight:"800" }}>O₂</Text>
        <View style={{ position:"absolute", bottom:3, left:1, right:1, height:9,
          borderRadius:5, backgroundColor:"#0f172a",
          borderWidth:1, borderColor:accent+"65",
          justifyContent:"center", alignItems:"center" }}>
          <View style={{ width:5, height:5, borderRadius:3,
            borderWidth:1.5, borderColor:accent+"80" }}/>
        </View>
      </View>
      <View style={{ position:"absolute", top:26, left:9, width:2, height:14,
        borderRadius:1, backgroundColor:accent+"70" }}/>
      <View style={{ position:"absolute", bottom:10, left:14, width:10, height:16,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a" }}/>
      <View style={{ position:"absolute", bottom:10, left:25, width:10, height:14,
        borderRadius:4, backgroundColor:"#1e293b", borderWidth:1.5, borderColor:"#0f172a",
        transform:[{rotate:"-8deg"}] }}/>
      <View style={{ position:"absolute", bottom:3, left:10, width:17, height:8,
        borderRadius:4, backgroundColor:"#374151", borderWidth:2, borderColor:"#1f2937" }}/>
      <View style={{ position:"absolute", bottom:3, left:22, width:16, height:7,
        borderRadius:4, backgroundColor:"#374151", borderWidth:2, borderColor:"#1f2937",
        transform:[{rotate:"-5deg"}] }}/>
      <View style={{ position:"absolute", top:26, left:8, width:10, height:22,
        borderRadius:5, backgroundColor:vest, borderWidth:1.5, borderColor:accent,
        transform:[{rotate:"-22deg"}] }}/>
      <View style={{ position:"absolute", top:25, left:12, width:35, height:34,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:8,
        backgroundColor:"#0f172a70" }}/>
      <View style={{ position:"absolute", top:22, left:9, width:35, height:34,
        borderRadius:8, borderTopLeftRadius:16, borderTopRightRadius:8,
        borderWidth:2, borderColor:accent, overflow:"hidden", backgroundColor:vest }}>
        <LinearGradient colors={["#10b98140","#064e3b","#022c22"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:5, left:3, width:12, height:9,
          borderRadius:3, borderWidth:1.5, borderColor:accent+"70" }}>
          <Text style={{ color:accent, fontSize:5.5, fontWeight:"800", textAlign:"center" }}>O₂</Text>
        </View>
        <View style={{ position:"absolute", bottom:5, right:3, width:9, height:8,
          borderRadius:3, borderWidth:1.5, borderColor:accent+"70" }}/>
        <View style={{ position:"absolute", top:0, bottom:0, left:"47%", width:2,
          backgroundColor:accent+"42" }}/>
        <View style={{ position:"absolute", top:3, right:3, width:10, height:5,
          borderRadius:2, backgroundColor:accent+"42", borderWidth:1, borderColor:accent }}/>
      </View>
      <View style={{ position:"absolute", top:24, right:1, width:11, height:24,
        borderRadius:6, backgroundColor:vest, borderWidth:2, borderColor:accent,
        transform:[{rotate:"32deg"}] }}/>
      <View style={{ position:"absolute", top:44, right:-8, width:18, height:13,
        borderRadius:5, backgroundColor:accent+"88", borderWidth:2.5, borderColor:accent,
        alignItems:"center", justifyContent:"center" }}>
        <View style={{ width:9, height:4, borderRadius:2,
          backgroundColor:"#065f46", borderWidth:1, borderColor:accent }}/>
        <View style={{ position:"absolute", right:-4, top:3, width:5, height:2,
          borderRadius:1, backgroundColor:accent+"70" }}/>
      </View>
      <View style={{ position:"absolute", top:30, left:12, width:2, height:18,
        borderRadius:1, backgroundColor:accent+"62", transform:[{rotate:"22deg"}] }}/>
      <View style={{ position:"absolute", top:18, left:20, width:12, height:7,
        backgroundColor:skin, borderWidth:1, borderColor:"#e9a84c" }}/>
      <View style={{ position:"absolute", top:2, left:12, width:32, height:26,
        borderRadius:13, backgroundColor:"#0f172a70" }}/>
      <View style={{ position:"absolute", top:0, left:10, width:32, height:26,
        borderRadius:13, backgroundColor:skin, borderWidth:2, borderColor:"#e9a84c",
        overflow:"hidden" }}>
        <LinearGradient colors={["#fef3c7","#fde8c8","#e9a84c40"]}
          start={{x:0.1,y:0}} end={{x:0.9,y:1}}
          style={{ position:"absolute",top:0,left:0,right:0,bottom:0 }}/>
        <View style={{ position:"absolute", top:-8, left:-2, width:36, height:16,
          borderRadius:999, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:2, left:-5, width:8, height:18,
          borderRadius:4, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-4, right:0, width:8, height:12,
          borderRadius:4, backgroundColor:hair }}/>
        <View style={{ position:"absolute", top:-2, left:0, right:0, height:8,
          borderRadius:4, borderBottomLeftRadius:0, borderBottomRightRadius:0,
          backgroundColor:vest, borderWidth:2, borderColor:accent }}>
          <View style={{ position:"absolute", right:5, top:1.5, width:11, height:5,
            borderRadius:2, borderWidth:1, borderColor:accent+"80" }}/>
        </View>
        <View style={{ position:"absolute", top:4, left:3, width:16, height:5,
          borderRadius:3, backgroundColor:accent+"70", borderWidth:1.5, borderColor:accent }}/>
        <View style={{ position:"absolute", top:15, right:2, width:8, height:4,
          borderRadius:4, backgroundColor:"#fca5a560" }}/>
        <View style={{ position:"absolute", top:10, left:4, width:6, height:7,
          borderRadius:3, backgroundColor:"#0f172a" }}>
          <View style={{ position:"absolute", top:1, right:1, width:2, height:2,
            borderRadius:1, backgroundColor:"#fff" }}/>
        </View>
        <View style={{ position:"absolute", top:9, right:4, width:9, height:10,
          borderRadius:5, backgroundColor:"#0f172a" }}>
          <View style={{ width:5, height:5, borderRadius:2.5, backgroundColor:accent,
            marginTop:2, marginLeft:2 }}/>
          <View style={{ position:"absolute", top:1.5, right:1.5, width:3.5, height:3.5,
            borderRadius:2, backgroundColor:"#fff" }}/>
        </View>
        <View style={{ position:"absolute", bottom:4, right:3, width:10, height:3,
          borderRadius:1.5, backgroundColor:"#b45309" }}/>
      </View>
      <View style={{ position:"absolute", bottom:0, left:8, width:34, height:4,
        borderRadius:17, backgroundColor:"#000000aa" }}/>
      {castFlash && (
        <View style={{ position:"absolute", top:-4, left:-4, right:-4, bottom:-4,
          borderRadius:16, borderWidth:2.5, borderColor:`${accent}70` }}/>
      )}
    </View>
  );
}

function UnitSprite({ typeId, castFlash, level=1 }: { typeId:string; castFlash:boolean; level?:number }) {
  let sprite: React.ReactElement;
  switch (typeId) {
    case "ward_scout":  sprite = <WardScoutSprite  castFlash={castFlash}/>; break;
    case "mist_caster": sprite = <MistCasterSprite castFlash={castFlash}/>; break;
    case "o2_healer":   sprite = <O2HealerSprite   castFlash={castFlash}/>; break;
    default: return <View style={{ width:22, height:28, borderRadius:6, backgroundColor:"#334155" }}/>;
  }
  return (
    <View style={{ alignItems:"center" }}>
      {level >= 3 && (
        <View style={{ position:"absolute", top:-2, flexDirection:"row", gap:3, zIndex:10 }}>
          {[0,1,2].map(i=>(
            <View key={i} style={{ width:3.5, height:i===1?6:4, borderRadius:2,
              backgroundColor:"#FFD700", opacity:0.9 }}/>
          ))}
        </View>
      )}
      {sprite}
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   8. DEPLOY PAD — raised stone tile with lotus emblem + unit above
════════════════════════════════════════════════════════════════════════════ */
interface DPProps {
  tileIdx:number; unit:any;
  selectedUnit:string|null; canAfford:boolean;
  isMergeCandidate:boolean; onPress:()=>void;
  aw:number; ah:number;
  unitColors:Record<string,string>;
  bobY:Animated.AnimatedInterpolation<number>;
}
function DeployPad({ tileIdx,unit,selectedUnit,canAfford,isMergeCandidate,onPress,aw,ah,unitColors,bobY }: DPProps) {
  const [fx,fy]=DEPLOY_TILES[tileIdx];
  const px=fx*aw, py=fy*ah;
  const isOccupied=!!unit;
  const padColor=isOccupied ? (unitColors[unit.typeId]??"#60a5fa") : canAfford ? "#22d3ee" : "#475569";
  const sz=TILE_SIZE;
  const selColor=selectedUnit ? (unitColors[selectedUnit]??"#22d3ee") : "#22d3ee";

  return (
    <Pressable
      onPress={onPress}
      style={{
        position:"absolute",
        left:px-sz/2-4, top:py-sz/2-24,
        width:sz+8, height:sz+32,
        alignItems:"center", zIndex:15,
      }}
    >
      {/* Unit sprite stands above tile */}
      {isOccupied && (
        <Animated.View style={{ marginBottom:-10, zIndex:16, transform:[{translateY:bobY}] }}>
          {(unit.level??1)>1 && (
            <View style={{
              position:"absolute", top:-3, right:-3,
              backgroundColor:(unit.level??1)>=3?"#FFD700":"#a78bfa",
              borderRadius:4, paddingHorizontal:3, paddingVertical:1, zIndex:17,
            }}>
              <Text style={{ color:"#0a0a1a", fontSize:5, fontWeight:"800" }}>
                Lv.{unit.level}
              </Text>
            </View>
          )}
          <UnitSprite typeId={unit.typeId} castFlash={(unit.castFlash??0)>0} level={unit.level??1}/>
        </Animated.View>
      )}

      {/* Merge glow ring */}
      {isMergeCandidate && (
        <View style={{
          position:"absolute", bottom:3,
          width:sz+14, height:sz+14, borderRadius:sz/2+7,
          borderWidth:2, borderColor:"#ffd70088",
          backgroundColor:"#ffd70018",
        }}/>
      )}

      {/* Tile shadow */}
      <View style={{ width:sz, height:sz, borderRadius:14,
        backgroundColor:"#00000055", position:"absolute", bottom:0, left:6 }}/>

      {/* Main tile */}
      <View style={{ width:sz, height:sz, borderRadius:14,
        overflow:"hidden", borderWidth:2.5,
        borderColor:isMergeCandidate?"#ffd700":padColor+"cc",
        backgroundColor:isOccupied?"#0d1a14":"#0a1410",
      }}>
        <LinearGradient
          colors={isOccupied
            ? [padColor+"44","#0d1a14","#0a1410"]
            : canAfford
              ? ["#22d3ee1a","#0c2a24","#0a1410"]
              : ["#47556930","#0a1010","#080e0e"]}
          start={{x:0.2,y:0}} end={{x:0.8,y:1}}
          style={StyleSheet.absoluteFillObject}
        />
        {/* Lotus petal corners */}
        {[0,90,180,270].map((deg,i)=>{
          const rad=deg*Math.PI/180, r=(sz-18)/2;
          return (
            <View key={i} style={{
              position:"absolute",
              left:sz/2+Math.sin(rad)*r-5, top:sz/2-Math.cos(rad)*r-5,
              width:10, height:10, borderRadius:5,
              backgroundColor:padColor+(isOccupied?"30":"18"),
              borderWidth:1, borderColor:padColor+(isOccupied?"60":"30"),
            }}/>
          );
        })}
        {/* 6 rune diamonds at edge (readability ring) */}
        {[0,60,120,180,240,300].map((deg,i)=>{
          const rr=(sz-10)/2;
          const bx=sz/2+Math.sin(deg*Math.PI/180)*rr-2.5;
          const by=sz/2-Math.cos(deg*Math.PI/180)*rr-2.5;
          return (
            <View key={`rd${i}`} style={{
              position:"absolute", left:bx, top:by,
              width:5, height:5, borderRadius:1,
              backgroundColor:isOccupied?padColor:canAfford?selColor:"#c8a050",
              opacity:isOccupied?0.92:canAfford?0.80:0.45,
              transform:[{rotate:"45deg"}],
            }}/>
          );
        })}
        {/* Inner ring */}
        <View style={{ position:"absolute", left:sz/2-14, top:sz/2-14,
          width:28, height:28, borderRadius:14,
          borderWidth:1.5, borderColor:padColor+(isOccupied?"80":"40") }}/>
        {/* Empty pad deploy cross */}
        {!isOccupied && canAfford && selectedUnit && (
          <>
            <View style={{ position:"absolute", top:"50%", left:"15%", right:"15%",
              height:2, backgroundColor:selColor+"60", marginTop:-1 }}/>
            <View style={{ position:"absolute", left:"50%", top:"15%", bottom:"15%",
              width:2, backgroundColor:selColor+"60", marginLeft:-1 }}/>
          </>
        )}
        {/* Zone label under occupied unit */}
        {isOccupied && (
          <Text style={{ position:"absolute", bottom:3, alignSelf:"center",
            fontSize:6, fontWeight:"800", color:padColor, letterSpacing:0.4 }}>
            {unit.typeId==="ward_scout"?"ASSESS":unit.typeId==="mist_caster"?"TREAT":"SUPP"}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   9. ENEMY ON PATH — FIXED position from pathIndex/pathProgress
════════════════════════════════════════════════════════════════════════════ */
function EnemyOnPath({ enemy, bobY, aw, ah }: { enemy:any; bobY:Animated.AnimatedInterpolation<number>; aw:number; ah:number }) {
  /* CRITICAL FIX: was reading enemy.x / enemy.y (always undefined → NaN)
     Now properly interpolates from pathIndex + pathProgress               */
  const [fx, fy] = getEnemyFrac(enemy);
  const px = fx * aw;
  const py = fy * ah;

  const hpPct = Math.max(0, Math.min(1, enemy.hp / enemy.maxHp));
  const barColor = hpPct > 0.6 ? "#22c55e" : hpPct > 0.3 ? "#facc15" : "#ef4444";
  const isFlash  = (enemy.hitFlash ?? 0) > 0;
  const isBoss   = enemy.typeId === "bronchospasm_drake";
  const scale    = isBoss ? 1.05 : 0.86;
  const BAR_W    = isBoss ? 54 : 42;

  return (
    <View style={{
      position:"absolute",
      left:px-(isBoss?32:24), top:py-(isBoss?50:40),
      alignItems:"center", zIndex:14,
    }}>
      {/* HP bar */}
      <View style={{ width:BAR_W, height:4, backgroundColor:"#00000085",
        borderRadius:2, marginBottom:2, overflow:"hidden",
        borderWidth:0.5, borderColor:"#ffffff20" }}>
        <View style={{ width:`${hpPct*100}%` as any, height:"100%",
          backgroundColor:barColor, borderRadius:2 }}/>
      </View>
      {/* Clinical cue badge */}
      <View style={{ backgroundColor:enemy.color ? enemy.color+"22" : "#334155aa",
        borderRadius:4, paddingHorizontal:4, paddingVertical:1, marginBottom:2,
        borderWidth:0.5, borderColor:enemy.color ? enemy.color+"70" : "#475569" }}>
        <Text style={{ color:enemy.color ?? "#e2e8f0", fontSize:6.5, fontWeight:"700" }}>
          {enemy.clue ?? enemy.name ?? "?"}
        </Text>
      </View>
      {/* Boss HP counter */}
      {isBoss && (
        <Text style={{ color:"#fb923c", fontSize:8, fontWeight:"700", marginBottom:1 }}>
          {enemy.hp}
        </Text>
      )}
      {/* Hit flash overlay */}
      {isFlash && (
        <View style={{ position:"absolute", top:14, left:0, right:0, bottom:4,
          backgroundColor:"#ffffff28", borderRadius:8, zIndex:15 }}/>
      )}
      {/* Slow indicator */}
      {(enemy.slowTicks ?? 0) > 0 && (
        <View style={{ position:"absolute", top:-2, right:-8,
          backgroundColor:"#A78BFA22", borderRadius:4, paddingHorizontal:3 }}>
          <Text style={{ color:"#A78BFA", fontSize:6 }}>↓</Text>
        </View>
      )}
      {/* Enemy sprite */}
      <View style={{ transform:[{scale}] }}>
        <EnemySprite typeId={enemy.typeId} hitFlash={isFlash} bobY={bobY}/>
      </View>
      {/* Ground shadow */}
      <View style={{ width:isBoss?46:30, height:5, borderRadius:isBoss?23:15,
        backgroundColor:"#000000aa", marginTop:1 }}/>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   10. PROJECTILE — FIXED position from fromFx/toFx/fromFy/toFy/progress
════════════════════════════════════════════════════════════════════════════ */
function ProjectileDot({ p, aw, ah }: { p:any; aw:number; ah:number }) {
  /* CRITICAL FIX: was reading p.x / p.y (always undefined → NaN)
     Now interpolates from fromFx, toFx, fromFy, toFy, progress         */
  const px = lp(p.fromFx, p.toFx, p.progress) * aw;
  const py = lp(p.fromFy, p.toFy, p.progress) * ah;
  const col = p.color ?? "#22d3ee";
  return (
    <View style={{
      position:"absolute",
      left:px-7, top:py-7,
      width:14, height:14, borderRadius:7,
      backgroundColor:col+"66", borderWidth:2, borderColor:col,
      alignItems:"center", justifyContent:"center", zIndex:13,
    }}>
      <View style={{ width:5, height:5, borderRadius:3, backgroundColor:"#ffffff" }}/>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   11. WAVE PAUSE OVERLAY
════════════════════════════════════════════════════════════════════════════ */
function WavePauseOverlay({ wave }: { wave:number }) {
  return (
    <View style={[StyleSheet.absoluteFillObject,{
      alignItems:"center", justifyContent:"center",
      backgroundColor:"#00000078", zIndex:30,
    }]}>
      <View style={{
        backgroundColor:"#0c1a14f0", borderRadius:16,
        padding:24, alignItems:"center",
        borderWidth:2, borderColor:"#22d3ee60", minWidth:190,
      }}>
        <Text style={{ color:"#22d3ee", fontSize:12, fontWeight:"700",
          letterSpacing:1.5, marginBottom:6 }}>
          ✦ WAVE {wave + 2} INCOMING ✦
        </Text>
        <Text style={{ color:"#a7f3d0", fontSize:10 }}>
          Deploy your healers…
        </Text>
      </View>
    </View>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   12. MAIN BOARD — exported and used by ward-defense.tsx
════════════════════════════════════════════════════════════════════════════ */
export function WardBoardV2({
  aw, ah, onLayout,
  enemies, deployedUnits, projectiles,
  stability, phase, wave,
  selectedUnit, ap, bobY,
  spawnQueueLen, mergeTileSet, onTilePress, canAfford, unitColors,
}: WardBoardV2Props) {
  return (
    <View style={{ flex:1, position:"relative", overflow:"hidden" }} onLayout={onLayout}>

      {/* 1. Background atmosphere */}
      {aw > 20 && <BoardBg aw={aw} ah={ah}/>}

      {/* 2. Center deployment platform (below path) */}
      {aw > 20 && <CenterPlatform aw={aw} ah={ah}/>}

      {/* 3. Stone path over platform edges */}
      {aw > 20 && <SanctuaryPath aw={aw} ah={ah}/>}

      {/* 4. Disease portal (enemy spawn) */}
      {aw > 20 && <DiseasePortal aw={aw} ah={ah}/>}

      {/* 5. Vital Lantern (protected objective) */}
      {aw > 20 && <VitalLantern stability={stability} aw={aw} ah={ah}/>}

      {/* 6. Deploy pads with healer sprites */}
      {aw > 20 && DEPLOY_TILES.map((_,i)=>(
        <DeployPad
          key={i} tileIdx={i}
          unit={deployedUnits.find((u:any)=>u.tileIndex===i)}
          selectedUnit={selectedUnit}
          canAfford={canAfford}
          isMergeCandidate={mergeTileSet.has(i)}
          onPress={()=>onTilePress(i)}
          aw={aw} ah={ah}
          unitColors={unitColors}
          bobY={bobY}
        />
      ))}

      {/* 7. Projectiles (FIXED positions) */}
      {projectiles.map((p:any)=>(
        <ProjectileDot key={p.uid} p={p} aw={aw} ah={ah}/>
      ))}

      {/* 8. Enemies (FIXED positions — now actually move along path) */}
      {enemies.map((e:any)=>(
        <EnemyOnPath key={e.uid} enemy={e} bobY={bobY} aw={aw} ah={ah}/>
      ))}

      {/* 9. Spawn queue warning */}
      {spawnQueueLen > 0 && (
        <View style={{
          position:"absolute", top:6, left:6,
          backgroundColor:"#7c3aedcc", borderRadius:8,
          paddingHorizontal:8, paddingVertical:3,
          borderWidth:1, borderColor:"#c084fc", zIndex:25,
        }}>
          <Text style={{ color:"#f3e8ff", fontSize:8, fontWeight:"700" }}>
            ⚡ {spawnQueueLen} enemies incoming
          </Text>
        </View>
      )}

      {/* 10. Wave pause overlay */}
      {phase === "wave_pause" && <WavePauseOverlay wave={wave}/>}
    </View>
  );
}

export default WardBoardV2;
