import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { getUiIcon } from "@/src/game/uiIcons";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// The ONE way University Credits are displayed anywhere in the game: the
// donghua scroll icon + amount. Tapping the badge opens a short explainer
// (what Credits are, where they come from, what they buy) so the currency
// reads consistently across Recruitment, Training Hall, Hero Certification
// and lesson rewards.
export function UniversityCreditsBadge({
  amount,
  label,
  compact,
  testID,
}: {
  amount: number;
  label?: string;
  compact?: boolean;
  testID?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        style={[styles.badge, compact && styles.badgeCompact]}
        onPress={() => setOpen(true)}
        testID={testID || "university-credits-badge"}
        hitSlop={6}
      >
        <Image source={getUiIcon("university_credit")} style={compact ? styles.iconSm : styles.icon} resizeMode="contain" />
        <Text style={[styles.amount, compact && styles.amountSm]}>{amount.toLocaleString()}</Text>
        {!compact && <Text style={styles.label}>{label ?? "UNIVERSITY CREDITS"}</Text>}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}} testID="university-credits-explainer">
            <Image source={getUiIcon("university_credit")} style={styles.bigIcon} resizeMode="contain" />
            <Text style={styles.sheetTitle}>University Credits</Text>
            <Text style={styles.sheetTag}>The University's learning currency — proof of your study.</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>EARNED FROM</Text>
              <Text style={styles.rowTxt}>University lessons, Recruitment Hall rolls, and the Research Library.</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>USED FOR</Text>
              <Text style={styles.rowTxt}>
                Promoting heroes' Certification Star at the University — 500 → 1,500 → 5,000 → 15,000 Credits per star.
                Training a hero's level is always free; Credits are only spent at promotion.
              </Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)} testID="university-credits-explainer-close">
              <Text style={styles.closeTxt}>GOT IT</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill,
    backgroundColor: "rgba(0,0,0,0.25)", paddingVertical: 5, paddingHorizontal: SPACING.sm,
  },
  badgeCompact: { paddingVertical: 3, paddingHorizontal: 8, gap: 4 },
  icon: { width: 20, height: 20 },
  iconSm: { width: 15, height: 15 },
  amount: { color: COLORS.onSurface, fontSize: 14, fontWeight: "800" },
  amountSm: { fontSize: 12 },
  label: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1, fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  sheet: {
    width: "100%", maxWidth: 360, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, gap: SPACING.sm, alignItems: "center",
  },
  bigIcon: { width: 56, height: 56 },
  sheetTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "700" },
  sheetTag: { color: COLORS.onSurfaceSecondary, fontSize: 12, textAlign: "center" },
  row: { alignSelf: "stretch", gap: 2, marginTop: SPACING.xs },
  rowLabel: { color: COLORS.brand, fontSize: 10, letterSpacing: 1.5, fontWeight: "800" },
  rowTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  closeBtn: {
    marginTop: SPACING.sm, borderRadius: RADIUS.pill, backgroundColor: COLORS.brand,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.xl,
  },
  closeTxt: { color: COLORS.onBrand, fontSize: 12, fontWeight: "800", letterSpacing: 1 },
});
