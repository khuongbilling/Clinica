/**
 * (tabs)/journey — Journey landing page.
 *
 * Shows Saga banners. Tapping a Saga navigates to its Books screen.
 * Hierarchy: Journey → Sagas → Books → Chapters → Ward Shift (fog-map)
 */
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { ActivityEntryGate } from "@/src/components/FeatureGate";
import { JOURNEY_SAGAS } from "@/src/game/journeyHierarchy";
import type { ModeCardDef } from "@/src/game/modeHub";
import { UNIVERSITY_HUB_MODE } from "@/src/game/modeHub";
import { usePlayer } from "@/src/game/store";
import { unseenMemoriesCount } from "@/src/game/storyScenes";
import type { AppRoute } from "@/src/game/routes";
import { dynRoute, ROUTES } from "@/src/game/routes";
import { SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

/** Memories banner — story scenes gallery, lives on the old /journey screen's Memories tab. */
const MEMORIES_MODE: ModeCardDef = {
  id:          "journey-memories",
  title:       "Memories",
  subtitle:    "Relive the story scenes and memory fragments you have gathered.",
  icon:        "sparkles",
  accentColor: "#E0B45C",
  status:      "active",
  size:        "large",
  artBrief:    "",
  imageKey:    "journey-memories",
};

export default function JourneyTab() {
  return <ActivityEntryGate activityId="journey" title="Journey" fallback={ROUTES.tabs}><JourneyContent /></ActivityEntryGate>;
}

function JourneyContent() {
  const router = useRouter();
  const { player } = usePlayer();
  const newMemories = unseenMemoriesCount(player);

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Only the first (active) Saga — upcoming sagas stay hidden */}
        {JOURNEY_SAGAS.filter((saga) => saga.status !== "coming_soon").map((saga) => {
          const mode: ModeCardDef = {
            id:          saga.id,
            title:       saga.title,
            subtitle:    saga.subtitle,
            icon:        "map",
            accentColor: saga.accentColor,
            status:      "active",
            size:        "large",
            artBrief:    "",
            imageKey:    saga.imageKey,
          };

          return (
            <BannerCard
              key={saga.id}
              mode={mode}
              onPress={() => router.push(dynRoute.saga(saga.id))}
              height={180}
              testID={`journey-saga-${saga.id}`}
            />
          );
        })}

        {/* University — study path, directly below the saga */}
        <BannerCard
          mode={UNIVERSITY_HUB_MODE}
          onPress={() => router.push(ROUTES.university)}
          height={180}
          testID="journey-university"
        />

        {/* Memories — story scene gallery, below University */}
        <BannerCard
          mode={{
            ...MEMORIES_MODE,
            subtitle: newMemories > 0
              ? `${newMemories} new ${newMemories === 1 ? "memory" : "memories"} to relive.`
              : MEMORIES_MODE.subtitle,
          }}
          onPress={() => router.push("/journey?tab=memories" as AppRoute)}
          height={180}
          testID="journey-memories"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: UI.sanctuaryBg },
  scroll: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
});
