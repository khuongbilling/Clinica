import React from "react";
import { Tabs } from "expo-router";
import { Image, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UI } from "@/src/theme/ui";
import { usePlayer } from "@/src/game/store";
import { checkFeatureGate, playerLevelFromXp, type CompoundGateContext } from "@/src/game/progression";

// ── Illustrated hand-drawn tab icons ─────────────────────────────────────────
// Each icon is an AI-generated donghua/anime illustrated PNG with transparent
// background. Active = full opacity; inactive = dimmed. No SVG, no rings.

const TAB_IMAGES = {
  shift:   require("../../assets/ui-icons/tab-shift.png"),
  heroes:  require("../../assets/ui-icons/tab-heroes.png"),
  shop:    require("../../assets/ui-icons/tab-shop.png"),
  realm:   require("../../assets/ui-icons/tab-realm.png"),
  guild:   require("../../assets/ui-icons/tab-guild.png"),
} as const;

// Hand-drawn stroke label: 4 dark offset copies + color copy on top.
// Gives the painted-text look of celestial RPG nav bars.
function StrokeLabel({ children, focused }: { children: string; focused: boolean }) {
  const color   = focused ? "#E8C050" : "#8A95A8";
  const offsets = [[-0.6,-0.6],[0.6,-0.6],[-0.6,0.6],[0.6,0.6]] as const;
  return (
    <View style={{ position: "relative" }}>
      {offsets.map(([x, y], i) => (
        <Text
          key={i}
          style={[s.label, {
            position: "absolute",
            color: "#000000BB",
            transform: [{ translateX: x }, { translateY: y }],
          }]}
          numberOfLines={1}
        >
          {children}
        </Text>
      ))}
      <Text style={[s.label, { color }]} numberOfLines={1}>{children}</Text>
    </View>
  );
}

type TabKey = keyof typeof TAB_IMAGES;

function mkTabIcon(key: TabKey, label: string, focused: boolean) {
  return (
    <View style={s.wrap}>
      <Image
        source={TAB_IMAGES[key]}
        style={[s.icon, { opacity: focused ? 1 : 0.38 }]}
        resizeMode="contain"
      />
      <StrokeLabel focused={focused}>{label}</StrokeLabel>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", gap: 3, paddingTop: 2 },
  icon: { width: 44, height: 44 },
  label: {
    fontSize:      9.5,
    fontWeight:    "900",
    letterSpacing: 0.7,
    textAlign:     "center",
    textTransform: "uppercase" as const,
  },
});

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  const insets     = useSafeAreaInsets();
  const bottomPad  = Math.max(insets.bottom, 8);

  const { player } = usePlayer();
  const ctx: CompoundGateContext = {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted:     (player?.lessons_completed?.length ?? 0) > 0,
  };
  const shopUnlocked      = checkFeatureGate("shop",            ctx).unlocked;
  const heroesUnlocked    = checkFeatureGate("hall_of_heroes",  ctx).unlocked;
  const realmUnlocked     = checkFeatureGate("realm",           ctx).unlocked;
  const communityUnlocked = checkFeatureGate("community_board", ctx).unlocked;

  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarShowLabel:         false,
        tabBarStyle: {
          backgroundColor: UI.sanctuaryBg,
          borderTopWidth:  1,
          borderTopColor:  "#E8C86830",
          height:          68 + bottomPad,
          paddingTop:      4,
          paddingBottom:   bottomPad,
        },
        tabBarItemStyle: { paddingVertical: 2 },
      }}
    >
      <Tabs.Screen
        name="shop"
        options={{
          href: shopUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-shop",
          tabBarIcon: ({ focused }) => mkTabIcon("shop", "SHOP", focused),
        }}
      />
      <Tabs.Screen
        name="heroes"
        options={{
          href: heroesUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-heroes",
          tabBarIcon: ({ focused }) => mkTabIcon("heroes", "HEROES", focused),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          tabBarButtonTestID: "tab-shift",
          tabBarIcon: ({ focused }) => mkTabIcon("shift", "SHIFT", focused),
        }}
      />
      <Tabs.Screen
        name="kingdom"
        options={{
          href: realmUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-kingdom",
          tabBarIcon: ({ focused }) => mkTabIcon("realm", "REALM", focused),
        }}
      />
      <Tabs.Screen
        name="faction"
        options={{
          href: communityUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-faction",
          tabBarIcon: ({ focused }) => mkTabIcon("guild", "GUILD", focused),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ href: null, tabBarButtonTestID: "tab-profile" }}
      />
      <Tabs.Screen
        name="codex"
        options={{ href: null, tabBarButtonTestID: "tab-codex" }}
      />
    </Tabs>
  );
}
