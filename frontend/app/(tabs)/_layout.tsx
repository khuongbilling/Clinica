import React from "react";
import { Tabs } from "expo-router";
import { Image, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UI } from "@/src/theme/ui";
import { usePlayer } from "@/src/game/store";
import { checkFeatureGate, playerLevelFromXp, type CompoundGateContext } from "@/src/game/progression";
import { unseenMemoriesCount } from "@/src/game/storyScenes";
import { useNewBagCount } from "@/src/game/bagSeenStore";

// ── Illustrated hand-drawn tab icons ─────────────────────────────────────────
// Each icon is an AI-generated donghua/anime illustrated PNG with transparent
// background. Active = full opacity; inactive = dimmed. No SVG, no rings.
//
const TAB_IMAGES = {
  hub:       require("../../assets/ui-icons/tab-hub-3d.png"),
  // Study reuses the painted book stack (formerly the Inventory icon) — a
  // better semantic fit; Inventory got a new 3D satchel icon instead.
  study:     require("../../assets/ui-icons/tab-inventory.png"),
  journey:   require("../../assets/ui-icons/tab-journey-3d.png"),
  heroes:    require("../../assets/ui-icons/tab-heroes-3d.png"),
  sanctuary: require("../../assets/ui-icons/tab-sanctuary-3d.png"),
  inventory: require("../../assets/ui-icons/tab-inventory-3d.png"),
  shop:      require("../../assets/ui-icons/tab-shop-3d.png"),
  profile:   require("../../assets/ui-icons/tab-profile.png"),
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

function mkTabIcon(key: TabKey, label: string, focused: boolean, locked = false, badge = false) {
  return (
    <View style={[s.wrap, locked && s.wrapLocked]}>
      <Image
        source={TAB_IMAGES[key]}
        style={[s.icon, { opacity: locked ? 0.5 : focused ? 1 : 0.38 }]}
        resizeMode="contain"
      />
      {/* Red "something new" dot — cascades down from unseen content */}
      {badge && !locked && <View style={s.badgeDot} />}
      <StrokeLabel focused={focused && !locked}>{label}</StrokeLabel>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", gap: 0, paddingTop: 2 },
  wrapLocked: { opacity: 0.55, filter: "grayscale(1)" as any },
  icon: { width: 38, height: 38 },
  badgeDot: {
    position: "absolute", top: 1, right: "26%",
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#E5484D",
    borderWidth: 1.5, borderColor: UI.sanctuaryBg,
  },
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
  const shopUnlocked   = checkFeatureGate("shop",           ctx).unlocked;
  const heroesUnlocked = checkFeatureGate("hall_of_heroes", ctx).unlocked;

  // ── Red notification cascade ──
  // Journey: any unlocked-but-unwatched memory bubbles up to the tab icon.
  const journeyBadge = unseenMemoriesCount(player) > 0;
  // Bag: inventory items the player hasn't opened the bag to see yet.
  const bagBadge = useNewBagCount(Object.keys(player?.inventory ?? {})) > 0;

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
      {/* ── Order: Journey · Heroes · HOME (center) · Bag · Shop.
           Study and Realm moved to hub shortcut icons; their routes stay
           alive as hidden tabs below. ── */}

      {/* ── Tab 1: Journey (no gate — available immediately) ── */}
      <Tabs.Screen
        name="journey"
        options={{
          title: "Journey",
          tabBarAccessibilityLabel: "Journey",
          tabBarButtonTestID: "tab-journey",
          tabBarIcon: ({ focused }) => mkTabIcon("journey", "JOURNEY", focused, false, journeyBadge),
        }}
      />

      {/* ── Tab 3: Heroes ── */}
      <Tabs.Screen
        name="heroes"
        options={{
          title: "Heroes",
          tabBarAccessibilityLabel: heroesUnlocked ? "Heroes" : "Heroes — locked, unlocks later",
          tabBarButtonTestID: "tab-heroes",
          tabBarIcon: ({ focused }) => mkTabIcon("heroes", "HEROES", focused, !heroesUnlocked),
        }}
        listeners={{ tabPress: (e) => { if (!heroesUnlocked) e.preventDefault(); } }}
      />

      {/* ── Tab 4 (CENTER): Home — the sanctuary hub main screen ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home",
          tabBarButtonTestID: "tab-index",
          tabBarIcon: ({ focused }) => mkTabIcon("hub", "HOME", focused),
        }}
      />

      {/* ── Tab 4: Bag (Inventory — short label to save bar space) ── */}
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Bag",
          tabBarAccessibilityLabel: "Bag — your inventory",
          tabBarButtonTestID: "tab-inventory",
          tabBarIcon: ({ focused }) => mkTabIcon("inventory", "BAG", focused, false, bagBadge),
        }}
      />

      {/* ── Tab 7: Shop ── */}
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarAccessibilityLabel: shopUnlocked ? "Shop" : "Shop — locked, unlocks later",
          tabBarButtonTestID: "tab-shop",
          tabBarIcon: ({ focused }) => mkTabIcon("shop", "SHOP", focused, !shopUnlocked),
        }}
        listeners={{ tabPress: (e) => { if (!shopUnlocked) e.preventDefault(); } }}
      />

      {/* ── Hidden routes (route alive, not shown in bar) ── */}
      <Tabs.Screen
        name="study"
        options={{ href: null, tabBarButtonTestID: "tab-study" }}
      />
      <Tabs.Screen
        name="kingdom"
        options={{ href: null, tabBarButtonTestID: "tab-sanctuary" }}
      />
      <Tabs.Screen
        name="faction"
        options={{ href: null, tabBarButtonTestID: "tab-faction" }}
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
