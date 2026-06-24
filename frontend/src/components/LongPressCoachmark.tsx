import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const STORAGE_KEY = "clinica.coachmark.longpress.v1";

/**
 * First-battle coachmark.
 * Pulses above the action bar pointing down at the skill grid.
 * Dismissable forever via AsyncStorage flag.
 */
export function LongPressCoachmark({ visible }: { visible: boolean }) {
  const [seen, setSeen] = useState<boolean | null>(null); // null while loading flag
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(STORAGE_KEY);
      setSeen(v === "1");
    })();
  }, []);

  useEffect(() => {
    if (seen === false && visible) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [seen, visible, pulse]);

  if (!visible || seen !== false) return null;

  const dismiss = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "1");
    setSeen(true);
  };

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const arrowY = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 6] });

  return (
    <View style={styles.wrap} pointerEvents="box-none" testID="coachmark-longpress">
      <Animated.View style={[styles.bubble, { transform: [{ scale }], opacity }]}>
        <View style={styles.bubbleInner}>
          <Ionicons name="finger-print" size={16} color={COLORS.onBrand} />
          <View style={{ flex: 1 }}>
            <Text style={styles.bubbleTitle}>NEW IN THIS BATTLE</Text>
            <Text style={styles.bubbleBody}>
              <Text style={styles.bold}>Tap</Text> a skill to use it.{" "}
              <Text style={styles.bold}>Long-press</Text> any skill, item, or call to see real nursing & NCLEX context.
            </Text>
          </View>
          <Pressable hitSlop={10} onPress={dismiss} testID="coachmark-dismiss">
            <Ionicons name="close" size={16} color={COLORS.onBrand} />
          </Pressable>
        </View>
        <Animated.View style={[styles.arrow, { transform: [{ translateY: arrowY }] }]}>
          <Ionicons name="caret-down" size={20} color={COLORS.brand} />
        </Animated.View>
      </Animated.View>

      <Pressable style={styles.gotItRow} onPress={dismiss} hitSlop={6}>
        <Text style={styles.gotIt}>{"GOT IT — DON'T SHOW AGAIN"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: SPACING.md,
    right: SPACING.md,
    bottom: 280,
    alignItems: "center",
    zIndex: 40,
  },
  bubble: {
    backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
    width: "100%",
  },
  bubbleInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  bubbleTitle: {
    color: COLORS.onBrand,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 2,
    opacity: 0.85,
  },
  bubbleBody: {
    color: COLORS.onBrand,
    fontSize: 12,
    lineHeight: 16,
  },
  bold: {
    fontWeight: "800",
  },
  arrow: {
    position: "absolute",
    bottom: -14,
    alignSelf: "center",
  },
  gotItRow: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: RADIUS.pill,
  },
  gotIt: {
    color: COLORS.brand,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
});
