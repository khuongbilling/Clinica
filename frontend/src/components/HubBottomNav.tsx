/**
 * HubBottomNav — 2.5D Genshin-quality carved medallion bottom navigation bar
 * for non-tab hub screens (university, lotus-lesson, etc.).
 *
 * Mirrors the same 5 tabs as `(tabs)/_layout.tsx` with identical
 * carved medallion styling:
 *   · 60px main frame ring (gold border, warm dark fill)
 *   · Inner bevel ring + warm center disc
 *   · Cardinal N/S/E/W knob marks
 *   · Active: ambient glow bloom, brighter accents
 *
 * Pass `activeTab` to highlight the conceptually "current" tab.
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
const GOLD_DIM = "#C8A840";
const DIM      = "#4A5568";

const FRAME  = 60;
const WRAP   = 70;
const INNER1 = 46;
const INNER2 = 36;

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
          const focused     = activeTab === id;
          const iconColor   = focused ? GOLD : DIM;
          const frameColor  = focused ? GOLD : "#2A3245";
          const frame2Color = focused ? GOLD + "60" : GOLD + "1A";
          const centerFill  = focused ? "#1E160A" : "#0D1018";
          const innerFill   = focused ? GOLD + "18" : "#FFFFFF05";
          const cardinalCol = focused ? GOLD : GOLD + "38";

          const markN = { top: 2,           left:  (WRAP - 10) / 2 } as const;
          const markS = { bottom: 2,        left:  (WRAP - 10) / 2 } as const;
          const markE = { right: 2,         top:   (WRAP - 10) / 2 } as const;
          const markW = { left:  2,         top:   (WRAP - 10) / 2 } as const;

          return (
            <Pressable
              key={id}
              onPress={() => router.replace(route as any)}
              style={s.tabBtn}
              accessibilityLabel={label}
            >
              <View style={{ width: WRAP, height: WRAP, alignItems: "center", justifyContent: "center" }}>
                {/* Outer ambient glow bloom (active only) */}
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

                {/* Cardinal knob marks — N/S (horizontal), E/W (vertical) */}
                <View style={[s.cardinalH, markN, { backgroundColor: cardinalCol }]} />
                <View style={[s.cardinalH, markS, { backgroundColor: cardinalCol }]} />
                <View style={[s.cardinalV, markE, { backgroundColor: cardinalCol }]} />
                <View style={[s.cardinalV, markW, { backgroundColor: cardinalCol }]} />

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
                  {/* Inner bevel ring */}
                  <View style={{
                    position:     "absolute",
                    width:        INNER1,
                    height:       INNER1,
                    borderRadius: INNER1 / 2,
                    borderWidth:  1,
                    borderColor:  frame2Color,
                    pointerEvents:"none",
                  } as any} />
                  {/* Warm center disc */}
                  <View style={{
                    position:        "absolute",
                    width:           INNER2,
                    height:          INNER2,
                    borderRadius:    INNER2 / 2,
                    backgroundColor: innerFill,
                    pointerEvents:   "none",
                  } as any} />
                  <Emblem size={26} color={iconColor} />
                </View>
              </View>

              <Text style={[s.label, { color: focused ? GOLD_DIM : DIM }]}>{label}</Text>
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
    backgroundColor: GOLD + "35",
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
    gap:             2,
    flex:            1,
    paddingVertical: 2,
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
    textAlign:     "center",
    textTransform: "uppercase",
  },
});
