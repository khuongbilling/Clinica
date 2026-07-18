import React from "react";
import { Tabs } from "expo-router";
import { Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";
import { usePlayer } from "@/src/game/store";
import { checkFeatureGate, playerLevelFromXp, type CompoundGateContext } from "@/src/game/progression";
import {
  ShopEmblem,
  HeroesEmblem,
  ShiftEmblem,
  RealmEmblem,
  CommunityEmblem,
} from "@/src/components/ClinicaEmblems";

// ── Illustrated carved medallion tab icon ─────────────────────────────────────
//
// Design: 2.5D Genshin-quality carved gold coin medallion.
//   · 60px main frame ring (gold border, warm dark fill)
//   · Inner bevel ring (46px, 1px accent gold)
//   · Inner warm center disc (36px, subtle fill)
//   · N/S/E/W cardinal knob marks — small pill shapes at compass points
//   · Active: outer ambient glow bloom, brighter rings, stronger fill
//   · Wrapper: 70×70 to accommodate cardinal marks outside the frame
//
// tabBarShowLabel is false so the native tab label is hidden — the label is
// baked into this icon element.

const GOLD    = "#E8C868";
const GOLD_DIM = "#C8A840";
const DIM     = "#4A5568";

const FRAME  = 60;   // main medallion diameter
const WRAP   = 70;   // wrapper including cardinal marks clearance
const INNER1 = 46;   // first inner bevel ring
const INNER2 = 36;   // warm center disc

function mkTabIcon(
  Emblem:  React.ComponentType<{ size?: number; color?: string }>,
  label:   string,
  color:   string,
  focused: boolean,
) {
  const iconColor   = focused ? GOLD : DIM;
  const frameColor  = focused ? GOLD : "#2A3245";
  const frame2Color = focused ? GOLD + "60" : GOLD + "1A";
  const centerFill  = focused ? "#1E160A" : "#0D1018";
  const innerFill   = focused ? GOLD + "18" : "#FFFFFF05";
  const cardinalCol = focused ? GOLD : GOLD + "38";

  // Cardinal mark positions (absolute in WRAP container):
  //  FRAME (60px) is centered in WRAP (70px) → 5px inset each side
  //  Mark sits at the edge of the frame, centered on that edge
  const markN  = { top: 2,            left:  (WRAP - 10) / 2 } as const; // horizontal pill
  const markS  = { bottom: 2,         left:  (WRAP - 10) / 2 } as const;
  const markE  = { right: 2,          top:   (WRAP - 10) / 2 } as const; // vertical pill
  const markW  = { left:  2,          top:   (WRAP - 10) / 2 } as const;

  return (
    <View style={icon.wrap}>
      {/* 70×70 wrapper holds medallion + cardinal marks */}
      <View style={{ width: WRAP, height: WRAP, alignItems: "center", justifyContent: "center" }}>

        {/* Outer ambient glow bloom — active only */}
        {focused && (
          <View style={{
            position:        "absolute",
            width:           WRAP + 24,
            height:          WRAP + 24,
            borderRadius:    (WRAP + 24) / 2,
            backgroundColor: GOLD + "16",
            left:            -12,
            top:             -12,
            pointerEvents:   "none",
          } as any} />
        )}
        {focused && (
          <View style={{
            position:        "absolute",
            width:           WRAP + 6,
            height:          WRAP + 6,
            borderRadius:    (WRAP + 6) / 2,
            backgroundColor: GOLD + "10",
            left:            -3,
            top:             -3,
            pointerEvents:   "none",
          } as any} />
        )}

        {/* Cardinal knob marks — N / S (horizontal pills) */}
        <View style={[icon.cardinalH, markN,  { backgroundColor: cardinalCol }]} />
        <View style={[icon.cardinalH, markS,  { backgroundColor: cardinalCol }]} />
        {/* Cardinal knob marks — E / W (vertical pills) */}
        <View style={[icon.cardinalV, markE,  { backgroundColor: cardinalCol }]} />
        <View style={[icon.cardinalV, markW,  { backgroundColor: cardinalCol }]} />

        {/* Main carved medallion frame */}
        <View style={{
          width:           FRAME,
          height:          FRAME,
          borderRadius:    FRAME / 2,
          borderWidth:     2.5,
          borderColor:     frameColor,
          backgroundColor: centerFill,
          alignItems:      "center",
          justifyContent:  "center",
        }}>
          {/* Inner bevel ring 1 */}
          <View style={{
            position:     "absolute",
            width:        INNER1,
            height:       INNER1,
            borderRadius: INNER1 / 2,
            borderWidth:  1,
            borderColor:  frame2Color,
            pointerEvents:"none",
          } as any} />
          {/* Inner warm center disc */}
          <View style={{
            position:        "absolute",
            width:           INNER2,
            height:          INNER2,
            borderRadius:    INNER2 / 2,
            backgroundColor: innerFill,
            pointerEvents:   "none",
          } as any} />
          {/* Emblem */}
          <Emblem size={26} color={iconColor} />
        </View>
      </View>

      {/* Label — baked into the icon element */}
      <Text style={[icon.label, { color: focused ? GOLD_DIM : DIM }]}>{label}</Text>
    </View>
  );
}

const icon = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap:        2,
    paddingTop: 2,
  },
  cardinalH: {
    position:     "absolute",
    width:        10,
    height:       5,
    borderRadius: 2.5,
  },
  cardinalV: {
    position:     "absolute",
    width:        5,
    height:       10,
    borderRadius: 2.5,
  },
  label: {
    fontSize:      8,
    fontWeight:    "800",
    letterSpacing: 0.9,
    textTransform: "uppercase" as const,
  },
});

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabH = 84 + bottomPad;

  const { player } = usePlayer();
  const ctx: CompoundGateContext = {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
  const shopUnlocked           = checkFeatureGate("shop",           ctx).unlocked;
  const heroesUnlocked         = checkFeatureGate("hall_of_heroes", ctx).unlocked;
  const realmUnlocked          = checkFeatureGate("realm",          ctx).unlocked;
  const communityBoardUnlocked = checkFeatureGate("community_board", ctx).unlocked;

  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarShowLabel:         false,
        tabBarActiveTintColor:   COLORS.brand,
        tabBarInactiveTintColor: DIM,
        tabBarStyle: {
          backgroundColor: UI.sanctuaryBg,
          borderTopWidth:  1.5,
          borderTopColor:  GOLD + "35",
          height:          tabH,
          paddingTop:      6,
          paddingBottom:   bottomPad,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="shop"
        options={{
          href: shopUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-shop",
          tabBarIcon: ({ color, focused }) =>
            mkTabIcon(ShopEmblem, "SHOP", color, focused),
        }}
      />
      <Tabs.Screen
        name="heroes"
        options={{
          href: heroesUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-heroes",
          tabBarIcon: ({ color, focused }) =>
            mkTabIcon(HeroesEmblem, "HEROES", color, focused),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarButtonTestID: "tab-shift",
          tabBarIcon: ({ color, focused }) =>
            mkTabIcon(ShiftEmblem, "SHIFT", color, focused),
        }}
      />
      <Tabs.Screen
        name="kingdom"
        options={{
          href: realmUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-kingdom",
          tabBarIcon: ({ color, focused }) =>
            mkTabIcon(RealmEmblem, "REALM", color, focused),
        }}
      />
      <Tabs.Screen
        name="faction"
        options={{
          href: communityBoardUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-faction",
          tabBarIcon: ({ color, focused }) =>
            mkTabIcon(CommunityEmblem, "GUILD", color, focused),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          tabBarButtonTestID: "tab-profile",
        }}
      />
      <Tabs.Screen
        name="codex"
        options={{
          href: null,
          tabBarButtonTestID: "tab-codex",
        }}
      />
    </Tabs>
  );
}
