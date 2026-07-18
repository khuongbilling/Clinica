/**
 * HubBottomNav — clean donghua-style bottom navigation for non-tab hub screens.
 *
 * Design: bare illustrated emblem + hand-drawn outlined text label.
 * No frame, no ring, no glow — matching the celestial-RPG reference aesthetic.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { UI } from "@/src/theme/ui";
import { usePlayer } from "@/src/game/store";
import {
  checkFeatureGate,
  playerLevelFromXp,
  type CompoundGateContext,
} from "@/src/game/progression";
import {
  ShopEmblem,
  HeroesEmblem,
  ShiftEmblem,
  RealmEmblem,
  CommunityEmblem,
} from "@/src/components/ClinicaEmblems";

export type HubTabId = "shift" | "heroes" | "shop" | "realm" | "community";

interface HubBottomNavProps {
  activeTab?: HubTabId;
}

const GOLD     = "#E8C868";
const GOLD_DIM = "#C4A040";
const DIM      = "#4A5568";

// Hand-drawn stroke effect: render label text 4× offset in dark then once in color.
function OutlinedLabel({ children, color }: { children: string; color: string }) {
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
            s.label,
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
      <Text style={[s.label, { color }]} numberOfLines={1}>
        {children}
      </Text>
    </View>
  );
}

export function HubBottomNav({ activeTab = "shift" }: HubBottomNavProps) {
  const router     = useRouter();
  const insets     = useSafeAreaInsets();
  const bottomPad  = Math.max(insets.bottom, 8);
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
    label:    string;
    route:    string;
    unlocked: boolean;
    Emblem:   React.ComponentType<{ size?: number; color?: string }>;
  }

  const tabs: TabDef[] = [
    { id: "shop",      label: "SHOP",   route: "/(tabs)/shop",    unlocked: shopUnlocked,      Emblem: ShopEmblem      },
    { id: "heroes",    label: "HEROES", route: "/(tabs)/heroes",  unlocked: heroesUnlocked,    Emblem: HeroesEmblem    },
    { id: "shift",     label: "SHIFT",  route: "/(tabs)/",        unlocked: true,              Emblem: ShiftEmblem     },
    { id: "realm",     label: "REALM",  route: "/(tabs)/kingdom", unlocked: realmUnlocked,     Emblem: RealmEmblem     },
    { id: "community", label: "GUILD",  route: "/(tabs)/faction", unlocked: communityUnlocked, Emblem: CommunityEmblem },
  ];

  return (
    <View style={[s.bar, { paddingBottom: bottomPad }]}>
      <View style={s.topBorder} />
      <View style={s.row}>
        {tabs.map(({ id, label, route, unlocked, Emblem }) => {
          if (!unlocked) return null;
          const focused    = activeTab === id;
          const iconColor  = focused ? GOLD : DIM;
          const labelColor = focused ? GOLD_DIM : "#6B7A94";

          return (
            <Pressable
              key={id}
              onPress={() => router.replace(route as any)}
              style={s.tabBtn}
              accessibilityLabel={label}
            >
              <Emblem size={32} color={iconColor} />
              <OutlinedLabel color={labelColor}>{label}</OutlinedLabel>
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
    paddingTop:      6,
  },
  topBorder: {
    height:          1,
    backgroundColor: GOLD + "30",
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
    gap:             4,
    flex:            1,
    paddingVertical: 2,
  },
  label: {
    fontSize:      9,
    fontWeight:    "800",
    letterSpacing: 0.8,
    textAlign:     "center",
    textTransform: "uppercase",
  },
});
