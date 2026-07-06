import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MONETIZATION_BADGE_COLOR, EventTrackDef } from "@/src/game/eventsHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

const CADENCE_LABEL: Record<EventTrackDef["cadence"], string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  seasonal: "Seasonal",
  special: "Limited-Time",
};

interface EventTrackCardProps {
  event: EventTrackDef;
  onPress: (event: EventTrackDef) => void;
  testID?: string;
}

/**
 * Gameplay event track preview card for the Push 7 Event Hub. Shows a free +
 * premium reward track, a static milestone progress preview, and lore /
 * cosmetic / material reward chips. The premium track is always cosmetic,
 * lore, or material — never exclusive power or a gameplay advantage.
 */
export function EventTrackCard({ event, onPress, testID }: EventTrackCardProps) {
  const badgeColor = MONETIZATION_BADGE_COLOR[event.badge];
  const pct = Math.round(event.rewards.milestoneProgress * 100);

  return (
    <Pressable style={[styles.card, { borderColor: event.accentColor + "45" }]} onPress={() => onPress(event)} testID={testID}>
      <LinearGradient
        colors={[event.accentColor + "26", COLORS.surfaceSecondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { borderColor: event.accentColor + "70", backgroundColor: event.accentColor + "22" }]}>
          <Ionicons name={event.icon as any} size={20} color={event.accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.cadence}>{CADENCE_LABEL[event.cadence]} Event</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badgeColor + "26", borderColor: badgeColor + "55" }]}>
          <Text style={[styles.badgeTxt, { color: badgeColor }]}>{event.badge.toUpperCase()}</Text>
        </View>
      </View>

      <Text style={styles.subtitle} numberOfLines={2}>{event.subtitle}</Text>

      {/* Milestone progress preview — static, not live */}
      <View style={styles.progressRow}>
        <Text style={styles.progressLabel}>{event.rewards.milestoneLabel}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: event.accentColor }]} />
        </View>
      </View>

      {/* Free vs Premium reward tracks */}
      <View style={styles.tracksRow}>
        <View style={styles.trackCol}>
          <View style={styles.trackHeader}>
            <Ionicons name="gift-outline" size={11} color={COLORS.success} />
            <Text style={[styles.trackLabel, { color: COLORS.success }]}>FREE TRACK</Text>
          </View>
          <Text style={styles.trackTxt} numberOfLines={2}>{event.rewards.freeTrack}</Text>
        </View>
        <View style={styles.trackCol}>
          <View style={styles.trackHeader}>
            <Ionicons name="star-outline" size={11} color={COLORS.brand} />
            <Text style={[styles.trackLabel, { color: COLORS.brand }]}>PREMIUM (PLACEHOLDER)</Text>
          </View>
          <Text style={styles.trackTxt} numberOfLines={2}>{event.rewards.premiumTrack}</Text>
        </View>
      </View>

      {/* Lore / cosmetic / material chips */}
      <View style={styles.chipRow}>
        <View style={styles.chip}>
          <Ionicons name="book-outline" size={10} color={COLORS.onSurfaceSecondary} />
          <Text style={styles.chipTxt} numberOfLines={1}>{event.rewards.loreReward}</Text>
        </View>
        <View style={styles.chip}>
          <Ionicons name="shirt-outline" size={10} color={COLORS.onSurfaceSecondary} />
          <Text style={styles.chipTxt} numberOfLines={1}>{event.rewards.cosmeticReward}</Text>
        </View>
        <View style={styles.chip}>
          <Ionicons name="cube-outline" size={10} color={COLORS.onSurfaceSecondary} />
          <Text style={styles.chipTxt} numberOfLines={1}>{event.rewards.materialReward}</Text>
        </View>
      </View>

      <View style={styles.footerRow}>
        <Ionicons name="information-circle-outline" size={12} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.footerTxt}>Preview only — no rewards are granted yet</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.md,
    gap: 8,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  iconWrap: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: COLORS.onSurface, fontSize: 15, fontWeight: "700" },
  cadence: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "600", marginTop: 1, textTransform: "uppercase", letterSpacing: 0.5 },
  badge: {
    borderRadius: RADIUS.pill, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  subtitle: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 16 },
  progressRow: { gap: 4 },
  progressLabel: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700" },
  progressTrack: { height: 6, borderRadius: RADIUS.pill, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: RADIUS.pill },
  tracksRow: { flexDirection: "row", gap: SPACING.sm },
  trackCol: { flex: 1, gap: 2 },
  trackHeader: { flexDirection: "row", alignItems: "center", gap: 4 },
  trackLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  trackTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 15 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.pill,
    paddingHorizontal: 8, paddingVertical: 4, maxWidth: "100%",
  },
  chipTxt: { color: COLORS.onSurfaceSecondary, fontSize: 10, flexShrink: 1 },
  footerRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  footerTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10, fontStyle: "italic" },
});
