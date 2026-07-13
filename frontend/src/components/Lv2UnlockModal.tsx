/**
 * Lv2UnlockModal — "Apprentice Path Opened" celebration (C5)
 *
 * Shown exactly once when a player first reaches Level 2 (or, for returning
 * players who are already Level 2+, the first time they open the hub after
 * the C5 update). Gated by `player.seen_lv2_unlock`.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Unlock item ───────────────────────────────────────────────────────────────

const UNLOCKS: Array<{
  icon: string;
  color: string;
  title: string;
  description: string;
}> = [
  {
    icon: "sparkles",
    color: "#D4AF37",
    title: "Summoning Hall",
    description: "Spend Summoning Shards to recruit hero allies. Your first summon is within reach for free.",
  },
  {
    icon: "today",
    color: COLORS.brand,
    title: "Daily Rounds",
    description: "Three rotating daily duties across your unlocked systems. Check in each day to build your streak and earn Ward Coins.",
  },
  {
    icon: "calendar",
    color: COLORS.river,
    title: "Weekly Rounds",
    description: "Complete daily rounds five days a week for an extra chest of rewards.",
  },
  {
    icon: "medical",
    color: COLORS.error,
    title: "Clearer Ward Access",
    description: "Ward Shifts are now fully open. Enter the Ward to earn XP, Summoning Shards, and ★ ratings.",
  },
  {
    icon: "diamond",
    color: "#7C3AED",
    title: "Summoning Shards",
    description: "The main recruitment currency. Earn them from Ward Shifts, chapter rewards, and daily duties — no payment required.",
  },
  {
    icon: "map-outline",
    color: COLORS.fire,
    title: "First Recruit Tutorial",
    description: "Open the Summoning Hall and your first guide will walk you through your first recruit.",
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function Lv2UnlockModal({ visible, onDismiss }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const goToSummoning = () => {
    onDismiss();
    setTimeout(() => router.push("/university/recruit" as any), 300);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, SPACING.lg) }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header gradient */}
          <LinearGradient
            colors={["#D4AF3720", "transparent"]}
            style={styles.headerGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Badge */}
          <View style={styles.levelBadge}>
            <Ionicons name="star" size={14} color="#D4AF37" />
            <Text style={styles.levelBadgeTxt}>LEVEL 2</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Apprentice Path Opened</Text>
          <Text style={styles.subtitle}>
            Your early training has stabilized. You may now recruit allies, complete Daily Rounds, and continue your first ward rotation.
          </Text>

          {/* Unlock list */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {UNLOCKS.map((u) => (
              <View key={u.title} style={styles.unlockRow}>
                <View style={[styles.unlockIcon, { backgroundColor: u.color + "20", borderColor: u.color + "60" }]}>
                  <Ionicons name={u.icon as any} size={18} color={u.color} />
                </View>
                <View style={styles.unlockText}>
                  <Text style={styles.unlockTitle}>{u.title}</Text>
                  <Text style={styles.unlockDesc}>{u.description}</Text>
                </View>
              </View>
            ))}

            {/* Shards explainer callout */}
            <View style={styles.shardsCallout}>
              <Ionicons name="information-circle" size={16} color="#D4AF37" />
              <Text style={styles.shardsCalloutTxt}>
                <Text style={{ fontWeight: "700", color: "#D4AF37" }}>Summoning Shards</Text>
                {" "}are your primary recruit currency. Earn them by playing — Ward Shifts, chapter clears, daily duties, and milestones. You don't need to spend real money to build your team.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Pressable style={styles.ctaPrimary} onPress={goToSummoning} testID="lv2-modal-summon">
              <Ionicons name="sparkles" size={16} color={COLORS.surface} />
              <Text style={styles.ctaPrimaryTxt}>Open Summoning Hall</Text>
            </Pressable>
            <Pressable style={styles.ctaSecondary} onPress={onDismiss} testID="lv2-modal-dismiss">
              <Text style={styles.ctaSecondaryTxt}>Stay on Hub</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.70)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#D4AF3750",
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    maxHeight: "88%",
    overflow: "hidden",
  },
  headerGrad: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: SPACING.md,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "center",
    backgroundColor: "#D4AF3720",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: "#D4AF3760",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginBottom: SPACING.xs,
  },
  levelBadgeTxt: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#D4AF37",
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.onSurface,
    textAlign: "center",
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.onSurfaceSecondary,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },

  // Unlock list
  list: { flexShrink: 1 },
  listContent: { gap: SPACING.xs, paddingBottom: SPACING.sm },
  unlockRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.sm,
  },
  unlockIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  unlockText: { flex: 1 },
  unlockTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.onSurface,
    marginBottom: 2,
  },
  unlockDesc: {
    fontSize: 12,
    color: COLORS.onSurfaceTertiary,
    lineHeight: 17,
  },

  // Shards callout
  shardsCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#D4AF3712",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: "#D4AF3740",
    padding: SPACING.sm,
    marginTop: SPACING.xs,
  },
  shardsCalloutTxt: {
    flex: 1,
    fontSize: 12,
    color: COLORS.onSurfaceSecondary,
    lineHeight: 18,
  },

  // Actions
  actions: {
    gap: SPACING.xs,
    marginTop: SPACING.md,
  },
  ctaPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#D4AF37",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  ctaPrimaryTxt: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.surface,
    letterSpacing: 0.3,
  },
  ctaSecondary: {
    alignItems: "center",
    paddingVertical: 10,
  },
  ctaSecondaryTxt: {
    fontSize: 13,
    color: COLORS.onSurfaceTertiary,
  },
});
