/**
 * (tabs)/journey — Journey hub.
 *
 * Banner-hub landing page (same pattern as the Shift / Shop hubs) with three
 * illustrated destinations:
 *   · University — lessons, recruitment, training
 *   · Chapters   — the shared /journey chapter-map screen
 *   · Memories   — the story-scene gallery; unseen memories carry a red badge
 *     that cascades up: memory card → Memories banner → Journey tab icon.
 */
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import { type ModeCardDef } from "@/src/game/modeHub";
import { ROUTES } from "@/src/game/routes";
import { unseenMemoriesCount } from "@/src/game/storyScenes";
import { usePlayer } from "@/src/game/store";
import { SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

const BANNERS: Record<string, ModeCardDef> = {
  university: {
    id: "journey-university",
    title: "University",
    subtitle: "Lessons · Recruitment · Training",
    icon: "school",
    accentColor: "#E8C868",
    status: "active",
    size: "large",
    artBrief: "",
    imageKey: "university",
  } as ModeCardDef,
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

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Journey</Text>
        <Text style={s.subtitle}>Your path through the Grand Ward</Text>

        <BannerCard
          mode={BANNERS.university}
          onPress={() => router.push(ROUTES.UNIVERSITY)}
          height={140}
          testID="journey-banner-university"
        />
        <BannerCard
          mode={BANNERS.chapters}
          onPress={() => router.push(ROUTES.JOURNEY)}
          height={140}
          testID="journey-banner-chapters"
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
