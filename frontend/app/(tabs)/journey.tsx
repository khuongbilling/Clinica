/**
 * (tabs)/journey — Journey hub.
 *
 * Banner-hub landing page (same pattern as the Shift / Shop hubs) with four
 * illustrated destinations:
 *   · Chapters     — the shared /journey chapter-map screen
 *   · Study/Lessons — University content via the hidden /(tabs)/study route
 *   · Memories     — the story-scene gallery; unseen memories carry a red badge
 *     that cascades up: memory card → Memories banner → Journey tab icon.
 */
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { getCurrentChapter } from "@/src/game/chapterJourney";
import { FEATURE_FLAG_JOURNEY_FOG_MAP_V1 } from "@/src/game/featureFlags";
import { type ModeCardDef } from "@/src/game/modeHub";
import { playerLevelFromXp } from "@/src/game/progression";
import { ROUTES, dynRoute, type AppRoute } from "@/src/game/routes";
import { unseenMemoriesCount } from "@/src/game/storyScenes";
import { usePlayer } from "@/src/game/store";
import { SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

const BANNERS: Record<string, ModeCardDef> = {
  chapters: {
    id: "journey-chapters",
    title: "Chapters",
    subtitle: "Follow the story across the wards",
    icon: "map",
    accentColor: "#4FD8C4",
    status: "active",
    size: "large",
    artBrief: "",
    imageKey: "journey-chapters",
  } as ModeCardDef,
  study: {
    id: "journey-study",
    title: "Study · Lessons",
    subtitle: "Clinical cases, cue labs, and training",
    icon: "school",
    accentColor: "#E8C868",
    status: "active",
    size: "large",
    artBrief: "",
    imageKey: "study",
  } as ModeCardDef,
  memories: {
    id: "journey-memories",
    title: "Memories",
    subtitle: "Relive the moments you've unlocked",
    icon: "sparkles",
    accentColor: "#BBA7EA",
    status: "active",
    size: "large",
    artBrief: "",
    imageKey: "journey-memories",
  } as ModeCardDef,
};

export default function JourneyHub() {
  const router = useRouter();
  const { player } = usePlayer();
  const unseen = unseenMemoriesCount(player);

  // Derive the player's current chapter so the Chapters banner can skip the
  // chapter-list screen and open the fog-map directly (2 taps instead of 3).
  const playerLevel   = player ? playerLevelFromXp(player.xp ?? 0).level : 1;
  const claimedNodes  = player?.claimed_journey_nodes ?? [];
  const currentChapter = player ? getCurrentChapter(playerLevel, claimedNodes) : null;

  function handleChaptersBannerPress() {
    if (FEATURE_FLAG_JOURNEY_FOG_MAP_V1 && currentChapter) {
      // Push 16: go directly to the fog-map for the player's current chapter.
      // The old /journey chapter-list screen remains reachable via the back
      // button on the fog-map for players who want to browse other chapters.
      router.push(dynRoute.chapterFogMap(String(currentChapter.number)) as AppRoute);
    } else {
      router.push(ROUTES.JOURNEY);
    }
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Journey</Text>
        <Text style={s.subtitle}>Your path through the Grand Ward</Text>

        <BannerCard
          mode={{
            ...BANNERS.chapters,
            // Show the active chapter name when the fog-map flag is on and the
            // player is loaded, so the banner reads as a live shortcut.
            subtitle: FEATURE_FLAG_JOURNEY_FOG_MAP_V1 && currentChapter
              ? `Ch.${currentChapter.number} · ${currentChapter.theme}`
              : BANNERS.chapters.subtitle,
          }}
          onPress={handleChaptersBannerPress}
          height={140}
          testID="journey-banner-chapters"
        />
        <BannerCard
          mode={BANNERS.study}
          onPress={() => router.push(ROUTES.STUDY_TAB)}
          height={140}
          testID="journey-banner-study"
        />
        <View>
          <BannerCard
            mode={BANNERS.memories}
            onPress={() => router.push(ROUTES.storyScene)}
            height={140}
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
  title: {
    color: UI.text, fontSize: 26, fontWeight: "700", fontFamily: SERIF,
    letterSpacing: 0.5,
  },
  subtitle: {
    color: UI.textDim, fontSize: 13, marginBottom: SPACING.sm,
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
