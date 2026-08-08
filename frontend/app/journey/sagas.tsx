/**
 * /journey/sagas — Sagas list (deep-link / multi-saga fallback)
 *
 * Reached by direct link or when the player wants to pick a specific Saga.
 * For now, Saga I is active and Saga II is a locked teaser. Tapping a Saga
 * navigates forward to its Ages screen.
 *
 * The primary entry point is the Journey tab itself, which already shows Ages
 * from the active Saga. This route exists for deep-links and for when Saga II
 * ships as a separate selectable arc.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { JOURNEY_SAGAS, isNodeLocked } from "@/src/game/journeyHierarchy";
import type { ModeCardDef } from "@/src/game/modeHub";
import { playerLevelFromXp } from "@/src/game/progression";
import { dynRoute } from "@/src/game/routes";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

export default function SagasScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const playerLevel = player ? playerLevelFromXp(player.xp ?? 0).level : 1;

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10} testID="sagas-back">
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>JOURNEY</Text>
          <Text style={s.title}>Sagas</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>
          Each Saga is a self-contained arc of the healer's journey. Saga I is
          open — the rest will unlock as the story expands.
        </Text>

        {JOURNEY_SAGAS.map((saga) => {
          const locked = isNodeLocked(saga, playerLevel);
          const lockLabel = saga.unlockCondition
            ? saga.unlockCondition.label
            : saga.status === "coming_soon"
            ? "Coming Soon"
            : undefined;

          const mode: ModeCardDef = {
            id: saga.id,
            title: saga.title,
            subtitle: saga.subtitle,
            icon: "map",
            accentColor: saga.accentColor,
            status: saga.status === "coming_soon" ? "coming_soon" : "active",
            size: "large",
            artBrief: "",
            imageKey: saga.imageKey,
          };

          return (
            <BannerCard
              key={saga.id}
              mode={mode}
              onPress={() => {
                if (!locked) router.push(dynRoute.saga(saga.id));
              }}
              height={160}
              locked={locked}
              lockLabel={lockLabel}
              testID={`sagas-banner-${saga.id}`}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: UI.sanctuaryBg },
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
