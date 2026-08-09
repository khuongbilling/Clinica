/**
 * /journey/saga/[sagaId]/books — Books in a Saga
 *
 * Flat list of all Books in the Saga (Ages are a data grouping only, not
 * a navigation layer). Tapping a Book navigates to its Chapter banners.
 *
 * Hierarchy: Journey → Sagas → Books → Chapters → Ward Shift (fog-map)
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BannerCard } from "@/src/components/ModeBanners";
import {
  getSaga,
  getSagaBooks,
  isNodeLocked,
  type JourneyBook,
} from "@/src/game/journeyHierarchy";
import type { ModeCardDef } from "@/src/game/modeHub";
import { getChapterStatus } from "@/src/game/chapterJourney";
import { getBookChapters } from "@/src/game/journeyHierarchy";
import { ENEMIES } from "@/src/game/content";
import { playerLevelFromXp } from "@/src/game/progression";
import { dynRoute, type AppRoute } from "@/src/game/routes";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

function buildBookProgress(
  book: JourneyBook,
  playerLevel: number,
  claimedNodes: string[],
): string {
  const [min, max] = book.chapterRange;
  const chapters   = getBookChapters(book);
  const completed  = chapters.filter(
    (ch) => getChapterStatus(ch, playerLevel, claimedNodes) === "complete",
  ).length;
  const total = chapters.length;
  const range = `Ch. ${min}–${max}`;
  if (completed === 0) return `${range} · Begin your journey`;
  if (completed === total) return `${range} · All chapters complete ✓`;
  return `${range} · ${completed}/${total} chapters complete`;
}

/**
 * Sum all battle stars earned for enemies whose difficulty falls within this
 * book's chapter range. battle_stars is keyed by enemy id, value is 0-3.
 */
function getBookStarCount(
  book: JourneyBook,
  battleStars: Record<string, number>,
): number {
  const [min, max] = book.chapterRange;
  return ENEMIES
    .filter((e) => e.difficulty >= min && e.difficulty <= max)
    .reduce((sum, e) => sum + (battleStars[e.id] ?? 0), 0);
}

/** Compact segmented progress bar + star count shown on each Book card. */
function BookProgressBadge({
  completed,
  total,
  stars,
  accentColor,
}: {
  completed: number;
  total: number;
  stars: number;
  accentColor: string;
}) {
  return (
    <View style={pb.row}>
      <View style={pb.segments}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              pb.segment,
              {
                backgroundColor:
                  i < completed ? accentColor : "rgba(255,255,255,0.18)",
              },
            ]}
          />
        ))}
      </View>
      {stars > 0 && (
        <View style={pb.starRow}>
          <Ionicons name="star" size={10} color="#F59E0B" />
          <Text style={pb.starTxt}>{stars}</Text>
        </View>
      )}
    </View>
  );
}

const pb = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: 5,
  },
  segments: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  starRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  starTxt: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "700",
  },
});

export default function SagaBooksScreen() {
  const { sagaId } = useLocalSearchParams<{ sagaId: string }>();
  const router     = useRouter();
  const { player } = usePlayer();
  const playerLevel  = player ? playerLevelFromXp(player.xp ?? 0).level : 1;
  const claimedNodes = player?.claimed_journey_nodes ?? [];
  const battleStars  = player?.battle_stars ?? {};

  const saga  = getSaga(sagaId ?? "");
  const books = getSagaBooks(sagaId ?? "");

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
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10} testID="saga-books-back">
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{saga.title.toUpperCase()}</Text>
          <Text style={s.title}>Books</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>{saga.subtitle}</Text>

        {books.map((book) => {
          const locked = isNodeLocked(book, playerLevel);
          const lockLabel = book.unlockCondition
            ? book.unlockCondition.label
            : book.status === "coming_soon"
            ? "Coming Soon"
            : undefined;

          const subtitle = locked
            ? book.subtitle
            : buildBookProgress(book, playerLevel, claimedNodes);

          const chapters  = getBookChapters(book);
          const completed = locked
            ? 0
            : chapters.filter(
                (ch) => getChapterStatus(ch, playerLevel, claimedNodes) === "complete",
              ).length;
          const stars = locked ? 0 : getBookStarCount(book, battleStars);

          const mode: ModeCardDef = {
            id:          book.id,
            title:       book.title,
            subtitle,
            icon:        "book",
            accentColor: book.accentColor,
            status:      book.status === "coming_soon" ? "coming_soon" : "active",
            size:        "large",
            artBrief:    "",
            imageKey:    book.imageKey,
          };

          return (
            <BannerCard
              key={book.id}
              mode={mode}
              onPress={() => {
                if (!locked) {
                  router.push(
                    dynRoute.bookChapters(sagaId ?? "", book.id) as AppRoute,
                  );
                }
              }}
              height={160}
              locked={locked}
              lockLabel={lockLabel}
              footerContent={
                !locked ? (
                  <BookProgressBadge
                    completed={completed}
                    total={chapters.length}
                    stars={stars}
                    accentColor={book.accentColor}
                  />
                ) : null
              }
              testID={`saga-books-banner-${book.id}`}
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
    alignItems:    "center",
    paddingHorizontal: SPACING.md,
    paddingTop:    SPACING.sm,
    paddingBottom: SPACING.xs,
    gap:           SPACING.sm,
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
