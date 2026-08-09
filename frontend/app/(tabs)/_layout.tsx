import React from "react";
import { Tabs, useRouter } from "expo-router";
import { Animated, Image, Text, View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { UI } from "@/src/theme/ui";
import { usePlayer } from "@/src/game/store";
import { checkFeatureGate, playerLevelFromXp, buildGateContext, type CompoundGateContext } from "@/src/game/progression";
import { unseenMemoriesCount } from "@/src/game/storyScenes";
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
  // ── Five painterly nav icons (JRPG style, transparent bg) ──────────────
  navJourney:   require("../../assets/ui-icons/nav-journey.png"),
  navHeroes:    require("../../assets/ui-icons/nav-heroes.png"),
  navSanctuary: require("../../assets/ui-icons/nav-sanctuary.png"),
  navRecruit:   require("../../assets/ui-icons/nav-recruit.png"),
  navShop:      require("../../assets/ui-icons/nav-shop.png"),
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
      <View style={{ position: "relative" }}>
        <Image
          source={TAB_IMAGES[key]}
          style={[s.icon, { opacity: locked ? 0.45 : focused ? 1 : 0.38 }]}
          resizeMode="contain"
        />
        {/* Golden padlock badge — bottom-right corner, matches mockup LockedTabItem */}
        {locked && (
          <View style={s.padlockBadge}>
            <Ionicons name="lock-closed" size={7} color="#C7A15D" />
          </View>
        )}
        {/* Red "something new" dot — cascades down from unseen content */}
        {badge && !locked && <View style={s.badgeDot} />}
      </View>
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
  wrap: { alignItems: "center", gap: 0, paddingTop: 2 },
  wrapLocked: { opacity: 0.55, filter: "grayscale(1)" as any },
  icon: { width: 44, height: 44 },
  iconAbsolute: { position: "absolute" },
  badgeDot: {
    position: "absolute", top: 1, right: "26%",
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: "#E5484D",
    borderWidth: 1.5, borderColor: UI.sanctuaryBg,
  },
  // Padlock badge pinned to the bottom-right corner of the icon — mirrors mockup LockedTabItem
  padlockBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#07141D",
    borderWidth: 0.8,
    borderColor: "#C7A15D",
    alignItems: "center",
    justifyContent: "center",
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

  const { player } = usePlayer();
  const ctx: CompoundGateContext = {
    level: player ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level) : 1,
    firstWardShiftDone: (player?.runs_completed ?? 0) > 0,
    lessonsStarted:     (player?.lessons_completed?.length ?? 0) > 0,
  };
  const shopUnlocked   = checkFeatureGate("shop",           ctx).unlocked;
  const heroesUnlocked = checkFeatureGate("hall_of_heroes", ctx).unlocked;
  const realmUnlocked  = checkFeatureGate("realm",          ctx).unlocked;

  // ── Red notification cascade ──
  // Journey: any unlocked-but-unwatched memory bubbles up to the tab icon.
  const journeyBadge = unseenMemoriesCount(player) > 0;
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
      {/* ── Order: Journey · Heroes · SANCTUARY (center) · RECRUIT · Shop.
           Painterly JRPG nav icons (nav-*.png) used for Journey/Heroes/Recruit/Shop.
           Sanctuary (kingdom) uses SanctuaryTabIcon for the one-time unlock animation.
           Sanctuary is locked (greyscale + padlock) until the Realm gate is reached.
           Recruit replaces the Inventory/Bag tab and deep-links to /summon.
           index (home hub) stays alive as a hidden route, reachable programmatically. ── */}

      {/* ── Tab 1: Journey (no gate — available immediately) ── */}
      <Tabs.Screen
        name="journey"
        options={{
          title: "Journey",
          tabBarAccessibilityLabel: "Journey",
          tabBarButtonTestID: "tab-journey",
          tabBarIcon: ({ focused }) => mkTabIcon("navJourney", "JOURNEY", focused, false, journeyBadge),
        }}
      />

      {/* ── Tab 2: Heroes ── */}
      <Tabs.Screen
        name="heroes"
        options={{
          title: "Heroes",
          tabBarAccessibilityLabel: heroesUnlocked ? "Heroes" : "Heroes — locked, unlocks later",
          tabBarButtonTestID: "tab-heroes",
          tabBarIcon: ({ focused }) => mkTabIcon("navHeroes", "HEROES", focused, !heroesUnlocked, heroesBadge),
        }}
        listeners={{ tabPress: (e) => { if (!heroesUnlocked) e.preventDefault(); } }}
      />

      {/* ── Tab 3 (CENTER): Sanctuary / Realm ────────────────────────────────────
           Locked (greyscale + padlock) until the Realm gate is reached.
           On first unlock SanctuaryTabIcon plays the jade-glow reveal animation;
           subsequent visits skip it (AsyncStorage flag). Tapping while locked is
           silently swallowed. ── */}
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
        listeners={{ tabPress: (e) => { if (!realmUnlocked) e.preventDefault(); } }}
      />

      {/* ── Tab 4: Recruit — replaces Inventory/Bag; tapping navigates to /summon ── */}
      <Tabs.Screen
        name="inventory"
        options={{
          title: "Recruit",
          tabBarAccessibilityLabel: "Recruit heroes",
          tabBarButtonTestID: "tab-recruit",
          tabBarIcon: ({ focused }) => mkTabIcon("navRecruit", "RECRUIT", focused),
        }}
        listeners={{ tabPress: (e) => { e.preventDefault(); router.push("/summon"); } }}
      />

      {/* ── Tab 5: Shop ── */}
      <Tabs.Screen
        name="shop"
        options={{
          title: "Shop",
          tabBarAccessibilityLabel: shopUnlocked ? "Shop" : "Shop — locked, unlocks later",
          tabBarButtonTestID: "tab-shop",
          tabBarIcon: ({ focused }) => mkTabIcon("navShop", "SHOP", focused, !shopUnlocked, shopBadge),
        }}
        listeners={{ tabPress: (e) => { if (!shopUnlocked) e.preventDefault(); } }}
      />

      {/* ── Hidden routes (route alive, not shown in bar) ── */}
      {/* index = home hub; always reachable programmatically as the default (tabs) route */}
      <Tabs.Screen
        name="index"
        options={{ href: null, tabBarButtonTestID: "tab-index" }}
      />
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
