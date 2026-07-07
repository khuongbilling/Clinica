import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { playRewardCue } from "@/src/game/cues";
import { buildGateContext, checkFeatureGate } from "@/src/game/progression";
import {
  allObjectivesComplete, ensureFreshDailyRounds, summarizeReward,
  WEEKLY_GOAL_TARGET,
} from "@/src/game/dailyRounds";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────
// Global, non-blocking cue for Daily Ward Rounds progress. Mounted
// once at the root so a qualifying action ANYWHERE (Ward Shift win,
// Ward Defense wave, lesson, wellness log, hero action) surfaces an
// instant toast instead of the Rounds panel updating silently.
//
// Two flavours, driven by the store's `dailyPulse`:
//   • a subtle "+1 Daily Duty" slide-in for normal progress, and
//   • a brighter celebratory prompt when the last duty completes.
//
// Whenever a toast reflects a duty *completing* (a single "Daily Duty
// complete!" or the "All daily duties complete!" celebration), it also
// exposes a one-tap "Claim" button that grants the reward in place —
// falling back to opening the full Rounds panel when there is more than
// one thing left to claim. Tapping the toast body still opens the panel.
// ─────────────────────────────────────────────────────────────

const NORMAL_MS = 2600;
const CELEBRATE_MS = 5000;
const CLAIMED_MS = 3200;

type Toast = {
  id: number;
  headline: string;
  sub: string;
  celebrate: boolean;
  claimable: boolean;      // show the inline Claim button
  durationMs?: number;     // override auto-dismiss timing
};

// A single reward the toast can claim without opening the panel.
type Claimable =
  | { kind: "objective"; id: string }
  | { kind: "all" }
  | { kind: "weekly" };

const DAILY_ROUNDS_MODES = ["ward_shift", "ward_defense", "university", "lotus_journal", "hall_of_heroes"];

function unlockedModes(player: any): string[] {
  const ctx = buildGateContext(player);
  return DAILY_ROUNDS_MODES.filter((m) => checkFeatureGate(m, ctx).unlocked);
}

// Enumerate everything currently claimable from a freshly-rolled state, so the
// toast can decide between an in-place claim and a fall-back to the panel.
function claimableItems(player: any): Claimable[] {
  if (!player) return [];
  const state = ensureFreshDailyRounds(player.daily_rounds, unlockedModes(player), player.id).state;
  const items: Claimable[] = [];
  for (const o of state.objectives) {
    if (o.progress >= o.target && !o.claimed) items.push({ kind: "objective", id: o.id });
  }
  if (allObjectivesComplete(state) && !state.all_complete_claimed) items.push({ kind: "all" });
  if (state.weekly_days_completed >= WEEKLY_GOAL_TARGET && !state.weekly_claimed) items.push({ kind: "weekly" });
  return items;
}

function toastFromPulse(pulse: NonNullable<ReturnType<typeof usePlayer>["dailyPulse"]>): Toast {
  if (pulse.allJustCompleted) {
    return {
      id: pulse.id,
      headline: "All daily duties complete!",
      sub: "Tap Claim to collect your rewards",
      celebrate: true,
      claimable: true,
    };
  }
  const count = pulse.advanced.length;
  const first = pulse.advanced[0];
  const anyCompleted = pulse.advanced.some((a) => a.justCompleted);
  if (count > 1) {
    return {
      id: pulse.id,
      headline: `+${count} Daily Duties advanced`,
      sub: anyCompleted ? "Tap Claim to collect" : "Ward Rounds progress recorded",
      celebrate: false,
      claimable: anyCompleted,
    };
  }
  if (first?.justCompleted) {
    return {
      id: pulse.id,
      headline: "Daily Duty complete!",
      sub: first.label,
      celebrate: false,
      claimable: true,
    };
  }
  return {
    id: pulse.id,
    headline: "+1 Daily Duty",
    sub: first ? `${first.label} · ${first.progress}/${first.target}` : "Ward Rounds progress",
    celebrate: false,
    claimable: false,
  };
}

export function DailyPulseToast() {
  const { player, dailyPulse, requestOpenDailyRounds, claimDailyObjective, claimDailyAllComplete, claimWeeklyGoal } = usePlayer();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [claiming, setClaiming] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastId = useRef(0);
  const seq = useRef(0);

  // Show (or replace) the current toast, driving the slide-in + auto-dismiss.
  const showToast = useCallback((next: Toast) => {
    setToast(next);
    anim.stopAnimation();
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => setToast(null));
    }, next.durationMs ?? (next.celebrate ? CELEBRATE_MS : NORMAL_MS));
  }, [anim]);

  useEffect(() => {
    if (!dailyPulse || dailyPulse.id === lastId.current) return;
    lastId.current = dailyPulse.id;
    playRewardCue(dailyPulse.allJustCompleted);
    showToast(toastFromPulse(dailyPulse));
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [dailyPulse, showToast]);

  const dismiss = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setToast(null));
  }, [anim]);

  const openPanel = useCallback(() => {
    dismiss();
    requestOpenDailyRounds();
    router.push("/(tabs)");
  }, [dismiss, requestOpenDailyRounds, router]);

  // One-tap claim: if exactly one reward is outstanding, grant it in place and
  // confirm with a fresh toast; otherwise fall back to the full Rounds panel.
  const onClaim = useCallback(async () => {
    if (claiming) return;
    const items = claimableItems(player);
    if (items.length === 0) { dismiss(); return; }
    const only = items[0];
    if (items.length > 1) { openPanel(); return; }

    setClaiming(true);
    try {
      const res = only.kind === "weekly"
        ? await claimWeeklyGoal()
        : only.kind === "all"
        ? await claimDailyAllComplete()
        : await claimDailyObjective(only.id);
      if (res.ok) {
        seq.current += 1;
        showToast({
          id: -seq.current,
          headline: "Reward claimed!",
          sub: res.reward ? `+${summarizeReward(res.reward)}` : res.message,
          celebrate: true,
          claimable: false,
          durationMs: CLAIMED_MS,
        });
      } else {
        openPanel();
      }
    } finally {
      setClaiming(false);
    }
  }, [claiming, player, dismiss, openPanel, claimDailyAllComplete, claimDailyObjective, claimWeeklyGoal, showToast]);

  if (!toast) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View style={{ opacity: anim, transform: [{ translateY }] }} pointerEvents="box-none">
        <Pressable
          onPress={openPanel}
          style={[styles.toast, toast.celebrate && styles.toastCelebrate]}
          testID="daily-pulse-toast"
        >
          <View style={[styles.iconWrap, toast.celebrate && styles.iconWrapCelebrate]}>
            <Ionicons
              name={toast.celebrate ? "trophy" : "checkmark-circle"}
              size={18}
              color={toast.celebrate ? COLORS.energy : COLORS.brand}
            />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.headline} numberOfLines={1}>{toast.headline}</Text>
            <Text style={styles.sub} numberOfLines={1}>{toast.sub}</Text>
          </View>
          {toast.claimable ? (
            <Pressable
              onPress={(e) => { e.stopPropagation?.(); onClaim(); }}
              disabled={claiming}
              style={styles.claimBtn}
              hitSlop={8}
              testID="daily-pulse-claim"
            >
              {claiming ? (
                <ActivityIndicator size="small" color={COLORS.onBrand} />
              ) : (
                <Text style={styles.claimTxt}>CLAIM</Text>
              )}
            </Pressable>
          ) : (
            <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 99999,
    ...(Platform.OS === "web" ? ({ position: "fixed" } as any) : null),
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    maxWidth: 420,
    minWidth: 240,
    marginHorizontal: SPACING.lg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceSecondary,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  toastCelebrate: {
    borderColor: COLORS.energy + "88",
    backgroundColor: COLORS.energy + "18",
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.brand + "1E",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapCelebrate: { backgroundColor: COLORS.energy + "26" },
  textCol: { flex: 1 },
  headline: { color: COLORS.onSurface, fontSize: 13, fontWeight: "800" },
  sub: { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 1 },
  claimBtn: {
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  claimTxt: { color: COLORS.onBrand, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
});
