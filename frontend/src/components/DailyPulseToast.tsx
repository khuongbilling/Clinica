import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────
// Global, non-blocking cue for Daily Ward Rounds progress. Mounted
// once at the root so a qualifying action ANYWHERE (Ward Shift win,
// Ward Defense wave, lesson, wellness log, hero action) surfaces an
// instant toast instead of the Rounds panel updating silently.
//
// Two flavours, driven by the store's `dailyPulse`:
//   • a subtle "+1 Daily Duty" slide-in for normal progress, and
//   • a brighter celebratory prompt when the last duty completes,
//     tappable to jump to the Rounds panel and claim.
// ─────────────────────────────────────────────────────────────

const NORMAL_MS = 2600;
const CELEBRATE_MS = 5000;

type Toast = {
  id: number;
  headline: string;
  sub: string;
  celebrate: boolean;
};

function toastFromPulse(pulse: NonNullable<ReturnType<typeof usePlayer>["dailyPulse"]>): Toast {
  if (pulse.allJustCompleted) {
    return {
      id: pulse.id,
      headline: "All daily duties complete!",
      sub: "Tap to claim your rewards",
      celebrate: true,
    };
  }
  const count = pulse.advanced.length;
  const first = pulse.advanced[0];
  if (count > 1) {
    return {
      id: pulse.id,
      headline: `+${count} Daily Duties advanced`,
      sub: "Ward Rounds progress recorded",
      celebrate: false,
    };
  }
  if (first?.justCompleted) {
    return {
      id: pulse.id,
      headline: "Daily Duty complete!",
      sub: first.label,
      celebrate: false,
    };
  }
  return {
    id: pulse.id,
    headline: "+1 Daily Duty",
    sub: first ? `${first.label} · ${first.progress}/${first.target}` : "Ward Rounds progress",
    celebrate: false,
  };
}

export function DailyPulseToast() {
  const { dailyPulse, requestOpenDailyRounds } = usePlayer();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastId = useRef(0);

  useEffect(() => {
    if (!dailyPulse || dailyPulse.id === lastId.current) return;
    lastId.current = dailyPulse.id;
    const next = toastFromPulse(dailyPulse);
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
    }, next.celebrate ? CELEBRATE_MS : NORMAL_MS);

    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [dailyPulse, anim]);

  if (!toast) return null;

  const dismiss = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    Animated.timing(anim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => setToast(null));
  };

  const onPress = () => {
    dismiss();
    requestOpenDailyRounds();
    router.push("/(tabs)");
  };

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] });

  return (
    <View pointerEvents="box-none" style={[styles.host, { top: insets.top + 8 }]}>
      <Animated.View style={{ opacity: anim, transform: [{ translateY }] }} pointerEvents="box-none">
        <Pressable
          onPress={onPress}
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
          <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
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
});
