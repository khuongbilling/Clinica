/**
 * (tabs)/journey — Journey landing page.
 *
 * Shows Saga banners. Tapping a Saga navigates to its Books screen.
 * Hierarchy: Journey → Sagas → Books → Chapters → Ward Shift (fog-map)
 */
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { JOURNEY_SAGAS } from "@/src/game/journeyHierarchy";
import type { ModeCardDef } from "@/src/game/modeHub";
import { dynRoute } from "@/src/game/routes";
import { COLORS, SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

export default function JourneyTab() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Page header */}
        <View style={s.header}>
          <Text style={s.kicker}>JOURNEY</Text>
          <Text style={s.title}>Sagas</Text>
          <Text style={s.subtitle}>Choose your arc and begin the healer's path</Text>
        </View>

        {/* One banner per Saga */}
        {JOURNEY_SAGAS.map((saga) => {
          const locked = saga.status === "coming_soon";

          const mode: ModeCardDef = {
            id:          saga.id,
            title:       saga.title,
            subtitle:    saga.subtitle,
            icon:        "map",
            accentColor: saga.accentColor,
            status:      locked ? "coming_soon" : "active",
            size:        "large",
            artBrief:    "",
            imageKey:    saga.imageKey,
          };

          return (
            <BannerCard
              key={saga.id}
              mode={mode}
              onPress={() => {
                if (!locked) router.push(dynRoute.saga(saga.id));
              }}
              height={180}
              locked={locked}
              lockLabel={locked ? "Coming Soon" : undefined}
              testID={`journey-saga-${saga.id}`}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: UI.sanctuaryBg },
  scroll: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
  header: { marginBottom: SPACING.sm },
  kicker: {
    color: UI.gold, fontSize: 11, fontWeight: "800", letterSpacing: 1.5,
  },
  title: {
    color: UI.text, fontSize: 28, fontWeight: "700", fontFamily: SERIF,
    letterSpacing: 0.5, marginTop: 2,
  },
  subtitle: {
    color: UI.textDim, fontSize: 13, lineHeight: 18, marginTop: 4,
  },
});
