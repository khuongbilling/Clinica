import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

export default function HeroSelectScreen() {
  const router = useRouter();
  const { player, saveActiveTeam } = usePlayer();
  const [selected, setSelected] = useState<string>(
    player?.active_team?.[0] ?? "novice_guardian"
  );
  const [saving, setSaving] = useState(false);

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]} testID="hero-select-loading">
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  const owned = new Set(player.heroes_owned);
  const ownedHeroes = HEROES.filter((h) => owned.has(h.id));
  const currentTeam = player.active_team ?? [];

  const confirm = async () => {
    setSaving(true);
    // Keep lead as selected, preserve rest of team order
    const rest = currentTeam.filter((id) => id !== selected);
    const newTeam = [selected, ...rest].slice(0, 3);
    await saveActiveTeam(newTeam);
    goBack(router, "/(tabs)");
  };

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)")} hitSlop={10}>
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>REPRESENTATIVE</Text>
          <Text style={styles.title}>Choose Your Lead</Text>
        </View>
      </View>
      <Text style={styles.lead}>
        This hero's portrait appears on your home screen. Tap to preview, then confirm.
      </Text>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {ownedHeroes.map((h) => {
            const isSelected = selected === h.id;
            const sprite = getHeroSprite(h.id);
            const accent = ELEMENT_COLORS[h.element] ?? COLORS.brand;
            return (
              <Pressable
                key={h.id}
                style={[
                  styles.card,
                  { borderColor: isSelected ? accent : COLORS.border },
                  isSelected && { backgroundColor: accent + "12" },
                ]}
                onPress={() => setSelected(h.id)}
                testID={`hero-select-${h.id}`}
              >
                {/* Portrait image */}
                <View style={[styles.portraitWrap, { borderColor: accent + (isSelected ? "CC" : "44") }]}>
                  {sprite ? (
                    <Image source={sprite} style={styles.portrait} resizeMode="cover" />
                  ) : (
                    <View style={[styles.portrait, { backgroundColor: COLORS.surfaceTertiary }]} />
                  )}
                  {isSelected && (
                    <View style={[styles.selectedBadge, { backgroundColor: accent }]}>
                      <Ionicons name="checkmark" size={14} color={COLORS.surface} />
                    </View>
                  )}
                </View>
                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={[styles.heroName, isSelected && { color: accent }]} numberOfLines={1}>
                    {h.name}
                  </Text>
                  <Text style={styles.heroTitle} numberOfLines={1}>{h.title}</Text>
                  <View style={[styles.elementPill, { borderColor: accent + "60" }]}>
                    <Text style={[styles.elementTxt, { color: accent }]}>{h.element.toUpperCase()}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* Confirm CTA */}
      <View style={styles.footer}>
        <View style={styles.previewRow}>
          {getHeroSprite(selected) && (
            <Image source={getHeroSprite(selected)!} style={styles.previewThumb} resizeMode="cover" />
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.previewLabel}>SELECTED LEAD</Text>
            <Text style={styles.previewName}>
              {HEROES.find((h) => h.id === selected)?.name ?? selected}
            </Text>
          </View>
        </View>
        <Pressable
          style={[styles.confirmBtn, saving && { opacity: 0.6 }]}
          onPress={confirm}
          disabled={saving}
          testID="hero-select-confirm"
        >
          <Text style={styles.confirmTxt}>{saving ? "SAVING..." : "SET AS LEAD HERO"}</Text>
          <Ionicons name="checkmark-circle" size={18} color={COLORS.onBrand} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center",
    gap: SPACING.md, padding: SPACING.lg, paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  kicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 22, fontWeight: "300", marginTop: 2 },
  lead: {
    color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 18,
    fontStyle: "italic", paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm,
  },
  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  card: {
    width: "47%", backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.lg, borderWidth: 2,
    overflow: "hidden", gap: SPACING.sm,
  },
  portraitWrap: {
    width: "100%", aspectRatio: 0.75,
    borderBottomWidth: 1.5, overflow: "hidden",
    backgroundColor: COLORS.surfaceTertiary,
  },
  portrait: { width: "100%", height: "100%" },
  selectedBadge: {
    position: "absolute", top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  cardInfo: { padding: SPACING.sm, gap: 4 },
  heroName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "600" },
  heroTitle: { color: COLORS.onSurfaceTertiary, fontSize: 11 },
  elementPill: {
    alignSelf: "flex-start", borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
  },
  elementTxt: { fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  footer: {
    padding: SPACING.lg, paddingTop: SPACING.md,
    borderTopWidth: 1, borderTopColor: COLORS.border, gap: SPACING.sm,
  },
  previewRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    padding: SPACING.sm, borderWidth: 1, borderColor: COLORS.border,
  },
  previewThumb: { width: 44, height: 56, borderRadius: RADIUS.sm },
  previewLabel: { color: COLORS.brand, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  previewName: { color: COLORS.onSurface, fontSize: 15, fontWeight: "500", marginTop: 2 },
  confirmBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: SPACING.sm, backgroundColor: COLORS.brand,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md,
  },
  confirmTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 1.5 },
});
