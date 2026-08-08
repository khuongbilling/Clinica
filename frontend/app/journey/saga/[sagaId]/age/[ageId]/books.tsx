/**
 * /journey/saga/[sagaId]/age/[ageId]/books — Books screen
 *
 * Third drill-down level: shows all Books within an Age.
 * Each Book card shows the chapter range and the player's progress.
 * Navigates to the chapter-list screen (/journey?bookId=…) on tap.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import {
  getAge,
  getBookChapters,
  isNodeLocked,
  type JourneyBook,
} from "@/src/game/journeyHierarchy";
import type { ModeCardDef } from "@/src/game/modeHub";
import { getChapterStatus } from "@/src/game/chapterJourney";
import { playerLevelFromXp } from "@/src/game/progression";
import { dynRoute, type AppRoute } from "@/src/game/routes";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

/** Build a subtitle for a Book card that includes the chapter range and progress. */
function buildBookSubtitle(
  book: JourneyBook,
  playerLevel: number,
  claimedNodes: string[],
): string {
  const [min, max] = book.chapterRange;
  const chapters = getBookChapters(book);
  const completed = chapters.filter(
    (ch) => getChapterStatus(ch, playerLevel, claimedNodes) === "complete",
  ).length;
  const total = chapters.length;
  const rangeLabel = `Ch. ${min}–${max}`;
  const progressLabel = completed > 0
    ? `${completed}/${total} chapters complete`
    : "Begin your journey";
  return `${rangeLabel} · ${progressLabel}`;
}

export default function BooksScreen() {
  const { sagaId, ageId } = useLocalSearchParams<{ sagaId: string; ageId: string }>();
  const router = useRouter();
  const { player } = usePlayer();
  const playerLevel = player ? playerLevelFromXp(player.xp ?? 0).level : 1;
  const claimedNodes = player?.claimed_journey_nodes ?? [];

  const age = getAge(sagaId ?? "", ageId ?? "");

  if (!age) {
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
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10} testID="books-back">
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{age.title.toUpperCase()}</Text>
          <Text style={s.title}>Books</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>{age.subtitle}</Text>

        {age.books.map((book) => {
          const locked = isNodeLocked(book, playerLevel);
          const lockLabel = book.unlockCondition
            ? book.unlockCondition.label
            : book.status === "coming_soon"
            ? "Coming Soon"
            : undefined;

          const subtitle = locked
            ? book.subtitle
            : buildBookSubtitle(book, playerLevel, claimedNodes);

          const mode: ModeCardDef = {
            id: book.id,
            title: book.title,
            subtitle,
            icon: "book",
            accentColor: book.accentColor,
            status: book.status === "coming_soon" ? "coming_soon" : "active",
            size: "large",
            artBrief: "",
            imageKey: book.imageKey,
          };

          return (
            <BannerCard
              key={book.id}
              mode={mode}
              onPress={() => {
                if (!locked) {
                  router.push(
                    dynRoute.book(sagaId ?? "", ageId ?? "", book.id) as AppRoute,
                  );
                }
              }}
              height={148}
              locked={locked}
              lockLabel={lockLabel}
              testID={`books-banner-${book.id}`}
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
