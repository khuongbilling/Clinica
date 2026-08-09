import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Animated, Image, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { UI } from "@/src/theme/ui";
import { usePlayer } from "@/src/game/store";
import { useTutorial } from "@/src/game/tutorialStore";
import { isObjectiveGuide } from "@/src/game/tutorials";
import { checkFeatureGate, playerLevelFromXp, buildGateContext, type CompoundGateContext } from "@/src/game/progression";
import { unseenMemoriesCount } from "@/src/game/storyScenes";
import { useNewBagCount } from "@/src/game/bagSeenStore";
import { useNewHeroCount } from "@/src/game/heroSeenStore";
import { useNewShopSectionCount } from "@/src/game/shopSeenStore";
import { SHOP_SECTIONS } from "@/src/game/shopHub";

// ── AsyncStorage key for one-time unlock animation ────────────────────────────
const SANCTUARY_SEEN_KEY = "clinica.seen_sanctuary_unlock";

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
  realm:     require("../../assets/ui-icons/tab-realm.png"),
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

// ── Sanctuary tab icon — handles locked state + one-time unlock animation ─────
//
// Animation sequence (first time the gate flips to unlocked):
//   1. Brief 350 ms pause (player can see the tab bar before it plays)
//   2. Golden padlock badge fades out (400 ms)
//   3. Greyscale icon cross-fades to full colour (600 ms, overlapping step 2)
//   4. Two jade glow pulses — scale 1→1.4→1 + opacity 0→0.7→0 (800 ms total)
//
// On subsequent visits the animation does not replay (AsyncStorage flag).
//
type SanctuaryAnimState = "loading" | "locked" | "unlocking" | "unlocked";

function SanctuaryTabIcon({ focused, locked }: { focused: boolean; locked: boolean }) {
  const [animState, setAnimState] = React.useState<SanctuaryAnimState>("loading");

  // All values drive useNativeDriver:true animations (opacity + transform only)
  const lockAnim  = React.useRef(new Animated.Value(1)).current;   // padlock badge opacity
  const greyAnim  = React.useRef(new Animated.Value(1)).current;   // greyscale icon opacity
  const colorAnim = React.useRef(new Animated.Value(0)).current;   // colour icon opacity
  const glowOpacity = React.useRef(new Animated.Value(0)).current;
  const glowScale   = React.useRef(new Animated.Value(0.85)).current;

  React.useEffect(() => {
    let cancelled = false;

    async function init() {
      if (locked) {
        // Reset to locked visual state without animation
        lockAnim.setValue(1);
        greyAnim.setValue(1);
        colorAnim.setValue(0);
        glowOpacity.setValue(0);
        glowScale.setValue(0.85);
        if (!cancelled) setAnimState("locked");
        return;
      }

      // Unlocked — check if the reveal animation has already played
      const seen = await AsyncStorage.getItem(SANCTUARY_SEEN_KEY);
      if (cancelled) return;

      if (seen) {
        // Already played: snap to final unlocked state
        lockAnim.setValue(0);
        greyAnim.setValue(0);
        colorAnim.setValue(1);
        glowOpacity.setValue(0);
        setAnimState("unlocked");
        return;
      }

      // First unlock — play the reveal animation
      setAnimState("unlocking");

      const pulse = (toScale: number, toOpacity: number, duration: number) =>
        Animated.parallel([
          Animated.timing(glowOpacity, { toValue: toOpacity, duration, useNativeDriver: true }),
          Animated.timing(glowScale,   { toValue: toScale,   duration, useNativeDriver: true }),
        ]);

      Animated.sequence([
        Animated.delay(350),
        // Fade out padlock badge
        Animated.timing(lockAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        // Cross-fade greyscale → colour
        Animated.parallel([
          Animated.timing(greyAnim,  { toValue: 0, duration: 600, useNativeDriver: true }),
          Animated.timing(colorAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
        // First jade glow pulse
        pulse(1.4, 0.75, 300),
        pulse(0.9, 0,    350),
        // Second, softer pulse
        pulse(1.2, 0.45, 280),
        pulse(1.0, 0,    350),
      ]).start(async ({ finished }) => {
        if (!finished || cancelled) return;
        await AsyncStorage.setItem(SANCTUARY_SEEN_KEY, "1");
        if (!cancelled) setAnimState("unlocked");
      });
    }

    init();
    return () => { cancelled = true; };
  }, [locked]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEffectivelyLocked = animState === "loading" || animState === "locked";

  return (
    <View style={s.wrap} pointerEvents="none">
      {/* ── Jade glow ring — only visible during unlock pulse ── */}
      <Animated.View
        style={[
          s.sanctuaryGlow,
          { opacity: glowOpacity, transform: [{ scale: glowScale }] },
        ]}
      />

      {/* ── Full-colour icon — always in layout flow (sizes the container) ── */}
      <Animated.Image
        source={TAB_IMAGES.realm}
        style={[
          s.icon,
          {
            opacity: animState === "unlocked"
              ? (focused ? 1 : 0.38)
              : colorAnim,
          },
        ]}
        resizeMode="contain"
      />

      {/* ── Greyscale overlay — absolute, fades out during unlock animation ── */}
      {animState !== "unlocked" && (
        <Animated.Image
          source={TAB_IMAGES.realm}
          style={[
            s.icon,
            s.iconAbsolute,
            {
              opacity: greyAnim,
              // CSS filter: Expo web renders it; native ignores gracefully (image dims via opacity)
              filter: "saturate(0) brightness(0.5)" as any,
            },
          ]}
          resizeMode="contain"
        />
      )}

      {/* ── Golden padlock badge (bottom-right of icon) ── */}
      {animState !== "unlocked" && (
        <Animated.View style={[s.lockBadge, { opacity: lockAnim }]}>
          <Ionicons name="lock-closed" size={10} color="#C7A15D" />
        </Animated.View>
      )}

      <StrokeLabel focused={focused && !isEffectivelyLocked}>
        SANCTUARY
      </StrokeLabel>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", gap: 0, paddingTop: 16 },
  wrapLocked: { opacity: 0.55, filter: "grayscale(1)" as any },
  icon: { width: 44, height: 44 },
  iconAbsolute: { position: "absolute" },
  badgeDot: {
    position: "absolute", top: 1, right: "26%",
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#E5484D",
    borderWidth: 1.5, borderColor: UI.sanctuaryBg,
  },
  label: {
    fontSize:      10.5,
    fontWeight:    "900",
    letterSpacing: 0.7,
    textAlign:     "center",
    textTransform: "uppercase" as const,
  },
  // Jade glow ring drawn behind the realm icon during the unlock pulse.
  // alignSelf centres it horizontally without a conflicting static transform.
  sanctuaryGlow: {
    position: "absolute",
    alignSelf: "center",
    width: 58, height: 58,
    borderRadius: 29,
    top: -7,
    backgroundColor: "rgba(130,213,186,0.35)",
    borderWidth: 1,
    borderColor: "rgba(130,213,186,0.55)",
  },
  // Golden pulse ring shown around a tab icon when an objective guide
  // requires tapping it (requiredTargetId matches the tab's target id).
  guideGlow: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E8C050",
    backgroundColor: "rgba(232,192,80,0.16)",
    paddingHorizontal: 4,
  },
  // Small badge sitting at icon bottom-right (holds the padlock icon)
  lockBadge: {
    position: "absolute",
    bottom: 16,
    right: 4,
    backgroundColor: "#07141D",
    borderRadius: 8,
    borderWidth: 0.8,
    borderColor: "#C7A15D",
    padding: 2,
  },
});

// ── Layout ────────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  const insets     = useSafeAreaInsets();
  const bottomPad  = Math.max(insets.bottom, 8);
  const router     = useRouter();

  // Objective navigation guides: when an objGuide* tutorial requires a tab tap,
  // the required tab reports the tap (advancing the guide) and every OTHER tab
  // is blocked so the player can't wander off the guided path.
  const { activeTutorialId, requiredTargetId, onTargetTap } = useTutorial();
  const guideActive = isObjectiveGuide(activeTutorialId);
  const guideTab = (tabTarget: string) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      if (!guideActive) return;
      if (requiredTargetId === tabTarget) onTargetTap(tabTarget);
      else e.preventDefault();
    },
  });

  const { player } = usePlayer();
  const ctx: CompoundGateContext = {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted:     (player?.lessons_completed?.length ?? 0) > 0,
  };
  const shopUnlocked    = checkFeatureGate("shop",           ctx).unlocked;
  const heroesUnlocked  = checkFeatureGate("hall_of_heroes", ctx).unlocked;
  const realmUnlocked   = checkFeatureGate("realm",          ctx).unlocked;

  // ── Red notification cascade ──
  // Journey: any unlocked-but-unwatched memory bubbles up to the tab icon.
  const journeyBadge = unseenMemoriesCount(player) > 0;
  // Bag: inventory items the player hasn't opened the bag to see yet.
  const bagBadge = useNewBagCount(Object.keys(player?.inventory ?? {})) > 0;
  // Heroes: newly owned heroes the player hasn't opened the Heroes screen to see.
  const heroesBadge = useNewHeroCount(player?.heroes_owned ?? []) > 0;
  // Shop: unlocked shop sections the player hasn't opened the Shop to see yet.
  // Compute the set of currently-accessible section IDs (mirrors shop.tsx classify logic).
  const shopGateCtx = player ? buildGateContext(player) : null;
  const playerLevel = player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1;
  const unlockedShopIds = shopGateCtx
    ? SHOP_SECTIONS
        .filter((s) => {
          if (s.minLevelToShow && playerLevel < s.minLevelToShow) return false;
          if (s.status === "coming_soon") return false;
          if (s.featureGate) return checkFeatureGate(s.featureGate, shopGateCtx).unlocked;
          return true;
        })
        .map((s) => s.id)
    : [];
  const shopBadge = useNewShopSectionCount(unlockedShopIds) > 0;

  return (
    <Tabs
      screenOptions={{
        headerShown:             false,
        tabBarShowLabel:         false,
        tabBarStyle: {
          backgroundColor: UI.sanctuaryBg,
          borderTopWidth:  1,
          borderTopColor:  "#E8C86830",
          height:          72 + bottomPad,
          paddingTop:      4,
          paddingBottom:   bottomPad,
        },
        tabBarItemStyle: { paddingVertical: 2, flex: 1 },
      }}
    >
      {/* ── Order: Journey · Heroes · HOME (center) · Bag · Shop.
           Sanctuary (kingdom) lives between Heroes and HOME — visible but
           locked until the Realm gate is met. ── */}

      {/* ── Tab 1: Journey (no gate — available immediately) ── */}
      <Tabs.Screen
        name="journey"
        options={{
          title: "Journey",
          tabBarAccessibilityLabel: "Journey",
          tabBarButtonTestID: "tab-journey",
          tabBarIcon: ({ focused }) => (
            <View style={requiredTargetId === "tab-journey" ? s.guideGlow : undefined}>
              {mkTabIcon("journey", "JOURNEY", focused, false, journeyBadge)}
            </View>
          ),
        }}
        listeners={guideTab("tab-journey")}
      />

      {/* ── Tab 2: Heroes ── */}
      <Tabs.Screen
        name="heroes"
        options={{
          title: "Heroes",
          tabBarAccessibilityLabel: heroesUnlocked ? "Heroes" : "Heroes — locked, unlocks later",
          tabBarButtonTestID: "tab-heroes",
          tabBarIcon: ({ focused }) => mkTabIcon("heroes", "HEROES", focused, !heroesUnlocked, heroesBadge),
        }}
        listeners={{ tabPress: (e) => { if (!heroesUnlocked || guideActive) e.preventDefault(); } }}
      />

      {/* ── Tab 3 (CENTER): Home — the sanctuary hub main screen ── */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarAccessibilityLabel: "Home",
          tabBarButtonTestID: "tab-index",
          tabBarIcon: ({ focused }) => mkTabIcon("hub", "HOME", focused),
        }}
        // Home stays tappable during guides — the hub is the recovery point
        // that reconciles stale guides against objective progress.
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
        listeners={{ tabPress: (e) => { if (guideActive) e.preventDefault(); } }}
      />

      {/* ── Tab 5: Shop ── */}
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarAccessibilityLabel: shopUnlocked ? "Shop" : "Shop — locked, unlocks later",
          tabBarButtonTestID: "tab-shop",
          tabBarIcon: ({ focused }) => mkTabIcon("shop", "SHOP", focused, !shopUnlocked, shopBadge),
        }}
        listeners={{ tabPress: (e) => { if (!shopUnlocked || guideActive) e.preventDefault(); } }}
      />

      {/* ── Tab 6: Sanctuary / Realm kingdom ──────────────────────────────────
           Visible at all times; locked until the Realm gate (first ward shift
           completed). On first unlock, SanctuaryTabIcon plays the reveal
           animation automatically. Subsequent visits show a normal active tab.
           Tapping while locked is silently swallowed. ── */}
      <Tabs.Screen
        name="kingdom"
        options={{
          title: "Sanctuary",
          tabBarAccessibilityLabel: realmUnlocked
            ? "Sanctuary"
            : "Sanctuary — locked until Realm is reached",
          tabBarButtonTestID: "tab-sanctuary",
          tabBarIcon: ({ focused }) => (
            <SanctuaryTabIcon focused={focused} locked={!realmUnlocked} />
          ),
        }}
        listeners={{ tabPress: (e) => { if (!realmUnlocked || guideActive) e.preventDefault(); } }}
      />

      {/* ── Hidden routes (route alive, not shown in bar) ── */}
      <Tabs.Screen
        name="study"
        options={{ href: null, tabBarButtonTestID: "tab-study" }}
        listeners={{ tabPress: (e) => { e.preventDefault(); router.replace("/(tabs)/journey"); } }}
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
