/**
 * Tutorial Encyclopedia
 *
 * A read-only reference screen listing every major game mode and mechanic
 * with a short explanation.  No XP, no rewards — purely informational.
 * Accessible from Profile → Settings → Tutorial Encyclopedia.
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { COLORS } from "@/src/theme/colors";

// ── Topic definitions ──────────────────────────────────────────────────────

interface Topic {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle: string;
  body: string;
  accentColor: string;
  route?: string;
  routeLabel?: string;
}

const TOPICS: Topic[] = [
  {
    id: "journey_map",
    icon: "map-outline",
    title: "Chapter Journey Map",
    subtitle: "Your main story path",
    body:
      "The Journey Map shows your progress through each chapter. Each node unlocks a battle, challenge, or story event. Complete required nodes to advance to the next chapter. Earn XP, Ward Coins, and Summoning Shards along the way.",
    accentColor: "#D4AF37",
  },
  {
    id: "rapid_triage",
    icon: "shuffle-outline",
    title: "Rapid Triage",
    subtitle: "Sort patients by urgency",
    body:
      "Three patients need your attention — but not all at once. Emergency means life-threatening (act now). Urgent means needs care soon but is stable. Routine means no immediate danger. Read the clinical signs carefully before you decide.",
    accentColor: "#F59E0B",
    route: "/university/rapid-triage",
    routeLabel: "Practice Triage",
  },
  {
    id: "stabilize_stack",
    icon: "layers-outline",
    title: "Stabilize Stack",
    subtitle: "Sequence care steps safely",
    body:
      "In clinical care, the order of actions matters as much as the actions themselves. Drag and arrange the care steps in the correct safe sequence. Wrong order can cause harm — right order saves the patient.",
    accentColor: "#34D399",
    route: "/university/stabilize-stack",
    routeLabel: "Practice Stabilize",
  },
  {
    id: "ward_shift",
    icon: "medical-outline",
    title: "Ward Shift (Battle)",
    subtitle: "Simulation encounters",
    body:
      "Ward Shift is turn-based combat against disease-spirit enemies. Each turn you choose a skill from your hero team. Stability is the patient's health — bring it to 100% to win. Read the enemy's Element System for weakness clues. Your heroes have AP (Action Points) that refill each turn.",
    accentColor: "#06B6D4",
    route: "/shift",
    routeLabel: "Enter Ward Shift",
  },
  {
    id: "ward_defense",
    icon: "shield-outline",
    title: "Ward Defense",
    subtitle: "Wave-based protection",
    body:
      "Ward Defense is a tower-defense mode. Disease-monsters march along a path toward your ward. Deploy hero units on the board to intercept and defeat them before they reach the ward core. Harder waves need stronger hero units and smarter placement.",
    accentColor: "#8B5CF6",
  },
  {
    id: "clinical_cues",
    icon: "eye-outline",
    title: "Clinical Cues",
    subtitle: "Hidden diagnostic signals",
    body:
      "Clinical Cues are diagnostic clues hidden in every encounter. Tap the correct cue to reveal a bonus effect — extra stability, AP, or a shield. The Cue Hunt lab trains you to spot them faster. Your Learning Profile adjusts how many cues are visible at once.",
    accentColor: "#B0DEFF",
    route: "/university/cue-hunt",
    routeLabel: "Cue Hunt Lab",
  },
  {
    id: "hero_summoning",
    icon: "people-outline",
    title: "Hero Summoning",
    subtitle: "Recruit your healer team",
    body:
      "Heroes only come from Recruitment (gacha) using Summoning Shards. Each hero has a unique skill set and Element specialty. Duplicate heroes increase your hero's Star Rank. Assign heroes to your active team before entering a Ward Shift battle.",
    accentColor: "#F472B6",
  },
  {
    id: "skill_academy",
    icon: "school-outline",
    title: "Hero Skill Academy",
    subtitle: "Upgrade hero abilities",
    body:
      "At the Skill Academy you spend Ward Coins to level up your heroes' skills. Skills have two upgrade tiers. Tier 1 improves the core effect. Tier 2 adds an advanced bonus effect. Upgrades apply to all copies of that hero in your roster.",
    accentColor: "#A78BFA",
    route: "/university/skill-academy",
    routeLabel: "Open Skill Academy",
  },
  {
    id: "daily_rounds",
    icon: "calendar-outline",
    title: "Daily & Weekly Rounds",
    subtitle: "Free daily loop",
    body:
      "Daily Rounds refresh every 24 hours — complete them to maintain your streak and earn Ward Coins. Weekly Rounds reset each Monday and reward University Credits. A daily check-in streak multiplies your rewards. Complete all 3 daily objectives to unlock the weekly bonus.",
    accentColor: "#22C55E",
  },
  {
    id: "realm",
    icon: "leaf-outline",
    title: "Realm / Sanctuary",
    subtitle: "Your home base",
    body:
      "The Realm is your non-combat base of operations. Build structures (Training Hall, Herb Garden, etc.) to passively generate resources. Assign heroes to buildings for a production bonus. The Atrium is always present — it controls which buildings you can place.",
    accentColor: "#D4AF37",
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function TutorialEncyclopedia() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={COLORS.brand} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Tutorial Encyclopedia</Text>
          <Text style={styles.headerSub}>Game modes & mechanics explained</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.introNote}>
          Reference guide for every major system in Clinica.{"\n"}No XP awarded — purely for learning.
        </Text>

        {TOPICS.map((topic, i) => (
          <View key={topic.id} style={[styles.card, i === 0 && { marginTop: 0 }]}>
            {/* Card header */}
            <View style={styles.cardHeader}>
              <View style={[styles.iconBadge, { backgroundColor: topic.accentColor + "22" }]}>
                <Ionicons name={topic.icon} size={22} color={topic.accentColor} />
              </View>
              <View style={styles.cardTitleGroup}>
                <Text style={styles.cardTitle}>{topic.title}</Text>
                <Text style={[styles.cardSubtitle, { color: topic.accentColor }]}>
                  {topic.subtitle}
                </Text>
              </View>
            </View>

            {/* Accent divider */}
            <View style={[styles.divider, { backgroundColor: topic.accentColor + "33" }]} />

            {/* Body */}
            <Text style={styles.cardBody}>{topic.body}</Text>

            {/* Optional deep-link */}
            {topic.route && topic.routeLabel && (
              <Pressable
                style={[styles.practiceBtn, { borderColor: topic.accentColor + "66" }]}
                onPress={() => router.push(topic.route as any)}
              >
                <Ionicons name="play-circle-outline" size={14} color={topic.accentColor} />
                <Text style={[styles.practiceTxt, { color: topic.accentColor }]}>
                  {topic.routeLabel}
                </Text>
              </Pressable>
            )}
          </View>
        ))}

        <Text style={styles.footer}>
          More topics will be added as new modes unlock.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    color: COLORS.onSurface,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerSub: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 16,
  },
  introNote: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitleGroup: {
    flex: 1,
  },
  cardTitle: {
    color: COLORS.onSurface,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    marginTop: 1,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    marginBottom: 10,
    borderRadius: 1,
  },
  cardBody: {
    color: COLORS.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  practiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  practiceTxt: {
    fontSize: 12,
    fontWeight: "600",
  },
  footer: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 12,
    textAlign: "center",
    marginTop: 24,
    fontStyle: "italic",
  },
});
