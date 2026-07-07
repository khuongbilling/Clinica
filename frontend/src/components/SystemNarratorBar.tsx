import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";


import { usePlayer } from "@/src/game/store";
import { playerLevelFromXp } from "@/src/game/progression";
import { getSystemIdentity } from "@/src/game/systemNarrator";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

/**
 * SystemNarratorBar — compact, skippable inline System presence for non-tutorial
 * screens (class result, lotus recall, university arrival, locked progression, etc.).
 *
 * Shows the System's portrait + "SYSTEM:" prefix + one concise message line.
 * Dismissable via the × button; stays dismissed for the lifetime of the component.
 * Use the `storageKey` prop (optional) to persist the dismiss across sessions.
 */
export function SystemNarratorBar({
  message,
  testID,
}: {
  message: string;
  testID?: string;
}) {
  const { player } = usePlayer();
  const [dismissed, setDismissed] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  if (dismissed) return null;

  const playerLevel = player
    ? (player.player_level ?? playerLevelFromXp(player.xp ?? 0).level)
    : 1;
  const identity = getSystemIdentity(playerLevel, player?.aptitude);

  const dismiss = () => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
      setDismissed(true),
    );
  };

  return (
    <Animated.View
      style={[styles.bar, { borderColor: identity.color + "50", shadowColor: identity.color }, { opacity: fadeAnim }]}
      testID={testID ?? "system-narrator-bar"}
    >
      <View style={[styles.portrait, { borderColor: identity.color + "80" }]}>
        <ExpoImage
          source={identity.art}
          style={styles.portraitImg}
          contentFit="cover"
          transition={200}
        />
      </View>
      <View style={styles.textCol}>
        <Text style={[styles.prefix, { color: identity.color }]} numberOfLines={1}>
          SYSTEM
        </Text>
        <Text style={styles.msg}>{message}</Text>
      </View>
      <Pressable onPress={dismiss} hitSlop={12} style={styles.dismiss} testID="system-narrator-dismiss">
        <Ionicons name="close" size={13} color={COLORS.onSurfaceTertiary} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 6,
  },
  portrait: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: "#0B1420",
    flexShrink: 0,
  },
  portraitImg: {
    width: 28,
    height: 28,
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  prefix: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
  },
  msg: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  dismiss: {
    paddingTop: 2,
    flexShrink: 0,
  },
});
