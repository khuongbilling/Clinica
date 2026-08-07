/**
 * LocationHeader — slim scene-location row below PlayerHeader.
 *
 * Renders: ◇ SCENE NAME ◇ in display letterSpacing, a muted subtitle
 * beneath, and a small info-button pressed-area absolute-positioned
 * on the right. Mirrors the mockup's LocationHeader.tsx layout using
 * UI tokens rather than hardcoded hex.
 */
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SPACING } from "@/src/theme/colors";
import { UI, UI_RADIUS, TYPO, SERIF } from "@/src/theme/ui";

export interface LocationHeaderProps {
  sceneName: string;
  subtitle?: string;
  onInfoPress?: () => void;
}

export function LocationHeader({ sceneName, subtitle, onInfoPress }: LocationHeaderProps) {
  return (
    <View style={s.wrap}>
      {/* Diamond decorators + title */}
      <View style={s.titleRow}>
        <Text style={s.diamond}>◇</Text>
        <Text style={s.sceneName} numberOfLines={1}>
          {sceneName.toUpperCase()}
        </Text>
        <Text style={s.diamond}>◇</Text>
      </View>

      {/* Muted subtitle */}
      {subtitle ? (
        <Text style={s.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}

      {/* Info button — absolute right */}
      {onInfoPress ? (
        <Pressable
          style={s.infoBtn}
          onPress={onInfoPress}
          hitSlop={10}
          accessibilityLabel="Scene info"
        >
          <Ionicons name="information-circle-outline" size={18} color={UI.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    position: "relative",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  diamond: {
    color: UI.gold,
    fontSize: 10,
    opacity: 0.75,
  },
  sceneName: {
    color: UI.goldSoft,
    fontSize: TYPO.kicker + 1,   // 13 px — decorative kicker size
    fontWeight: "600",
    fontFamily: SERIF,
    letterSpacing: 2.2,
  },
  subtitle: {
    color: UI.textDim,
    fontSize: 10,
    fontWeight: "400",
    marginTop: 2,
    letterSpacing: 0.4,
    textAlign: "center",
  },
  infoBtn: {
    position: "absolute",
    right: SPACING.md,
    top: "50%",
    transform: [{ translateY: -12 }],
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: UI.sanctuaryPanel,
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
