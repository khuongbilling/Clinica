import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";
import { usePlayer } from "@/src/game/store";
import { checkFeatureGate, playerLevelFromXp, type CompoundGateContext } from "@/src/game/progression";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabH = 50 + bottomPad;

  // Guided-onboarding tab gating (Fix 10). Tabs stay hidden (href:null keeps
  // their route alive for deep links) until the player meets each feature's gate:
  //   Shop   → Level 2 (Apprentice Path)
  //   Heroes → Level 2 via hall_of_heroes gate (no additional narrative gate)
  //   Realm  → Level 5 + first Ward Shift (buildGateContext)
  //   Faction → always hidden (future chapter — href:null permanently for now)
  // Shift tab is always available.
  const { player } = usePlayer();
  const ctx: CompoundGateContext = {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted: (player?.lessons_completed?.length ?? 0) > 0,
  };
  const shopUnlocked = checkFeatureGate("shop", ctx).unlocked;
  const heroesUnlocked = checkFeatureGate("hall_of_heroes", ctx).unlocked;
  const realmUnlocked = checkFeatureGate("realm", ctx).unlocked;
  // P25 — Community Board tab visible at Lv3 (same as Shop). Active participation
  // inside the screen gates separately at Lv7 (world_event) with a rich preview
  // state below that level. href:null only while player hasn't reached Lv3 yet.
  const communityBoardUnlocked = checkFeatureGate("community_board", ctx).unlocked;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.onSurfaceTertiary,
        tabBarStyle: {
          backgroundColor: UI.sanctuaryBg,
          borderTopColor: UI.sanctuaryBorder,
          borderTopWidth: 1,
          height: tabH,
          paddingTop: 6,
          paddingBottom: bottomPad,
        },
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 1, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="shop"
        options={{
          title: "SHOP",
          href: shopUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-shop",
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="heroes"
        options={{
          title: "HEROES",
          href: heroesUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-heroes",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "SHIFT",
          tabBarButtonTestID: "tab-shift",
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kingdom"
        options={{
          title: "REALM",
          href: realmUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-kingdom",
          tabBarIcon: ({ color, size }) => <Ionicons name="business" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="faction"
        options={{
          title: "COMMUNITY",
          href: communityBoardUnlocked ? undefined : null,
          tabBarButtonTestID: "tab-faction",
          tabBarIcon: ({ color, size }) => <Ionicons name="earth" size={size} color={color} />,
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
