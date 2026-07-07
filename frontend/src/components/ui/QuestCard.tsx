import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";

import { GLOW, GRADIENTS, UI, UI_RADIUS, SPACING } from "@/src/theme/ui";
import { RewardCard } from "./RewardCard";

// QuestCard — a single tappable objective / mode / destination row. Icon medallion,
// clear title + one short subtitle, optional reward chip, and a locked state.
// Built for mobile scanability: one idea per card, obvious tap affordance.
export function QuestCard({
  icon,
  title,
  subtitle,
  reward,
  rewardIcon,
  accent = UI.gold,
  locked = false,
  lockText,
  live = false,
  badge,
  onPress,
  style,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  reward?: string;
  rewardIcon?: keyof typeof Ionicons.glyphMap;
  accent?: string;
  locked?: boolean;
  lockText?: string;
  live?: boolean;
  badge?: number;
  onPress: () => void;
  style?: ViewStyle | ViewStyle[];
  testID?: string;
}) {
  const tint = locked ? UI.textDim : accent;
  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.wrap,
        { borderColor: locked ? UI.border : tint + "45" },
        !locked && GLOW.ambient,
        pressed && !locked && styles.pressed,
        style,
      ]}
    >
      <LinearGradient colors={GRADIENTS.panel} style={StyleSheet.absoluteFill} />
      <View style={[styles.medallion, { borderColor: tint + "70", backgroundColor: tint + "1E" }]}>
        <Ionicons name={locked ? "lock-closed" : icon} size={22} color={tint} />
        {live && !locked ? <View style={styles.liveDot} /> : null}
        {!locked && badge && badge > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeTxt}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, locked && { color: UI.textDim }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {reward && !locked ? (
          <View style={styles.rewardRow}>
            <RewardCard icon={rewardIcon} label={reward} tint={accent} />
          </View>
        ) : null}
      </View>

      {locked ? (
        <View style={styles.lockPill}>
          <Text style={styles.lockTxt}>{lockText ?? "Locked"}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={tint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: UI_RADIUS.card,
    overflow: "hidden",
    padding: SPACING.md,
    minHeight: 76,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  medallion: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  liveDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: UI.teal,
    borderWidth: 1.5,
    borderColor: UI.panel,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5,
    borderColor: UI.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "#FFFFFF", fontSize: 9, fontWeight: "800" },
  body: { flex: 1, gap: 3 },
  title: { color: UI.text, fontSize: 15, fontWeight: "800" },
  subtitle: { color: UI.textSoft, fontSize: 12, lineHeight: 16 },
  rewardRow: { flexDirection: "row", marginTop: 4 },
  lockPill: {
    borderRadius: UI_RADIUS.pill,
    borderWidth: 1,
    borderColor: UI.border,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  lockTxt: { color: UI.textDim, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
});
