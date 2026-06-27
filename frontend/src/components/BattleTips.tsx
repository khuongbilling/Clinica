import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const STORAGE_KEY = "clinica.tips.seen.v2";

// ---------------------------------------------------------------------------
// Tip catalog. Each tip fires once and only once for the player's device.
// ---------------------------------------------------------------------------

export type TipId =
  | "battle.intro"
  | "battle.heroSelect"
  | "battle.firstSkill"
  | "battle.clueReveal"
  | "battle.lowAp"
  | "battle.endTurn"
  | "battle.firstChain"
  | "result.firstWin";

interface TipDef {
  id: TipId;
  kicker: string;
  title: string;
  body: string;
  icon: string;
}

export const TIPS: Record<TipId, TipDef> = {
  "battle.intro": {
    id: "battle.intro",
    kicker: "GUIDANCE",
    title: "Your goal in every battle",
    body:
      "Lower Disease Corruption (red) to 0 — that's how you win. Don't let Stability (green) reach 0, or the patient is lost.",
    icon: "shield-checkmark",
  },
  "battle.heroSelect": {
    id: "battle.heroSelect",
    kicker: "GUIDANCE",
    title: "Heroes act once per turn",
    body:
      "Tap a hero pill to view their skills. Each hero can act once per turn — match the right role to the right enemy system.",
    icon: "people",
  },
  "battle.firstSkill": {
    id: "battle.firstSkill",
    kicker: "GUIDANCE",
    title: "Watch the badges",
    body:
      "RECOMMENDED fits the patient. WEAK or POOR FIT means it'll underperform. BASIC is a fallback — use it sparingly.",
    icon: "ribbon",
  },
  "battle.clueReveal": {
    id: "battle.clueReveal",
    kicker: "GUIDANCE",
    title: "Hidden clue unlocked",
    body:
      "Hidden clues often hold the diagnosis (labs, vitals). Reveal them BEFORE high-cost moves so you treat the real cause.",
    icon: "eye",
  },
  "battle.lowAp": {
    id: "battle.lowAp",
    kicker: "GUIDANCE",
    title: "Out of Action Points?",
    body:
      "End the turn — heroes refresh and you get fresh AP. If the patient is unstable you'll get bonus AP next turn.",
    icon: "flash",
  },
  "battle.endTurn": {
    id: "battle.endTurn",
    kicker: "GUIDANCE",
    title: "Stability ticks each turn",
    body:
      "Severe enemies drain stability per turn. Stabilize early so your reserve doesn't run out before you treat the cause.",
    icon: "pulse",
  },
  "battle.firstChain": {
    id: "battle.firstChain",
    kicker: "GUIDANCE",
    title: "Care chain progressing",
    body:
      "Assess → Stabilize → Treat → Coordinate. Complete the chain for a damage multiplier, bonus shards, and the 3rd star.",
    icon: "git-network",
  },
  "result.firstWin": {
    id: "result.firstWin",
    kicker: "FIRST VICTORY",
    title: "How stars work",
    body:
      "★ 1 = saved the patient · ★ 2 = completed the care chain · ★ 3 = safe & efficient. Open the Manual any time from Profile.",
    icon: "star",
  },
};

// ---------------------------------------------------------------------------
// Queue hook
// ---------------------------------------------------------------------------

interface UseTipsApi {
  current: TipDef | null;
  enqueue: (id: TipId) => void;
  dismiss: () => void;
}

export function useTipsQueue(): UseTipsApi {
  const [seen, setSeen] = useState<Set<TipId> | null>(null);
  const [queue, setQueue] = useState<TipId[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const v = await AsyncStorage.getItem(STORAGE_KEY);
        const arr: TipId[] = v ? JSON.parse(v) : [];
        setSeen(new Set(arr));
      } catch {
        setSeen(new Set());
      }
    })();
  }, []);

  const enqueue = useCallback(
    (id: TipId) => {
      if (!seen) return;
      if (seen.has(id)) return;
      setQueue((q) => (q.includes(id) ? q : [...q, id]));
    },
    [seen],
  );

  const dismiss = useCallback(async () => {
    setQueue((q) => {
      const [first, ...rest] = q;
      if (first && seen) {
        const next = new Set(seen);
        next.add(first);
        setSeen(next);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      }
      return rest;
    });
  }, [seen]);

  const current = queue.length > 0 && seen && !seen.has(queue[0]) ? TIPS[queue[0]] : null;

  return { current, enqueue, dismiss };
}

// ---------------------------------------------------------------------------
// Bubble UI
// ---------------------------------------------------------------------------

export function TipBubble({ tip, onDismiss }: { tip: TipDef | null; onDismiss: () => void }) {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tip) {
      fade.setValue(0);
      Animated.timing(fade, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [tip, fade]);

  if (!tip) return null;

  const translateY = fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });

  return (
    <View style={[styles.wrap, { pointerEvents: 'box-none' }]} testID={`tip-${tip.id}`}>
      <Animated.View style={[styles.bubble, { opacity: fade, transform: [{ translateY }] }]}>
        <View style={styles.iconWrap}>
          <Ionicons name={tip.icon as any} size={18} color={COLORS.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>{tip.kicker}</Text>
          <Text style={styles.title}>{tip.title}</Text>
          <Text style={styles.body}>{tip.body}</Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          style={styles.closeBtn}
          testID="tip-dismiss"
        >
          <Ionicons name="close" size={16} color={COLORS.onSurfaceSecondary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: SPACING.md,
    right: SPACING.md,
    top: SPACING.md,
    alignItems: "stretch",
    zIndex: 50,
  },
  bubble: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderWidth: 1,
    borderColor: COLORS.brand + "55",
    shadowColor: COLORS.brand,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.brand + "1A",
    borderWidth: 1,
    borderColor: COLORS.brand + "55",
    alignItems: "center",
    justifyContent: "center",
  },
  kicker: {
    color: COLORS.brand,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 1,
  },
  title: {
    color: COLORS.onSurface,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  body: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 11,
    lineHeight: 15,
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
