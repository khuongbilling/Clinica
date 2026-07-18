/**
 * HubBottomNav — Illustrated medallion-style bottom navigation bar for
 * non-tab hub screens (university, lotus-lesson, etc.).
 *
 * Mirrors the same 5 tabs as `(tabs)/_layout.tsx` with identical
 * illustrated medallion styling. Pass `activeTab` to highlight the
 * conceptually "current" tab (e.g. "shift" while inside university).
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/theme/colors";
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

const GOLD = "#E8C868";
const DIM  = "#5A6070";

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

  const shopUnlocked      = checkFeatureGate("shop",           ctx).unlocked;
  const heroesUnlocked    = checkFeatureGate("hall_of_heroes", ctx).unlocked;
  const realmUnlocked     = checkFeatureGate("realm",          ctx).unlocked;
  const communityUnlocked = checkFeatureGate("community_board",ctx).unlocked;

  interface TabDef {
    id:       HubTabId;
    label:    string;
    route:    string;
    unlocked: boolean;
    Emblem:   React.ComponentType<{ size?: number; color?: string }>;
  }

  const tabs: TabDef[] = [
    { id: "shop",      label: "SHOP",      route: "/(tabs)/shop",    unlocked: shopUnlocked,      Emblem: ShopEmblem      },
    { id: "heroes",    label: "HEROES",    route: "/(tabs)/heroes",  unlocked: heroesUnlocked,    Emblem: HeroesEmblem    },
    { id: "shift",     label: "SHIFT",     route: "/(tabs)/",        unlocked: true,              Emblem: ShiftEmblem     },
    { id: "realm",     label: "REALM",     route: "/(tabs)/kingdom", unlocked: realmUnlocked,     Emblem: RealmEmblem     },
    { id: "community", label: "GUILD",     route: "/(tabs)/faction", unlocked: communityUnlocked, Emblem: CommunityEmblem },
  ];

  return (
    <View style={[s.bar, { paddingBottom: bottomPad }]}>
      <View style={s.topBorder} />
      <View style={s.row}>
        {tabs.map(({ id, label, route, unlocked, Emblem }) => {
          if (!unlocked) return null;
          const focused    = activeTab === id;
          const iconColor  = focused ? GOLD : DIM;
          const ringColor  = focused ? GOLD : "#2E3545";
          const ringBorder = focused ? 2    : 1.5;
          const bg         = focused ? GOLD + "1A" : "#141922";

          return (
            <Pressable
              key={id}
              onPress={() => router.replace(route as any)}
              style={s.tabBtn}
              accessibilityLabel={label}
            >
              {/* Illustrated medallion frame */}
              <View style={[s.medallion, {
                borderColor:     ringColor,
                borderWidth:     ringBorder,
                backgroundColor: bg,
                shadowColor:     focused ? GOLD : "#000",
                shadowOpacity:   focused ? 0.45 : 0.15,
                shadowRadius:    focused ? 10 : 3,
                elevation:       focused ? 5 : 1,
              }]}>
                {/* Inner decorative ring */}
                <View style={[s.innerRing, {
                  borderColor: focused ? GOLD + "45" : "#ffffff0A",
                }]} />
                {/* Corner accent dots (active only) */}
                {focused && (
                  <>
                    <View style={[s.accentDot, { top: 4, left: 4 }]} />
                    <View style={[s.accentDot, { top: 4, right: 4 }]} />
                    <View style={[s.accentDot, { bottom: 4, left: 4 }]} />
                    <View style={[s.accentDot, { bottom: 4, right: 4 }]} />
                  </>
                )}
                <Emblem size={22} color={iconColor} />
              </View>
              <Text style={[s.label, { color: iconColor }]}>{label}</Text>
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
    height:          1.5,
    backgroundColor: GOLD + "30",
    marginBottom:    4,
  },
  row: {
    flexDirection:  "row",
    justifyContent: "space-around",
    alignItems:     "center",
    paddingHorizontal: 4,
  },
  tabBtn: {
    alignItems:  "center",
    gap:         4,
    flex:        1,
    paddingVertical: 2,
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
  accentDot: {
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
    textAlign:     "center",
  },
});
