import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { HEROES, RANKS } from "@/src/game/content";
import { getHeroSprite } from "@/src/components/HeroSprites";
import { usePlayer } from "@/src/game/store";
import { COLORS, ELEMENT_COLORS, RADIUS, SPACING } from "@/src/theme/colors";

function Stars({ count, color }: { count: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 3 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Ionicons key={i} name="star" size={12} color={color} />
      ))}
    </View>
  );
}

export default function HeroProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { player, saveActiveTeam } = usePlayer();

  const hero = HEROES.find((h) => h.id === id);

  if (!hero || !player) {
    return (
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={COLORS.onSurface} />
          <Text style={styles.backTxt}>Heroes</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: COLORS.onSurfaceTertiary }}>Hero not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const accent    = ELEMENT_COLORS[hero.element] ?? COLORS.brand;
  const portrait  = getHeroSprite(hero.id);
  const isOwned   = player.heroes_owned.includes(hero.id);
  const inTeam    = player.active_team.includes(hero.id);
  const teamSlot  = player.active_team.indexOf(hero.id) + 1;
  const teamFull  = player.active_team.length >= 3;

  const nextRank = RANKS[player.rank_index + 1];
  const progress = nextRank
    ? Math.min(1, (player.xp - RANKS[player.rank_index].xpRequired) /
                  (nextRank.xpRequired - RANKS[player.rank_index].xpRequired))
    : 1;

  const toggleTeam = async () => {
    if (!isOwned) return;
    const cur = player.active_team;
    if (inTeam) {
      if (cur.length <= 1) return;
      await saveActiveTeam(cur.filter((x) => x !== hero.id));
    } else {
      if (teamFull) return;
      await saveActiveTeam([...cur, hero.id]);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── BACK NAV ── */}
        <Pressable style={styles.backBtn} onPress={() => router.back()} testID="hero-profile-back">
          <Ionicons name="chevron-back" size={20} color={COLORS.onSurface} />
          <Text style={styles.backTxt}>Heroes</Text>
        </Pressable>

        {/* ── PORTRAIT STAGE ── */}
        <View style={[styles.portraitStage, { borderColor: accent + "35" }]}>
          {/* Background tint */}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: accent + "0A" }]} />

          {/* Full-body portrait */}
          {portrait ? (
            <Image
              source={portrait}
              style={styles.portrait}
              contentFit="contain"
              contentPosition="center"
            />
          ) : (
            <View style={styles.portraitFallback} />
          )}

          {/* Element glow at feet */}
          <View style={[styles.footGlow, { backgroundColor: accent + "55" }]} />

          {/* Team slot badge */}
          {inTeam && (
            <View style={[styles.teamBadge, { backgroundColor: accent }]}>
              <Text style={styles.teamBadgeTxt}>SLOT {teamSlot}</Text>
            </View>
          )}
        </View>

        {/* ── IDENTITY BLOCK ── */}
        <View style={styles.identityBlock}>
          {/* Stars + element badge row */}
          <View style={styles.identityRow}>
            <Stars count={hero.rarity} color={accent} />
            <View style={[styles.elementBadge, { borderColor: accent + "80", backgroundColor: accent + "15" }]}>
              <Text style={[styles.elementTxt, { color: accent }]}>{hero.element.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.heroName}>{hero.name}</Text>
          <Text style={styles.heroTitle}>{hero.title}</Text>
          <Text style={[styles.heroRole, { color: accent }]}>{hero.role}</Text>

          {/* Quote */}
          {hero.quote && (
            <Text style={[styles.quote, { color: accent + "BB" }]}>"{hero.quote}"</Text>
          )}

          {/* Description */}
          <Text style={styles.description}>{hero.description}</Text>
        </View>

        {/* ── ACTIVE TEAM TOGGLE ── */}
        {isOwned && (
          <Pressable
            style={[
              styles.teamToggleBtn,
              {
                backgroundColor: inTeam ? accent + "18" : COLORS.brand + "18",
                borderColor: inTeam ? accent + "70" : COLORS.brand + "70",
              },
            ]}
            onPress={toggleTeam}
            testID="hero-profile-toggle-team"
          >
            <Ionicons
              name={inTeam ? "checkmark-circle" : teamFull ? "close-circle" : "add-circle"}
              size={18}
              color={inTeam ? accent : teamFull ? COLORS.error : COLORS.brand}
            />
            <Text style={[styles.teamToggleTxt, { color: inTeam ? accent : teamFull ? COLORS.error : COLORS.brand }]}>
              {inTeam ? `Active — Slot ${teamSlot}` : teamFull ? "Team Full (3/3)" : "Add to Active Team"}
            </Text>
          </Pressable>
        )}

        {/* ── MEDICAL FOCUS ── */}
        {hero.medicalFocus && (
          <Section title="Medical Focus" icon="medkit-outline" accent={accent}>
            <Text style={styles.medicalFocusTxt}>{hero.medicalFocus}</Text>
          </Section>
        )}

        {/* ── SKILLS ── */}
        <Section title="Skills & Abilities" icon="flash-outline" accent={accent}>
          {hero.skills.map((s) => (
            <View key={s.id} style={[styles.skillCard, { borderColor: accent + "30" }]}>
              <View style={styles.skillHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.skillName}>{s.name}</Text>
                  <Text style={styles.skillType}>{s.type.toUpperCase()}</Text>
                </View>
                <View style={[styles.apChip, { backgroundColor: accent + "20", borderColor: accent + "60" }]}>
                  <Text style={[styles.apTxt, { color: accent }]}>{s.cost} AP</Text>
                </View>
              </View>
              <Text style={styles.skillDesc}>{s.description}</Text>
              {s.beginnerExplanation && (
                <View style={styles.explainBox}>
                  <Text style={styles.explainLabel}>Beginner</Text>
                  <Text style={styles.explainTxt}>{s.beginnerExplanation}</Text>
                </View>
              )}
              {s.nclexExplanation && (
                <View style={[styles.explainBox, { backgroundColor: COLORS.brand + "08" }]}>
                  <Text style={[styles.explainLabel, { color: COLORS.brand }]}>NCLEX</Text>
                  <Text style={styles.explainTxt}>{s.nclexExplanation}</Text>
                </View>
              )}
            </View>
          ))}
        </Section>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title, icon, accent, children,
}: {
  title: string; icon: string; accent: string; children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name={icon as any} size={14} color={accent} />
        <Text style={[styles.sectionTitle, { color: accent }]}>{title.toUpperCase()}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: COLORS.surface },
  scroll: { paddingBottom: 40 },

  /* Back */
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  backTxt: { color: COLORS.onSurface, fontSize: 15, fontWeight: "500" },

  /* Portrait */
  portraitStage: {
    marginHorizontal: SPACING.md,
    height: 280,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surfaceSecondary,
    position: "relative",
  },
  portrait:        { flex: 1, width: "100%" },
  portraitFallback: {
    width: "60%", height: "60%",
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.lg,
  },
  footGlow: {
    position: "absolute",
    bottom: -20,
    left: "-30%",
    right: "-30%",
    height: 60,
    borderRadius: 999,
  },
  teamBadge: {
    position: "absolute",
    top: SPACING.sm,
    right: SPACING.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.pill,
  },
  teamBadgeTxt: { color: COLORS.surface, fontSize: 10, fontWeight: "700", letterSpacing: 1 },

  /* Identity */
  identityBlock: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    gap: SPACING.xs,
  },
  identityRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: 2 },
  elementBadge: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 3 },
  elementTxt:   { fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  heroName:  { color: COLORS.onSurface, fontSize: 26, fontWeight: "700", letterSpacing: 0.3 },
  heroTitle: { color: COLORS.onSurfaceSecondary, fontSize: 14, marginTop: -2 },
  heroRole:  { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginTop: 2 },
  quote: {
    fontSize: 13, fontStyle: "italic", lineHeight: 19,
    marginTop: SPACING.sm,
    paddingLeft: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: "currentColor",
  },
  description: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },

  /* Team toggle */
  teamToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  teamToggleTxt: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },

  /* Sections */
  section: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    gap: SPACING.sm,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  sectionTitle:  { fontSize: 10, fontWeight: "700", letterSpacing: 2 },

  /* Medical focus */
  medicalFocusTxt: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },

  /* Skills */
  skillCard: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  skillHeader: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  skillName: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  skillType: { color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 1.5, marginTop: 2 },
  apChip: {
    borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: "flex-start",
  },
  apTxt: { fontSize: 11, fontWeight: "700" },
  skillDesc: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19 },
  explainBox: {
    backgroundColor: COLORS.surfaceTertiary,
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    gap: 3,
  },
  explainLabel: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "700", letterSpacing: 1.5 },
  explainTxt:   { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
});
