/**
 * HubBottomNav — illustrated hand-drawn bottom navigation for non-tab screens.
 *
 * Icons: AI-generated donghua/anime PNGs (tab-shift/heroes/shop/realm/guild).
 * Active = full opacity, inactive = dimmed (38%). No SVG, no rings, no glow.
 * StrokeLabel gives the painted-text look of celestial RPG nav bars.
 */
import React from "react";
import { type AppRoute } from "@/src/game/routes";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UI } from "@/src/theme/ui";
import { usePlayer } from "@/src/game/store";
import {
  checkFeatureGate,
  playerLevelFromXp,
  type CompoundGateContext,
} from "@/src/game/progression";

export type HubTabId = "shift" | "heroes" | "shop" | "realm" | "community";

interface HubBottomNavProps {
  activeTab?: HubTabId;
}

const TAB_IMAGES = {
  shift:   require("../../assets/ui-icons/tab-shift.png"),
  heroes:  require("../../assets/ui-icons/tab-heroes.png"),
  shop:    require("../../assets/ui-icons/tab-shop.png"),
  realm:   require("../../assets/ui-icons/tab-realm.png"),
  guild:   require("../../assets/ui-icons/tab-guild.png"),
} as const;

function StrokeLabel({ children, focused }: { children: string; focused: boolean }) {
  const color   = focused ? "#E8C050" : "#8A95A8";
  const offsets = [[-0.6,-0.6],[0.6,-0.6],[-0.6,0.6],[0.6,0.6]] as const;
  return (
    <View style={{ position: "relative" }}>
      {offsets.map(([x, y], i) => (
        <Text
          key={i}
          style={[s.label, {
            position:  "absolute",
            color:     "#000000BB",
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

export function HubBottomNav({ activeTab = "shift" }: HubBottomNavProps) {
  const router    = useRouter();
  const insets    = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const { player } = usePlayer();

  const ctx: CompoundGateContext = {
    level:              player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted:     (player?.lessons_completed?.length ?? 0) > 0,
  };

  const shopUnlocked      = checkFeatureGate("shop",            ctx).unlocked;
  const heroesUnlocked    = checkFeatureGate("hall_of_heroes",  ctx).unlocked;
  const realmUnlocked     = checkFeatureGate("realm",           ctx).unlocked;
  const communityUnlocked = checkFeatureGate("community_board", ctx).unlocked;

  interface TabDef {
    id:       HubTabId;
    imgKey:   keyof typeof TAB_IMAGES;
    label:    string;
    route:    string;
    unlocked: boolean;
  }

  const tabs: TabDef[] = [
    { id: "shop",      imgKey: "shop",   label: "SHOP",   route: "/(tabs)/shop",    unlocked: shopUnlocked      },
    { id: "heroes",    imgKey: "heroes", label: "HEROES", route: "/(tabs)/heroes",  unlocked: heroesUnlocked    },
    { id: "shift",     imgKey: "shift",  label: "SHIFT",  route: "/(tabs)/",        unlocked: true              },
    { id: "realm",     imgKey: "realm",  label: "REALM",  route: "/(tabs)/kingdom", unlocked: realmUnlocked     },
    { id: "community", imgKey: "guild",  label: "GUILD",  route: "/(tabs)/faction", unlocked: communityUnlocked },
  ];

  return (
    <View style={[s.bar, { paddingBottom: bottomPad }]}>
      <View style={s.topBorder} />
      <View style={s.row}>
        {tabs.map(({ id, imgKey, label, route, unlocked }) => {
          if (!unlocked) return null;
          const focused = activeTab === id;
          return (
            <Pressable
              key={id}
              onPress={() => router.replace(route as AppRoute)}
              style={s.tabBtn}
              accessibilityLabel={label}
            >
              <Image
                source={TAB_IMAGES[imgKey]}
                style={[s.icon, { opacity: focused ? 1 : 0.38 }]}
                resizeMode="contain"
              />
              <StrokeLabel focused={focused}>{label}</StrokeLabel>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    backgroundColor: UI.sanctuaryBg,
    paddingTop:      4,
  },
  topBorder: {
    height:          1,
    backgroundColor: "#E8C86830",
    marginBottom:    4,
  },
  row: {
    flexDirection:     "row",
    justifyContent:    "space-around",
    alignItems:        "center",
    paddingHorizontal: 4,
  },
  tabBtn: {
    alignItems:      "center",
    gap:             3,
    flex:            1,
    paddingVertical: 2,
  },
  icon:  { width: 44, height: 44 },
  label: {
    fontSize:      9.5,
    fontWeight:    "900",
    letterSpacing: 0.7,
    textAlign:     "center",
    textTransform: "uppercase",
  },
});
