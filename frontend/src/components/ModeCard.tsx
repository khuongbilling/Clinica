import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ModeCardDef, MODE_STATUS_LABEL } from "@/src/game/modeHub";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// Illustrated-banner placeholder: a jade/gold gradient wash tinted by the
// mode's accent color, with the mode icon centered. This is a stand-in for
// the future commissioned banner art described in `mode.artBrief` — same
// dimensions/frame regardless of size variant, so swapping in real art later
// is a drop-in change.
function ModeBanner({ mode, height }: { mode: ModeCardDef; height: number }) {
  return (
    <View style={[styles.banner, { height, backgroundColor: mode.accentColor + "22" }]}>
      <View style={[styles.bannerIconWrap, { borderColor: mode.accentColor + "70", backgroundColor: mode.accentColor + "30" }]}>
        <Ionicons name={mode.icon as any} size={height >= 100 ? 30 : 22} color={mode.accentColor} />
      </View>
    </View>
  );
}

function StatusBadge({ status, color }: { status: ModeCardDef["status"]; color: string }) {
  const isActive = status === "active";
  const isLocked = status === "locked";
  const bg = isActive ? COLORS.success + "22" : isLocked ? COLORS.onSurfaceTertiary + "22" : color + "22";
  const fg = isActive ? COLORS.success : isLocked ? COLORS.onSurfaceTertiary : color;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {!isActive && <Ionicons name={isLocked ? "lock-closed" : "time-outline"} size={10} color={fg} />}
      <Text style={[styles.badgeTxt, { color: fg }]}>{MODE_STATUS_LABEL[status]}</Text>
    </View>
  );
}

interface ModeCardProps {
  mode: ModeCardDef;
  onPress: () => void;
  testID?: string;
  overrideUnlockRequirement?: string;
}

// Renders a mode as one of three visual weights (Step 5 hierarchy):
//  - large  -> hero "Continue" card with full banner + description
//  - medium -> active/current mode card
//  - small  -> compact coming-soon / secondary card
export function ModeCard({ mode, onPress, testID, overrideUnlockRequirement }: ModeCardProps) {
  const requirement = overrideUnlockRequirement ?? mode.unlockRequirement;
  const disabled = mode.status === "coming_soon" || mode.status === "locked";

  if (mode.size === "large") {
    return (
      <Pressable style={[styles.largeCard, { borderColor: mode.accentColor + "60" }]} onPress={onPress} testID={testID}>
        <ModeBanner mode={mode} height={110} />
        <View style={styles.largeBody}>
          <View style={styles.rowBetween}>
            <Text style={styles.largeTitle}>{mode.title}</Text>
            <StatusBadge status={mode.status} color={mode.accentColor} />
          </View>
          <Text style={styles.largeSub}>{mode.subtitle}</Text>
          {mode.rewardPreview && (
            <View style={styles.rewardRow}>
              <Ionicons name="gift-outline" size={12} color={COLORS.brand} />
              <Text style={styles.rewardTxt}>{mode.rewardPreview}</Text>
            </View>
          )}
          {requirement && (
            <View style={styles.rewardRow}>
              <Ionicons name="lock-closed-outline" size={12} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.reqTxt}>{requirement}</Text>
            </View>
          )}
          <View style={[styles.enterBtn, { backgroundColor: requirement ? COLORS.surfaceTertiary : mode.accentColor }]}>
            <Text style={[styles.enterBtnTxt, { color: requirement ? COLORS.onSurfaceTertiary : COLORS.onBrand }]}>
              {requirement ? "Locked" : "Continue"}
            </Text>
            {!requirement && <Ionicons name="arrow-forward" size={14} color={COLORS.onBrand} />}
          </View>
        </View>
      </Pressable>
    );
  }

  if (mode.size === "medium") {
    return (
      <Pressable
        style={[styles.mediumCard, { borderColor: mode.accentColor + "50" }, disabled && styles.dimmed]}
        onPress={onPress}
        testID={testID}
      >
        <ModeBanner mode={mode} height={72} />
        <View style={styles.mediumBody}>
          <View style={styles.rowBetween}>
            <Text style={styles.mediumTitle}>{mode.title}</Text>
            <StatusBadge status={mode.status} color={mode.accentColor} />
          </View>
          <Text style={styles.mediumSub}>{mode.subtitle}</Text>
          {mode.rewardPreview && !requirement && (
            <Text style={styles.rewardTxtSmall}>🎁 {mode.rewardPreview}</Text>
          )}
          {requirement && <Text style={styles.reqTxtSmall}>{requirement}</Text>}
        </View>
        <Ionicons
          name={requirement ? "lock-closed" : "chevron-forward"}
          size={16}
          color={requirement ? COLORS.onSurfaceTertiary : mode.accentColor}
        />
      </Pressable>
    );
  }

  // small — compact, visually secondary "coming soon" cards
  return (
    <Pressable
      style={[styles.smallCard, { borderColor: mode.accentColor + "35" }]}
      onPress={onPress}
      testID={testID}
    >
      <View style={[styles.smallIcon, { backgroundColor: mode.accentColor + "18", borderColor: mode.accentColor + "45" }]}>
        <Ionicons name={mode.icon as any} size={16} color={mode.accentColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.smallTitle}>{mode.title}</Text>
        <Text style={styles.smallSub} numberOfLines={2}>{mode.subtitle}</Text>
      </View>
      <StatusBadge status={mode.status} color={mode.accentColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: "100%", alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  bannerIconWrap: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: "center", justifyContent: "center",
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3,
  },
  badgeTxt: { fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },

  largeCard: {
    borderRadius: RADIUS.lg, borderWidth: 1.5, overflow: "hidden", backgroundColor: COLORS.surfaceSecondary,
  },
  largeBody: { padding: SPACING.md, gap: 6 },
  largeTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "700" },
  largeSub: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 2 },
  rewardTxt: { color: COLORS.brand, fontSize: 11, fontWeight: "600" },
  reqTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  enterBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: RADIUS.md, paddingVertical: 10, marginTop: 6,
  },
  enterBtnTxt: { fontSize: 13, fontWeight: "800" },

  mediumCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1.5, overflow: "hidden", backgroundColor: COLORS.surfaceSecondary,
  },
  mediumBody: { flex: 1, paddingVertical: SPACING.sm, paddingRight: SPACING.xs, gap: 3 },
  mediumTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700", flexShrink: 1 },
  mediumSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15 },
  rewardTxtSmall: { color: COLORS.brand, fontSize: 10, fontWeight: "600", marginTop: 1 },
  reqTxtSmall: { color: COLORS.onSurfaceTertiary, fontSize: 10, marginTop: 1 },

  smallCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    borderRadius: RADIUS.md, borderWidth: 1, backgroundColor: COLORS.surfaceSecondary,
    padding: SPACING.sm,
  },
  smallIcon: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  smallTitle: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  smallSub: { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 13, marginTop: 1 },

  dimmed: { opacity: 0.7 },
});
