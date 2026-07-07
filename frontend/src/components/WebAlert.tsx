import { Ionicons } from "@expo/vector-icons";
import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ─────────────────────────────────────────────────────────────
// Web-safe replacements for React Native Web's Alert.alert, which
// silently no-ops on web. Two primitives:
//   • useInlineNotice + InlineNotice — a lightweight auto-dismissing
//     toast for brief status feedback ("not enough…", "coming soon").
//   • MessageDialog — a Modal (always renders on web) for rich info
//     sheets and yes/no confirmations that genuinely need a choice.
// ─────────────────────────────────────────────────────────────

export function useInlineNotice(durationMs = 3200) {
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashNotice = useCallback(
    (msg: string) => {
      setNotice(msg);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setNotice(null), durationMs);
    },
    [durationMs],
  );

  const clearNotice = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setNotice(null);
  }, []);

  return { notice, flashNotice, clearNotice };
}

export function InlineNotice({
  notice,
  icon = "information-circle",
  testID,
}: {
  notice: string | null;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  testID?: string;
}) {
  if (!notice) return null;
  return (
    <View style={styles.notice} testID={testID}>
      <Ionicons name={icon} size={16} color={COLORS.brand} />
      <Text style={styles.noticeTxt}>{notice}</Text>
    </View>
  );
}

export function MessageDialog({
  visible,
  title,
  message,
  confirmLabel = "OK",
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
  testID,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  testID?: string;
}) {
  const close = onCancel ?? onConfirm;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()} testID={testID}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{message}</Text>
          <View style={styles.row}>
            {cancelLabel && (
              <Pressable style={styles.btnGhost} onPress={onCancel} testID={testID ? `${testID}-cancel` : undefined}>
                <Text style={styles.btnGhostTxt}>{cancelLabel}</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.btn, destructive && styles.btnDestructive]}
              onPress={onConfirm}
              testID={testID ? `${testID}-confirm` : undefined}
            >
              <Text style={styles.btnTxt}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.brandSecondary,
    backgroundColor: COLORS.brandTertiary + "40",
  },
  noticeTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 16 },
  backdrop: { flex: 1, backgroundColor: "#000000AA", alignItems: "center", justifyContent: "center", padding: SPACING.xl },
  card: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 10,
  },
  title: { color: COLORS.onSurface, fontSize: 16, fontWeight: "800" },
  body: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", gap: SPACING.sm, marginTop: 6 },
  btn: { flex: 1, backgroundColor: COLORS.brand, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: "center" },
  btnDestructive: { backgroundColor: COLORS.error },
  btnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "800" },
  btnGhost: { flex: 1, backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, paddingVertical: 10, alignItems: "center" },
  btnGhostTxt: { color: COLORS.onSurfaceSecondary, fontSize: 13, fontWeight: "700" },
});
