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

// ── Illustrated medallion-style tab icon ──────────────────────────────────────
// Renders as: [decorative circular medallion frame + emblem] + label text.
// The active tab gets a gold border, warm glow, and corner accent dots.
// tabBarShowLabel is false so the native tab label is hidden — the label is
// baked into this icon element, matching the reference gacha-RPG style.

const GOLD = "#E8C868";
const DIM  = "#5A6070";

function mkTabIcon(
  Emblem: React.ComponentType<{ size?: number; color?: string }>,
  label:  string,
  color:  string,
  focused: boolean,
) {
  const iconColor  = focused ? GOLD : DIM;
  const ringColor  = focused ? GOLD : "#2E3545";
  const ringBorder = focused ? 2    : 1.5;
  const bg         = focused ? GOLD + "1A" : "#141922";

  return (
    <View style={icon.wrap}>
      {/* Illustrated medallion frame */}
      <View style={[icon.medallion, {
        borderColor:     ringColor,
        borderWidth:     ringBorder,
        backgroundColor: bg,
        shadowColor:     focused ? GOLD : "#000",
        shadowOpacity:   focused ? 0.45 : 0.15,
        shadowRadius:    focused ? 10 : 3,
        elevation:       focused ? 5 : 1,
      }]}>
        {/* Inner decorative ring */}
        <View style={[icon.innerRing, {
          borderColor: focused ? GOLD + "45" : "#ffffff0A",
        }]} />
        {/* Corner accent dots (active state only) */}
        {focused && (
          <>
            <View style={[icon.dot, { top: 4, left: 4 }]} />
            <View style={[icon.dot, { top: 4, right: 4 }]} />
            <View style={[icon.dot, { bottom: 4, left: 4 }]} />
            <View style={[icon.dot, { bottom: 4, right: 4 }]} />
          </>
        )}
        <Emblem size={22} color={iconColor} />
      </View>
      {/* Label — baked into the icon element, not the native tab label */}
      <Text style={[icon.label, { color: iconColor }]}>{label}</Text>
    </View>
  );
}

const icon = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap:        3,
    paddingTop: 2,
  },
  medallion: {
    width:          46,
    height:         46,
    borderRadius:   23,
    alignItems:     "center",
    justifyContent: "center",
  },
  innerRing: {
    position:     "absolute",
    width:        36,
    height:       36,
    borderRadius: 18,
    borderWidth:  1,
  },
  dot: {
    position:        "absolute",
    width:           3,
    height:          3,
    borderRadius:    1.5,
    backgroundColor: GOLD + "90",
  },
  label: {
    fontSize:      7.5,
    fontWeight:    "800",
    letterSpacing: 0.7,
  },
});

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabH = 74 + bottomPad;

  const { player } = usePlayer();
  const ctx: CompoundGateContext = {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
  const shopUnlocked       = checkFeatureGate("shop",           ctx).unlocked;
  const heroesUnlocked     = checkFeatureGate("hall_of_heroes", ctx).unlocked;
  const realmUnlocked      = checkFeatureGate("realm",          ctx).unlocked;
  const communityBoardUnlocked = checkFeatureGate("community_board", ctx).unlocked;

  return (
    <Tabs
      screenOptions={{
        headerShown:        false,
        tabBarShowLabel:    false,
        tabBarActiveTintColor:   COLORS.brand,
        tabBarInactiveTintColor: DIM,
        tabBarStyle: {
          backgroundColor: UI.sanctuaryBg,
          borderTopWidth:  1.5,
          borderTopColor:  GOLD + "30",
          height:          tabH,
          paddingTop:      4,
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
