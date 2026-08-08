/**
 * (tabs)/journey — Sagas landing page.
 *
 * This IS the Sagas screen — no intermediate hub.
 * Journey hierarchy: Journey → Sagas → Age → Books → Chapter Nodes → Ward Shift
 *
 * Layout:
 *   • Ages within the active Saga (Age of Foundation prominently, locked Ages below)
 *   • Study · Lessons and Memories banners at the foot
 */
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { JOURNEY_SAGAS, isNodeLocked } from "@/src/game/journeyHierarchy";
import type { ModeCardDef } from "@/src/game/modeHub";
import { playerLevelFromXp } from "@/src/game/progression";
import { ROUTES, dynRoute } from "@/src/game/routes";
import { unseenMemoriesCount } from "@/src/game/storyScenes";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

const STUDY_BANNER: ModeCardDef = {
  id: "journey-study",
  title: "Study · Lessons",
  subtitle: "Clinical cases, cue labs, and training",
  icon: "school",
  accentColor: "#E8C868",
  status: "active",
  size: "large",
  artBrief: "",
  imageKey: "uni-lessons",
};

const MEMORIES_BANNER: ModeCardDef = {
  id: "journey-memories",
  title: "Memories",
  subtitle: "Relive the moments you've unlocked",
  icon: "sparkles",
  accentColor: "#BBA7EA",
  status: "active",
  size: "large",
  artBrief: "",
  imageKey: "journey-memories",
};

export default function JourneyTab() {
  const router = useRouter();
  const { player } = usePlayer();
  const playerLevel = player ? playerLevelFromXp(player.xp ?? 0).level : 1;
  const unseen = unseenMemoriesCount(player);

  // The active Saga is always the first unlocked one. For now, Saga I is the
  // only active saga — its ages are shown directly on this landing page.
  const activeSaga = JOURNEY_SAGAS.find((s) => s.status === "active") ?? JOURNEY_SAGAS[0];
  const ages = activeSaga?.ages ?? [];

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Page header */}
        <View style={s.header}>
          <Text style={s.kicker}>JOURNEY</Text>
          <Text style={s.title}>Sagas</Text>
          <Text style={s.subtitle}>{activeSaga?.subtitle ?? "Your path through the Grand Ward"}</Text>
        </View>

        {/* Ages — the main content of the Sagas landing */}
        <Text style={s.sectionLabel}>Ages</Text>
        {ages.map((age) => {
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
                if (!locked) router.push(dynRoute.age(activeSaga.id, age.id));
              }}
              height={156}
              locked={locked}
              lockLabel={lockLabel}
              testID={`journey-age-${age.id}`}
            />
          );
        })}

        {/* Future sagas teaser — only show when more than one saga is defined */}
        {JOURNEY_SAGAS.filter((sg) => sg.id !== activeSaga?.id).map((saga) => {
          const mode: ModeCardDef = {
            id: saga.id,
            title: saga.title,
            subtitle: saga.subtitle,
            icon: "map",
            accentColor: saga.accentColor,
            status: "coming_soon",
            size: "large",
            artBrief: "",
            imageKey: saga.imageKey,
          };
          return (
            <BannerCard
              key={saga.id}
              mode={mode}
              onPress={() => {/* locked */}}
              height={120}
              locked
              lockLabel="Coming Soon"
              testID={`journey-saga-${saga.id}`}
            />
          );
        })}

        {/* Study & Memories */}
        <View style={s.divider} />
        <Text style={s.sectionLabel}>Learning & Memories</Text>

        <BannerCard
          mode={STUDY_BANNER}
          onPress={() => router.push(ROUTES.STUDY_TAB)}
          height={120}
          testID="journey-banner-study"
        />

        <View>
          <BannerCard
            mode={MEMORIES_BANNER}
            onPress={() => router.push(ROUTES.storyScene)}
            height={120}
            testID="journey-banner-memories"
          />
          {unseen > 0 && (
            <View style={s.badge} pointerEvents="none">
              <Text style={s.badgeTxt}>{unseen > 9 ? "9+" : unseen}</Text>
            </View>
          )}
        </View>
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
  sectionLabel: {
    color: UI.textDim, fontSize: 11, fontWeight: "700", letterSpacing: 1.1,
    textTransform: "uppercase", marginBottom: 2,
  },
  divider: {
    height: 1, backgroundColor: UI.border, marginVertical: SPACING.sm,
  },
  badge: {
    position: "absolute", top: -5, right: -3,
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: "#E5484D",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: UI.sanctuaryBg,
  },
  badgeTxt: { color: "#FFF", fontSize: 11, fontWeight: "800" },
});
