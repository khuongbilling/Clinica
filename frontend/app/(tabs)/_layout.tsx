import React from "react";
import { Tabs } from "expo-router";
import { Text, View, StyleSheet, Platform } from "react-native";
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

// ── Donghua tab icon ──────────────────────────────────────────────────────────
//
// Design: clean illustrated emblem (no frame, no ring, no glow) +
// hand-drawn-style donghua text below with a dark outline/shadow for
// readability — matching the League-of-Angels / celestial-RPG aesthetic
// from the reference.

const GOLD     = "#E8C868";
const GOLD_DIM = "#C4A040";
const DIM      = "#4A5568";

// Text-outline approximation: render the label 4×, slightly offset in dark,
// then the real color on top — gives the hand-drawn stroke look on all platforms.
function OutlinedLabel({
  children,
  color,
  style,
}: {
  children: string;
  color: string;
  style?: object;
}) {
  const offsets = [
    { x: -0.6, y: -0.6 },
    { x:  0.6, y: -0.6 },
    { x: -0.6, y:  0.6 },
    { x:  0.6, y:  0.6 },
  ];
  return (
    <View style={{ position: "relative" }}>
      {offsets.map(({ x, y }, i) => (
        <Text
          key={i}
          style={[
            icon.label,
            style,
            {
              position: "absolute",
              color: "#000000CC",
              transform: [{ translateX: x }, { translateY: y }],
            },
          ]}
          numberOfLines={1}
        >
          {children}
        </Text>
      ))}
      <Text style={[icon.label, style, { color }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

function mkTabIcon(
  Emblem:  React.ComponentType<{ size?: number; color?: string }>,
  label:   string,
  color:   string,
  focused: boolean,
) {
  const iconColor = focused ? GOLD : DIM;
  const labelColor = focused ? GOLD_DIM : "#6B7A94";

  return (
    <View style={icon.wrap}>
      <Emblem size={32} color={iconColor} />
      <OutlinedLabel color={labelColor}>{label}</OutlinedLabel>
    </View>
  );
}

const icon = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap:        4,
    paddingTop: 2,
  },
  label: {
    fontSize:      9,
    fontWeight:    "800",
    letterSpacing: 0.8,
    textAlign:     "center",
    textTransform: "uppercase" as const,
  },
});

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabH = 72 + bottomPad;

  const { player } = usePlayer();
  const ctx: CompoundGateContext = {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
  const shopUnlocked           = checkFeatureGate("shop",            ctx).unlocked;
  const heroesUnlocked         = checkFeatureGate("hall_of_heroes",  ctx).unlocked;
  const realmUnlocked          = checkFeatureGate("realm",           ctx).unlocked;
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
          borderTopWidth:  1,
          borderTopColor:  GOLD + "30",
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
