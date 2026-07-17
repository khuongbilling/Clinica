/**
 * Tutorial Encyclopedia (Push 19)
 *
 * Comprehensive reference + replay hub for every major game system.
 * Grouped by category, shows completion status, and has one-tap replay
 * that routes directly to the correct screen.
 *
 * Opening this screen does NOT reset or modify any tutorial flags.
 * Manual replay goes through replayTutorial() which un-completes that
 * specific tutorial — nothing else changes.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTutorial } from "@/src/game/tutorialStore";
import { type TutorialId } from "@/src/game/tutorials";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ── Types ──────────────────────────────────────────────────────────────────

type SystemStatus = "available" | "coming_soon";

interface EncyclopediaEntry {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  body: string;
  bullets?: string[];
  accentColor: string;
  status: SystemStatus;
  tutorialId?: TutorialId;         // if set, enables the Replay Tutorial button
  replayRoute?: string;            // screen to navigate to after marking replay
  practiceRoute?: string;          // optional direct practice link
  practiceLabel?: string;
}

interface CategorySection {
  label: string;
  emoji: string;
  entries: EncyclopediaEntry[];
}

// ── Data ───────────────────────────────────────────────────────────────────

const CATEGORIES: CategorySection[] = [
  {
    label: "Combat & Shifts",
    emoji: "⚔️",
    entries: [
      {
        id: "ward_shift",
        icon: "medical-outline",
        title: "Ward Shift",
        subtitle: "Turn-based clinical encounters",
        body: "Your main combat mode. Each turn your heroes use AP to cast skills — Scout to reveal clues, Stabilize to protect the patient, Strike to reduce corruption.",
        bullets: [
          "Answer the Clinical Cue first for a bonus",
          "Use End Turn to refresh AP for all heroes",
          "Watch the enemy's Element System for weaknesses",
        ],
        accentColor: "#06B6D4",
        status: "available",
        tutorialId: "firstBattle",
        replayRoute: "/shift",
        practiceRoute: "/shift",
        practiceLabel: "Enter Ward Shift",
      },
      {
        id: "ward_defense",
        icon: "shield-outline",
        title: "Ward Defense",
        subtitle: "Tower-defense wave mode",
        body: "Disease-spirits march along a path toward the Vital Lantern. Deploy hero units on tiles to intercept them. Stronger unit placement and Care Synthesis merges are the key to harder waves.",
        bullets: [
          "AP regenerates over time and on correct answers",
          "Merge two identical same-level units to synthesize a stronger one",
          "Assess units reveal weaknesses; Treat units exploit them",
        ],
        accentColor: "#8B5CF6",
        status: "available",
        tutorialId: "firstWardDefense",
        replayRoute: "/ward-defense",
        practiceRoute: "/ward-defense",
        practiceLabel: "Enter Ward Defense",
      },
    ],
  },
  {
    label: "University Learning",
    emoji: "🎓",
    entries: [
      {
        id: "cue_hunt",
        icon: "eye-outline",
        title: "Cue Hunt",
        subtitle: "Find hidden diagnostic signals",
        body: "Clinical cues are signs hidden in a patient scene. Tap each highlighted zone to reveal a diagnostic clue. Training your eye here makes you faster in real battles.",
        bullets: [
          "All clues are hidden — scan the whole scene",
          "Wrong taps have no effect during guided steps",
          "Correct answers in battles grant bonus stability or AP",
        ],
        accentColor: "#B0DEFF",
        status: "available",
        tutorialId: "cueHuntIntro",
        replayRoute: "/university/cue-hunt",
        practiceRoute: "/university/cue-hunt",
        practiceLabel: "Cue Hunt Lab",
      },
      {
        id: "rapid_triage",
        icon: "shuffle-outline",
        title: "Rapid Triage",
        subtitle: "Sort patients by urgency",
        body: "Three patients arrive at once — only one needs you immediately. Read the clinical signs for each and assign Emergency, Urgent, or Routine correctly.",
        bullets: [
          "Emergency: life-threatening, act now",
          "Urgent: needs care soon, currently stable",
          "Routine: no immediate danger",
        ],
        accentColor: "#F59E0B",
        status: "available",
        tutorialId: "rapidTriageIntro",
        replayRoute: "/university/rapid-triage",
        practiceRoute: "/university/rapid-triage",
        practiceLabel: "Practice Triage",
      },
      {
        id: "stabilize_stack",
        icon: "layers-outline",
        title: "Stabilize Stack",
        subtitle: "Sequence care steps safely",
        body: "In clinical care the order of actions is as important as the actions themselves. Tap each step in the correct safe sequence to stabilize the patient.",
        bullets: [
          "Always assess before you treat",
          "Wrong sequences cause harm — right order saves the patient",
          "Each scenario teaches a different care protocol",
        ],
        accentColor: "#34D399",
        status: "available",
        tutorialId: "stabilizeIntro",
        replayRoute: "/university/stabilize-stack",
        practiceRoute: "/university/stabilize-stack",
        practiceLabel: "Practice Stabilize",
      },
    ],
  },
  {
    label: "Heroes & Recruitment",
    emoji: "👥",
    entries: [
      {
        id: "hero_summoning",
        icon: "sparkles-outline",
        title: "Summoning Hall",
        subtitle: "Recruit your healer team",
        body: "Heroes only come from Recruitment using Summoning Shards. A free daily draw is always available — no shards needed. Each hero has unique skills tied to a body-system element.",
        bullets: [
          "Free daily draw resets every 24 hours",
          "Duplicate heroes convert to Hero Shards for star upgrades",
          "Assign heroes to your active team before battles",
        ],
        accentColor: "#F472B6",
        status: "available",
        tutorialId: "firstSummon",
        replayRoute: "/university/recruit",
        practiceRoute: "/university/recruit",
        practiceLabel: "Open Recruitment",
      },
      {
        id: "hero_team",
        icon: "people-outline",
        title: "Active Team",
        subtitle: "Your battle lineup",
        body: "You can bring up to 3 heroes into each clinical shift. Each hero acts once per turn using their AP. Balanced teams (Scout + Stabilizer + Striker) handle the widest range of cases.",
        bullets: [
          "Tap + on a hero card to add them to your active team",
          "Changes save instantly",
          "Hero levels and skills persist between battles",
        ],
        accentColor: "#A78BFA",
        status: "available",
        tutorialId: "firstHeroTeam",
        replayRoute: "/(tabs)/heroes",
        practiceRoute: "/(tabs)/heroes",
        practiceLabel: "Open Heroes",
      },
      {
        id: "skill_academy",
        icon: "school-outline",
        title: "Skill Academy",
        subtitle: "Upgrade hero abilities",
        body: "Spend Ward Coins to upgrade hero skills through two tiers. Tier 1 improves the core effect. Tier 2 adds an advanced bonus. Upgrades apply to all copies of that hero in your roster.",
        accentColor: "#C084FC",
        status: "available",
        practiceRoute: "/university/skill-academy",
        practiceLabel: "Open Skill Academy",
      },
    ],
  },
  {
    label: "Realm & Wellness",
    emoji: "🌿",
    entries: [
      {
        id: "realm",
        icon: "leaf-outline",
        title: "Realm / Sanctuary",
        subtitle: "Your non-combat home base",
        body: "Build structures on your Sanctuary grid to passively generate resources. Assign heroes to buildings for a production bonus. The Atrium is always present and gates which buildings you can place.",
        bullets: [
          "Place buildings from the Sanctuary Inventory",
          "Assigned heroes boost production by +25% each",
          "Your realm seed gives you a unique terrain layout",
        ],
        accentColor: "#D4AF37",
        status: "available",
        tutorialId: "firstKingdom",
        replayRoute: "/(tabs)/kingdom",
        practiceRoute: "/(tabs)/kingdom",
        practiceLabel: "Open Sanctuary",
      },
      {
        id: "lotus_journal",
        icon: "nutrition-outline",
        title: "Lotus Plate Journal",
        subtitle: "Off-shift wellness tracker",
        body: "Log meals, hydration, and habits to grow your Nutrition Garden and earn Nourishment Petals. No stamina cost — this space is purely for your own well-being.",
        bullets: [
          "Four garden meters: Hydration, Fiber, Protein, Heart",
          "Nourishment Petals unlock cosmetic rewards",
          "Mealcraft lets you build a balanced plate interactively",
        ],
        accentColor: "#4ADE80",
        status: "available",
        tutorialId: "firstLotusEntry",
        replayRoute: "/lotus-journal",
        practiceRoute: "/lotus-journal",
        practiceLabel: "Open Journal",
      },
      {
        id: "mealcraft",
        icon: "restaurant-outline",
        title: "Mealcraft",
        subtitle: "Interactive plate builder",
        body: "Tap food cards to build a nutritionally balanced plate. Start with protein, add complex carbs, then fiber. The plate teaches you about glycemic balance through play.",
        accentColor: "#86EFAC",
        status: "available",
        tutorialId: "mealcraftIntro",
        replayRoute: "/mealcraft",
        practiceRoute: "/mealcraft",
        practiceLabel: "Open Mealcraft",
      },
    ],
  },
  {
    label: "Shops & Economy",
    emoji: "🏪",
    entries: [
      {
        id: "apothecary",
        icon: "storefront-outline",
        title: "Apothecary Market",
        subtitle: "Spend Ward Coins & Credits",
        body: "The Market lets you spend Ward Coins on battle supplies, upgrades, and cosmetics. University Credits buy advanced study materials. All currency is earned through gameplay — never purchased.",
        bullets: [
          "Ward Coins from battles and daily objectives",
          "University Credits from weekly rounds and lessons",
          "Summoning Shards from battles, chests, and milestones",
        ],
        accentColor: "#FB923C",
        status: "available",
        tutorialId: "systemShops",
        replayRoute: "/shop",
        practiceRoute: "/shop",
        practiceLabel: "Open Market",
      },
      {
        id: "currencies",
        icon: "diamond-outline",
        title: "Currencies Guide",
        subtitle: "What each currency does",
        body: "Clinica has four free-earned currencies. Ward Coins buy supplies. University Credits buy academic items. Summoning Shards recruit heroes. Nourishment Petals unlock wellness cosmetics.",
        bullets: [
          "All sources are free — no payment ever required",
          "Daily Rounds and weekly tasks are the steady income source",
          "See Economy Guide for full earning paths",
        ],
        accentColor: "#FCD34D",
        status: "available",
        practiceRoute: "/economy",
        practiceLabel: "Economy Guide",
      },
    ],
  },
  {
    label: "Journey & Quests",
    emoji: "🗺️",
    entries: [
      {
        id: "journey_map",
        icon: "map-outline",
        title: "Chapter Journey Map",
        subtitle: "Your main story path",
        body: "The Journey Map shows your progress through each chapter. Each node unlocks a battle, challenge, or story event. Complete required nodes to advance. Earn XP, Ward Coins, and Shards along the way.",
        bullets: [
          "Phase headers divide each chapter into arcs",
          "Yellow lock nodes need prior completion to unlock",
          "3-star a chapter to earn bonus chest rewards",
        ],
        accentColor: "#D4AF37",
        status: "available",
        practiceRoute: "/journey",
        practiceLabel: "Open Journey Map",
      },
      {
        id: "daily_rounds",
        icon: "calendar-outline",
        title: "Daily & Weekly Rounds",
        subtitle: "Free daily loop rewards",
        body: "Daily Rounds refresh every 24 hours — complete them to maintain your streak and earn Ward Coins. Weekly Rounds reset each Monday. Completing all 3 daily objectives unlocks the weekly bonus.",
        bullets: [
          "Streak multiplier grows up to 7 days",
          "Weekly task rewards University Credits",
          "One-time milestones for major firsts (first battle, first summon, etc.)",
        ],
        accentColor: "#22C55E",
        status: "available",
        practiceRoute: "/(tabs)/quests",
        practiceLabel: "Open Rounds",
      },
      {
        id: "community_board",
        icon: "people-circle-outline",
        title: "Community Board",
        subtitle: "Collaborative ward events",
        body: "Join other healers in shared ward challenges. Contribute to community goals and earn bonus rewards when the group succeeds. Board refreshes weekly.",
        accentColor: "#67E8F9",
        status: "coming_soon",
      },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function TutorialEncyclopedia() {
  const router = useRouter();
  const { completed, replayTutorial } = useTutorial();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allWithTutorial = CATEGORIES
    .flatMap((c) => c.entries)
    .filter((e) => e.tutorialId && e.status === "available");
  const doneCount = allWithTutorial.filter((e) => completed[e.tutorialId!]).length;

  async function handleReplay(entry: EncyclopediaEntry) {
    if (!entry.tutorialId || !entry.replayRoute) return;
    await replayTutorial(entry.tutorialId);
    router.replace(entry.replayRoute as any);
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/(tabs)/profile")} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={COLORS.brand} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Tutorial Encyclopedia</Text>
          <Text style={styles.headerSub}>Tap any card to expand · Replay a tutorial anytime</Text>
        </View>
        <View style={styles.progressPill}>
          <Text style={styles.progressPillTxt}>{doneCount}/{allWithTutorial.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introNote}>
          Reference guide for every system in Clinica. Opening this page never resets tutorial state — use Replay buttons to re-watch a specific tutorial.
        </Text>

        {CATEGORIES.map((cat) => (
          <View key={cat.label} style={styles.section}>
            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionEmoji}>{cat.emoji}</Text>
              <Text style={styles.sectionLabel}>{cat.label.toUpperCase()}</Text>
            </View>

            {cat.entries.map((entry) => {
              const isExpanded = expandedId === entry.id;
              const isLocked = entry.status === "coming_soon";
              const isDone = entry.tutorialId ? !!completed[entry.tutorialId] : false;

              return (
                <Pressable
                  key={entry.id}
                  style={[
                    styles.card,
                    { borderColor: isLocked ? COLORS.border : entry.accentColor + "30" },
                    isLocked && styles.cardLocked,
                  ]}
                  onPress={() => !isLocked && setExpandedId(isExpanded ? null : entry.id)}
                  testID={`encyclopedia-entry-${entry.id}`}
                >
                  {/* Card top row */}
                  <View style={styles.cardTop}>
                    <View style={[styles.iconBadge, { backgroundColor: isLocked ? COLORS.surfaceSecondary : entry.accentColor + "20" }]}>
                      <Ionicons
                        name={entry.icon}
                        size={20}
                        color={isLocked ? COLORS.onSurfaceTertiary : entry.accentColor}
                      />
                    </View>

                    <View style={styles.cardMeta}>
                      <View style={styles.cardTitleRow}>
                        <Text style={[styles.cardTitle, isLocked && styles.textMuted]}>
                          {entry.title}
                        </Text>
                        {/* Status chips */}
                        {isLocked ? (
                          <View style={styles.lockedChip}>
                            <Text style={styles.lockedChipTxt}>SOON</Text>
                          </View>
                        ) : entry.tutorialId && isDone ? (
                          <View style={styles.doneChip}>
                            <Ionicons name="checkmark" size={9} color="#052e16" />
                            <Text style={styles.doneChipTxt}>DONE</Text>
                          </View>
                        ) : entry.tutorialId ? (
                          <View style={styles.newChip}>
                            <Text style={styles.newChipTxt}>TUTORIAL</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.cardSubtitle, { color: isLocked ? COLORS.onSurfaceTertiary : entry.accentColor }]}>
                        {entry.subtitle}
                      </Text>
                    </View>

                    {!isLocked && (
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={COLORS.onSurfaceTertiary}
                      />
                    )}
                  </View>

                  {/* Accent line */}
                  {!isLocked && (
                    <View style={[styles.accentLine, { backgroundColor: entry.accentColor + "40" }]} />
                  )}

                  {/* Expanded content */}
                  {isExpanded && !isLocked && (
                    <View style={styles.expandedContent}>
                      <Text style={styles.cardBody}>{entry.body}</Text>

                      {entry.bullets && entry.bullets.length > 0 && (
                        <View style={styles.bulletList}>
                          {entry.bullets.map((b, bi) => (
                            <View key={bi} style={styles.bulletRow}>
                              <View style={[styles.bulletDot, { backgroundColor: entry.accentColor }]} />
                              <Text style={styles.bulletTxt}>{b}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* Action buttons */}
                      <View style={styles.actionRow}>
                        {entry.tutorialId && entry.replayRoute && (
                          <Pressable
                            style={[styles.replayBtn, { borderColor: entry.accentColor + "60" }]}
                            onPress={() => handleReplay(entry)}
                            testID={`encyclopedia-replay-${entry.id}`}
                          >
                            <Ionicons name="play-circle-outline" size={14} color={entry.accentColor} />
                            <Text style={[styles.replayBtnTxt, { color: entry.accentColor }]}>
                              {isDone ? "Replay Tutorial" : "Start Tutorial"}
                            </Text>
                          </Pressable>
                        )}
                        {entry.practiceRoute && entry.practiceLabel && (
                          <Pressable
                            style={[styles.practiceBtn, { backgroundColor: entry.accentColor + "14", borderColor: entry.accentColor + "40" }]}
                            onPress={() => router.push(entry.practiceRoute as any)}
                            testID={`encyclopedia-practice-${entry.id}`}
                          >
                            <Ionicons name="arrow-forward-circle-outline" size={14} color={entry.accentColor} />
                            <Text style={[styles.practiceBtnTxt, { color: entry.accentColor }]}>
                              {entry.practiceLabel}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Coming-soon body (always visible) */}
                  {isLocked && (
                    <Text style={styles.lockedBody}>
                      Unlocks in a future update. Check back after completing more content.
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.footer}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.footerTxt}>
            More systems unlock as you progress. All tutorial replays are non-destructive — no rewards or stats change.
          </Text>
        </View>

        {/* Link to Replay Center for batch management */}
        <Pressable
          style={styles.replayCenterLink}
          onPress={() => router.push("/tutorial-center")}
          testID="encyclopedia-replay-center-link"
        >
          <Ionicons name="school-outline" size={16} color={COLORS.brand} />
          <Text style={styles.replayCenterLinkTxt}>Open Tutorial Replay Center →</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  headerText: { flex: 1 },
  headerTitle: { color: COLORS.onSurface, fontSize: 18, fontWeight: "700", letterSpacing: 0.3 },
  headerSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 1 },
  progressPill: {
    backgroundColor: COLORS.brand + "20", borderRadius: RADIUS.pill,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: COLORS.brand + "50",
    alignItems: "center", justifyContent: "center",
  },
  progressPillTxt: { color: COLORS.brand, fontSize: 12, fontWeight: "800" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 16, gap: 0 },
  introNote: {
    color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18,
    textAlign: "center", marginBottom: 20, paddingHorizontal: 4,
  },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginBottom: 8,
  },
  sectionEmoji: { fontSize: 14 },
  sectionLabel: {
    color: COLORS.brand, fontSize: 10, fontWeight: "800", letterSpacing: 1.5,
  },
  card: {
    backgroundColor: COLORS.surfaceSecondary,
    borderRadius: 14, borderWidth: 1,
    marginBottom: 8, overflow: "hidden",
  },
  cardLocked: { opacity: 0.55 },
  cardTop: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 12,
  },
  iconBadge: {
    width: 42, height: 42, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  cardMeta: { flex: 1, gap: 2 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  cardTitle: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  textMuted: { color: COLORS.onSurfaceTertiary },
  cardSubtitle: { fontSize: 11, fontWeight: "500" },
  // Status chips
  lockedChip: {
    backgroundColor: COLORS.onSurfaceTertiary + "25",
    borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2,
  },
  lockedChipTxt: { color: COLORS.onSurfaceTertiary, fontSize: 9, fontWeight: "800", letterSpacing: 1 },
  doneChip: {
    flexDirection: "row", alignItems: "center", gap: 2,
    backgroundColor: "#16a34a", borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  doneChipTxt: { color: "#052e16", fontSize: 9, fontWeight: "900", letterSpacing: 0.5 },
  newChip: {
    backgroundColor: COLORS.brand + "22", borderRadius: RADIUS.pill,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.brand + "40",
  },
  newChipTxt: { color: COLORS.brand, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  // Accent divider
  accentLine: { height: 1, marginHorizontal: 14 },
  // Expanded content
  expandedContent: { padding: 14, paddingTop: 12, gap: 10 },
  cardBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 20 },
  bulletList: { gap: 5 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  bulletTxt: { flex: 1, color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  replayBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  replayBtnTxt: { fontSize: 12, fontWeight: "700" },
  practiceBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  practiceBtnTxt: { fontSize: 12, fontWeight: "600" },
  // Coming soon body
  lockedBody: {
    color: COLORS.onSurfaceTertiary, fontSize: 11,
    paddingHorizontal: 14, paddingBottom: 12, lineHeight: 16,
  },
  // Footer
  footer: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: 12,
    padding: 12, marginTop: 4,
  },
  footerTxt: { flex: 1, color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16 },
  replayCenterLink: {
    flexDirection: "row", alignItems: "center", gap: 6,
    justifyContent: "center", marginTop: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.brand + "30",
    backgroundColor: COLORS.brand + "0A",
  },
  replayCenterLinkTxt: { color: COLORS.brand, fontSize: 13, fontWeight: "600" },
});
