/**
 * /journey/sagas — Sagas screen
 *
 * First drill-down level of the Journey hierarchy.
 * Lists all Sagas from journeyHierarchy.ts using the BannerCard pattern.
 * Coming-soon Sagas display in a visually distinct locked state.
 * Study/Lessons and Memories banners appear below the Saga list.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
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
  imageKey: "study",
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

export default function SagasScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const playerLevel = player ? playerLevelFromXp(player.xp ?? 0).level : 1;
  const unseen = unseenMemoriesCount(player);

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
        <Text style={s.sectionLabel}>Chapters & Story</Text>

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
                if (!locked) {
                  router.push(dynRoute.saga(saga.id));
                }
              }}
              height={156}
              locked={locked}
              lockLabel={lockLabel}
              testID={`sagas-banner-${saga.id}`}
            />
          );
        })}

        <View style={s.divider} />
        <Text style={s.sectionLabel}>Learning & Memories</Text>

        <BannerCard
          mode={STUDY_BANNER}
          onPress={() => router.push(ROUTES.STUDY_TAB)}
          height={130}
          testID="sagas-banner-study"
        />

        <View>
          <BannerCard
            mode={MEMORIES_BANNER}
            onPress={() => router.push(ROUTES.storyScene)}
            height={130}
            testID="sagas-banner-memories"
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
  scroll: { padding: SPACING.md, gap: SPACING.sm, paddingBottom: SPACING.xl },
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
