/**
 * /journey/saga/[sagaId]/book/[bookId]/chapters — Chapter banners for a Book
 *
 * Shows all chapters in the Book's range. Available chapters are tappable
 * and route directly to the fog-map. Locked chapters are shown dimmed.
 * Coming-soon Books beyond Ch.10 show nothing here (gated at Book level).
 *
 * Hierarchy: Journey → Sagas → Books → Chapters → Ward Shift (fog-map)
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getBookChapters,
  getBookFromSaga,
} from "@/src/game/journeyHierarchy";
import {
  getChapterStatus,
  type Chapter,
  type ChapterStatus,
} from "@/src/game/chapterJourney";
import { playerLevelFromXp } from "@/src/game/progression";
import { dynRoute, type AppRoute } from "@/src/game/routes";
import { usePlayer } from "@/src/game/store";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { SERIF, UI } from "@/src/theme/ui";

// Chapter map backgrounds — one per chapter for Ch1–5, generic fallback for rest
const CHAPTER_MAP_BG: Record<number, ReturnType<typeof require>> = {
  1: require("@/assets/map-bg/ch1_lotus_sanctuary.png"),
  2: require("@/assets/map-bg/ch2_amber_ward.png"),
  3: require("@/assets/map-bg/ch3_sky_citadel.png"),
  4: require("@/assets/map-bg/ch4_crimson_rush.png"),
  5: require("@/assets/map-bg/ch5_emerald_forest.png"),
};
const CHAPTER_MAP_BG_FALLBACK = require("@/assets/map-bg/ch_generic.png");

function chapterBg(n: number) {
  return CHAPTER_MAP_BG[n] ?? CHAPTER_MAP_BG_FALLBACK;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ChapterStatus }) {
  if (status === "complete") {
    return (
      <View style={[badge.pill, { backgroundColor: "#16a34a22", borderColor: "#16a34a44" }]}>
        <Ionicons name="checkmark-circle" size={12} color="#4ade80" />
        <Text style={[badge.txt, { color: "#4ade80" }]}>Complete</Text>
      </View>
    );
  }
  if (status === "active") {
    return (
      <View style={[badge.pill, { backgroundColor: "#D4AF3722", borderColor: "#D4AF3744" }]}>
        <Ionicons name="play-circle" size={12} color="#D4AF37" />
        <Text style={[badge.txt, { color: "#D4AF37" }]}>Available</Text>
      </View>
    );
  }
  return (
    <View style={[badge.pill, { backgroundColor: "#33333344", borderColor: "#33333366" }]}>
      <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary} />
      <Text style={[badge.txt, { color: COLORS.onSurfaceTertiary }]}>Locked</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  pill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1,
  },
  txt: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
});

// ── Chapter card ──────────────────────────────────────────────────────────────

function ChapterCard({
  chapter,
  status,
  onPress,
}: {
  chapter: Chapter;
  status:  ChapterStatus;
  onPress: () => void;
}) {
  const locked = status === "locked";
  const bg     = chapterBg(chapter.number);

  return (
    <Pressable
      style={[card.root, locked && card.rootLocked]}
      onPress={locked ? undefined : onPress}
      disabled={locked}
      testID={`chapter-card-${chapter.number}`}
    >
      {/* Background illustration */}
      <Image
        source={bg}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      {/* Dark scrim */}
      <View style={[StyleSheet.absoluteFillObject, card.scrim, locked && card.scrimLocked]} />

      {/* Content */}
      <View style={card.content}>
        <View style={card.topRow}>
          <Text style={[card.chNum, { color: chapter.accentColor }]}>
            Chapter {chapter.number}
          </Text>
          <StatusBadge status={status} />
        </View>
        <Text style={card.theme} numberOfLines={2}>{chapter.theme}</Text>
      </View>

      {/* Arrow CTA */}
      {!locked && (
        <View style={[card.arrow, { backgroundColor: chapter.accentColor + "22" }]}>
          <Ionicons name="arrow-forward" size={18} color={chapter.accentColor} />
        </View>
      )}
    </Pressable>
  );
}

const card = StyleSheet.create({
  root: {
    borderRadius: RADIUS.lg,
    height: 110,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  rootLocked: { opacity: 0.45 },
  scrim: {
    backgroundColor: "rgba(5,10,18,0.62)",
  },
  scrimLocked: {
    backgroundColor: "rgba(5,10,18,0.80)",
  },
  content: {
    flex: 1,
    padding: SPACING.md,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  chNum: {
    fontSize: 11, fontWeight: "800", letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  theme: {
    color: UI.text,
    fontSize: 16, fontWeight: "700", fontFamily: SERIF,
    lineHeight: 21,
  },
  arrow: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: "center", justifyContent: "center",
    marginRight: SPACING.md,
  },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function BookChaptersScreen() {
  const { sagaId, bookId } = useLocalSearchParams<{ sagaId: string; bookId: string }>();
  const router   = useRouter();
  const { player } = usePlayer();
  const playerLevel  = player ? playerLevelFromXp(player.xp ?? 0).level : 1;
  const claimedNodes = player?.claimed_journey_nodes ?? [];

  const book     = getBookFromSaga(sagaId ?? "", bookId ?? "");
  const chapters = book ? getBookChapters(book) : [];

  // Only show chapters up to (and including) the first locked one — so players
  // can see what's coming next without seeing a wall of locked cards.
  const visibleChapters = (() => {
    const firstLockedIdx = chapters.findIndex(
      (ch) => getChapterStatus(ch, playerLevel, claimedNodes) === "locked",
    );
    if (firstLockedIdx === -1) return chapters;          // all active/complete
    return chapters.slice(0, firstLockedIdx + 1);       // include first locked as teaser
  })();

  if (!book) {
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
        <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={10} testID="chapters-back">
          <Ionicons name="chevron-back" size={22} color={COLORS.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>{book.title.toUpperCase()}</Text>
          <Text style={s.title}>Chapters</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>{book.subtitle}</Text>

        {visibleChapters.map((ch) => {
          const status = getChapterStatus(ch, playerLevel, claimedNodes);
          return (
            <ChapterCard
              key={ch.id}
              chapter={ch}
              status={status}
              onPress={() =>
                router.push(
                  dynRoute.chapterFogMap(String(ch.number)) as AppRoute,
                )
              }
            />
          );
        })}

        {/* Show a hint when more chapters are locked beyond the teaser */}
        {chapters.length > visibleChapters.length && (
          <View style={s.moreHint}>
            <Ionicons name="lock-closed" size={14} color={UI.textDim} />
            <Text style={s.moreHintTxt}>
              {chapters.length - visibleChapters.length} more chapter
              {chapters.length - visibleChapters.length !== 1 ? "s" : ""} unlock as you progress
            </Text>
          </View>
        )}
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
  moreHint: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: SPACING.sm, justifyContent: "center",
  },
  moreHintTxt: {
    color: UI.textDim, fontSize: 12, fontStyle: "italic",
  },
});
