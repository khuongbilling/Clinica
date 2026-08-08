/**
 * /journey/saga/[sagaId]/ages — Ages screen
 *
 * Second drill-down level: shows all Ages within a Saga.
 * Navigates forward to the Books screen on tap.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { getSaga, isNodeLocked } from "@/src/game/journeyHierarchy";
import type { ModeCardDef } from "@/src/game/modeHub";
import { playerLevelFromXp } from "@/src/game/progression";
import { dynRoute } from "@/src/game/routes";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

export default function AgesScreen() {
  const { sagaId } = useLocalSearchParams<{ sagaId: string }>();
  const router = useRouter();
  const { player } = usePlayer();
  const playerLevel = player ? playerLevelFromXp(player.xp ?? 0).level : 1;

  const saga = getSaga(sagaId ?? "");

  if (!saga) {
    return (
      <SafeAreaView style={[s.root, s.center]} edges={["top"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10} testID="ages-back">
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{saga.title.toUpperCase()}</Text>
          <Text style={s.title}>Ages</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>{saga.subtitle}</Text>

        {saga.ages.map((age) => {
          const locked = isNodeLocked(age, playerLevel);
          const lockLabel = age.unlockCondition
            ? age.unlockCondition.label
            : age.status === "coming_soon"
            ? "Coming Soon"
            : undefined;

          const mode: ModeCardDef = {
            id: age.id,
            title: age.title,
            subtitle: age.subtitle,
            icon: "time",
            accentColor: age.accentColor,
            status: age.status === "coming_soon" ? "coming_soon" : "active",
            size: "large",
            artBrief: "",
            imageKey: age.imageKey,
          };

          return (
            <BannerCard
              key={age.id}
              mode={mode}
              onPress={() => {
                if (!locked) {
                  router.push(dynRoute.age(saga.id, age.id));
                }
              }}
              height={148}
              locked={locked}
              lockLabel={lockLabel}
              testID={`ages-banner-${age.id}`}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: UI.sanctuaryBg },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  kicker: {
    color: UI.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.2,
  },
  title: {
    color: UI.text, fontSize: 24, fontWeight: "700", fontFamily: SERIF,
    letterSpacing: 0.5,
  },
  intro: {
    color: UI.textDim, fontSize: 13, lineHeight: 19, marginBottom: SPACING.sm,
  },
  scroll: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
});
