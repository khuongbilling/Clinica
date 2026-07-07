import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "react-native";

import { BazaarRuleRow } from "@/src/components/bazaar/BazaarRuleRow";
import { BazaarSectionCard } from "@/src/components/bazaar/BazaarSectionCard";
import { StaminaPill } from "@/src/components/StaminaPill";
import {
  EMBASSY_STATUS,
  EMBASSY_WELCOME,
  EMBASSY_PURPOSE,
  FACTION_JOIN_INFO,
  FACTION_JOIN_REQUIREMENTS,
  FACTION_CREATE_INFO,
  FACTION_IDENTITY,
  FACTION_ROLES,
  FACTION_CONTRIBUTION_ACTIVITIES,
  FACTION_SHOP_PREVIEW,
  FACTION_MISSIONS_PREVIEW,
  FACTION_REWARD_CATEGORIES,
  EMBASSY_SCOPE_RULES,
} from "@/src/game/embassyHub";
import { usePlayer } from "@/src/game/store";
import { goBack } from "@/src/utils/navigation";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";

// ────────────────────────────────────────────────────────────
// Push 9 — Faction Embassy Foundation.
// This screen is a polished, NON-FUNCTIONAL preview of the future
// cooperative faction hub. No live joining, faction creation, guild chat,
// territory conquest, competitive leaderboards, billing, or trading exist
// anywhere on this page. Every section is clearly labeled Preview/Planned/
// Coming Soon.
// ────────────────────────────────────────────────────────────

const STATUS_COLOR = "#A78BFA"; // diplomatic purple accent throughout

export default function EmbassyScreen() {
  const router = useRouter();
  const { player } = usePlayer();

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]}>
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => goBack(router, "/(tabs)/faction")}
          hitSlop={10}
          testID="embassy-back"
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>DIPLOMACY DISTRICT</Text>
          <Text style={styles.title}>Faction Embassy</Text>
        </View>
        <StaminaPill player={player} />
      </View>

      {/* Top notice */}
      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.noticeTxt}>
          {EMBASSY_STATUS.toUpperCase()} — this is a cooperative faction preview only. No live
          joining, creation, chat, or territory control exists yet.
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* ── Welcome hero card ── */}
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="flag" size={13} color={STATUS_COLOR} />
            <Text style={styles.heroBadgeTxt}>{EMBASSY_STATUS.toUpperCase()}</Text>
          </View>
          <Text style={styles.heroKicker}>{EMBASSY_WELCOME.kicker}</Text>
          <Text style={styles.heroTitle}>{EMBASSY_WELCOME.title}</Text>
          <Text style={styles.heroBody}>{EMBASSY_WELCOME.body}</Text>
        </View>

        {/* ── What is a Faction? ── */}
        <BazaarSectionCard
          title={EMBASSY_PURPOSE.title}
          icon="people-outline"
          accentColor={STATUS_COLOR}
          intro={EMBASSY_PURPOSE.body}
          testID="embassy-purpose"
        >
          <View style={styles.pillarRow}>
            {EMBASSY_PURPOSE.pillars.map((p) => (
              <View key={p.label} style={styles.pillar}>
                <View style={styles.pillarIcon}>
                  <Ionicons name={p.icon as any} size={15} color={STATUS_COLOR} />
                </View>
                <Text style={styles.pillarTxt} numberOfLines={2}>{p.label}</Text>
              </View>
            ))}
          </View>
        </BazaarSectionCard>

        {/* ── Joining a Faction ── */}
        <BazaarSectionCard
          title={FACTION_JOIN_INFO.title}
          icon={FACTION_JOIN_INFO.icon as any}
          accentColor={FACTION_JOIN_INFO.accentColor}
          intro={FACTION_JOIN_INFO.intro}
          testID="embassy-join"
        >
          {FACTION_JOIN_REQUIREMENTS.map((row) => (
            <BazaarRuleRow key={row.label} row={row} accentColor={FACTION_JOIN_INFO.accentColor} />
          ))}
        </BazaarSectionCard>

        {/* ── Creating a Faction ── */}
        <BazaarSectionCard
          title={FACTION_CREATE_INFO.title}
          icon={FACTION_CREATE_INFO.icon as any}
          accentColor={FACTION_CREATE_INFO.accentColor}
          intro={FACTION_CREATE_INFO.intro}
          testID="embassy-create"
        >
          {FACTION_CREATE_INFO.requirements.map((row) => (
            <BazaarRuleRow key={row.label} row={row} accentColor={FACTION_CREATE_INFO.accentColor} />
          ))}
        </BazaarSectionCard>

        {/* ── Faction Identity Overview ── */}
        <BazaarSectionCard
          title={FACTION_IDENTITY.title}
          icon={FACTION_IDENTITY.icon as any}
          accentColor={FACTION_IDENTITY.accentColor}
          intro={FACTION_IDENTITY.intro}
          testID="embassy-identity"
        >
          {FACTION_IDENTITY.elements.map((el) => (
            <View key={el.label} style={styles.identityRow}>
              <View style={[styles.identityIcon, { backgroundColor: FACTION_IDENTITY.accentColor + "20" }]}>
                <Ionicons name={el.icon as any} size={16} color={FACTION_IDENTITY.accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.identityLabel}>{el.label}</Text>
                <Text style={styles.identityDesc}>{el.desc}</Text>
              </View>
            </View>
          ))}
        </BazaarSectionCard>

        {/* ── Faction Roles ── */}
        <BazaarSectionCard
          title="Faction Roles"
          icon="people-circle-outline"
          accentColor="#F59E0B"
          intro="Each member takes on a role that shapes how they contribute to the faction. Roles are earned through activity, not assigned — your contributions decide your standing."
          testID="embassy-roles"
        >
          <View style={styles.roleGrid}>
            {FACTION_ROLES.map((role) => (
              <View key={role.id} style={[styles.roleCard, { borderColor: role.accentColor + "50" }]}>
                {/* Role header */}
                <View style={styles.roleHeader}>
                  <View style={[styles.roleIconWrap, { backgroundColor: role.accentColor + "20" }]}>
                    <Ionicons name={role.icon as any} size={18} color={role.accentColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.roleTitle, { color: role.accentColor }]}>{role.title}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: role.accentColor + "20", borderColor: role.accentColor + "55" }]}>
                      <Text style={[styles.roleBadgeTxt, { color: role.accentColor }]}>{role.badge}</Text>
                    </View>
                  </View>
                </View>
                <Text style={styles.roleDesc}>{role.description}</Text>
                <View style={styles.roleDuties}>
                  {role.responsibilities.map((r) => (
                    <View key={r} style={styles.dutyRow}>
                      <Ionicons name="checkmark-circle-outline" size={12} color={role.accentColor} />
                      <Text style={styles.dutyTxt}>{r}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </BazaarSectionCard>

        {/* ── Faction Contribution ── */}
        <BazaarSectionCard
          title="Faction Contribution"
          icon="arrow-up-circle-outline"
          accentColor="#34D399"
          intro="Members grow their faction — and earn Faction Marks — through four main contribution paths. There is no mandatory activity window; contribute when you play."
          testID="embassy-contribution"
        >
          {FACTION_CONTRIBUTION_ACTIVITIES.map((act) => (
            <View key={act.title} style={styles.contributionRow}>
              <View style={[styles.contribIcon, { backgroundColor: "#34D399" + "20" }]}>
                <Ionicons name={act.icon as any} size={18} color="#34D399" />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={styles.contribTitleRow}>
                  <Text style={styles.contribTitle}>{act.title}</Text>
                  <View style={[styles.contribBadge, { backgroundColor: act.status === "Planned" ? "#F59E0B20" : "#A78BFA20", borderColor: act.status === "Planned" ? "#F59E0B55" : "#A78BFA55" }]}>
                    <Text style={[styles.contribBadgeTxt, { color: act.status === "Planned" ? "#F59E0B" : "#A78BFA" }]}>{act.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.contribDesc}>{act.desc}</Text>
                <View style={styles.contribEarnsRow}>
                  <Ionicons name="medal-outline" size={11} color="#F59E0B" />
                  <Text style={styles.contribEarns}>{act.earns}</Text>
                </View>
              </View>
            </View>
          ))}
        </BazaarSectionCard>

        {/* ── Faction Shop Placeholder ── */}
        <BazaarSectionCard
          title={FACTION_SHOP_PREVIEW.title}
          icon={FACTION_SHOP_PREVIEW.icon as any}
          accentColor={FACTION_SHOP_PREVIEW.accentColor}
          intro={FACTION_SHOP_PREVIEW.intro}
          testID="embassy-shop"
        >
          {FACTION_SHOP_PREVIEW.previewCategories.map((cat) => (
            <View key={cat.label} style={styles.shopRow}>
              <View style={[styles.shopIcon, { backgroundColor: FACTION_SHOP_PREVIEW.accentColor + "20" }]}>
                <Ionicons name={cat.icon as any} size={16} color={FACTION_SHOP_PREVIEW.accentColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.shopLabel}>{cat.label}</Text>
                <Text style={styles.shopDesc}>{cat.desc}</Text>
              </View>
            </View>
          ))}
        </BazaarSectionCard>

        {/* ── Faction Missions ── */}
        <BazaarSectionCard
          title="Faction Missions"
          icon="list-outline"
          accentColor="#22D3EE"
          intro="Group objectives that reward the whole faction — no solo grinding required. Missions range from daily micro-tasks to multi-day world events."
          testID="embassy-missions"
        >
          {FACTION_MISSIONS_PREVIEW.map((mission) => (
            <View key={mission.title} style={styles.missionRow}>
              <View style={[styles.missionIcon, { backgroundColor: "#22D3EE20" }]}>
                <Ionicons name={mission.icon as any} size={16} color="#22D3EE" />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.missionTitleRow}>
                  <Text style={styles.missionTitle}>{mission.title}</Text>
                  <View style={styles.missionTypePill}>
                    <Text style={styles.missionTypeTxt}>{mission.type}</Text>
                  </View>
                  <View style={[styles.missionStatusPill, { backgroundColor: mission.status === "Planned" ? "#F59E0B20" : "#A78BFA20", borderColor: mission.status === "Planned" ? "#F59E0B55" : "#A78BFA55" }]}>
                    <Text style={[styles.missionStatusTxt, { color: mission.status === "Planned" ? "#F59E0B" : "#A78BFA" }]}>{mission.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.missionDesc}>{mission.desc}</Text>
                <View style={styles.missionRewardRow}>
                  <Ionicons name="medal-outline" size={11} color="#F59E0B" />
                  <Text style={styles.missionReward}>{mission.reward}</Text>
                </View>
              </View>
            </View>
          ))}
        </BazaarSectionCard>

        {/* ── Reward Preview ── */}
        <BazaarSectionCard
          title="Reward Preview"
          icon="gift-outline"
          accentColor="#F97316"
          intro="Faction participation earns rewards that are purely cosmetic and progression-paced — never pay-to-win, never exclusive combat power."
          testID="embassy-rewards"
        >
          <View style={styles.rewardGrid}>
            {FACTION_REWARD_CATEGORIES.map((cat) => (
              <View key={cat.title} style={[styles.rewardCard, { borderColor: cat.accentColor + "45" }]}>
                <View style={[styles.rewardIcon, { backgroundColor: cat.accentColor + "20" }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.accentColor} />
                </View>
                <Text style={[styles.rewardTitle, { color: cat.accentColor }]}>{cat.title}</Text>
                <Text style={styles.rewardDesc}>{cat.desc}</Text>
                <View style={styles.rewardEarnsRow}>
                  <Ionicons name="arrow-forward-circle-outline" size={11} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.rewardEarns}>{cat.earnedVia}</Text>
                </View>
              </View>
            ))}
          </View>
        </BazaarSectionCard>

        {/* ── Scope & Safety ── */}
        <BazaarSectionCard
          title="What This Push Does Not Include"
          icon="shield-outline"
          accentColor="#EF4444"
          intro="The Embassy is built on a cooperative foundation. These features are explicitly out of scope — they may be considered in future pushes."
          testID="embassy-scope"
        >
          {EMBASSY_SCOPE_RULES.map((row) => (
            <BazaarRuleRow key={row.label} row={row} accentColor="#EF4444" />
          ))}
        </BazaarSectionCard>

        {/* Closing notice */}
        <View style={styles.closingNotice}>
          <Ionicons name="information-circle-outline" size={14} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.noticeTxt}>
            Nothing on this page can be tapped to join, create, buy, or trade anything. All
            faction concepts shown here are planning previews and may change before the Embassy
            goes live.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  loading: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.lg, paddingBottom: SPACING.sm,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  kicker: { color: STATUS_COLOR, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", marginTop: 2 },
  notice: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginBottom: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  noticeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 12, lineHeight: 17, flex: 1, fontStyle: "italic" },
  scroll: { padding: SPACING.lg, paddingTop: 0, paddingBottom: SPACING.xxxl, gap: SPACING.md },

  // Welcome hero card
  heroCard: {
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: STATUS_COLOR + "45",
    backgroundColor: COLORS.surfaceSecondary, padding: SPACING.lg, gap: 6,
  },
  heroBadge: {
    flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 4,
    backgroundColor: STATUS_COLOR + "22", borderColor: STATUS_COLOR + "55", borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4,
  },
  heroBadgeTxt: { color: STATUS_COLOR, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  heroKicker: { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  heroTitle: { color: COLORS.onSurface, fontSize: 19, fontWeight: "700" },
  heroBody: { color: COLORS.onSurfaceSecondary, fontSize: 13, lineHeight: 19, marginTop: 2 },

  // Purpose pillars
  pillarRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  pillar: {
    flexBasis: "47%", flexGrow: 1, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: 8,
  },
  pillarIcon: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: STATUS_COLOR + "22",
    alignItems: "center", justifyContent: "center",
  },
  pillarTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, flex: 1, fontWeight: "600" },

  // Faction Identity elements
  identityRow: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  identityIcon: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
  },
  identityLabel: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  identityDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15, marginTop: 2 },

  // Faction Roles grid
  roleGrid: { gap: SPACING.sm },
  roleCard: {
    borderRadius: RADIUS.md, borderWidth: 1,
    backgroundColor: COLORS.surfaceTertiary, padding: SPACING.md, gap: SPACING.sm,
  },
  roleHeader: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
  roleIconWrap: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
  },
  roleTitle: { fontSize: 14, fontWeight: "700" },
  roleBadge: {
    alignSelf: "flex-start", borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 6, paddingVertical: 2, marginTop: 2,
  },
  roleBadgeTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  roleDesc: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  roleDuties: { gap: 4 },
  dutyRow: { flexDirection: "row", gap: 5, alignItems: "flex-start" },
  dutyTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15, flex: 1 },

  // Contribution activities
  contributionRow: {
    flexDirection: "row", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  contribIcon: {
    width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  contribTitleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs, flexWrap: "wrap" },
  contribTitle: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700" },
  contribBadge: {
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  contribBadgeTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  contribDesc: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16 },
  contribEarnsRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  contribEarns: { color: "#F59E0B", fontSize: 11, fontWeight: "600" },

  // Faction Shop rows
  shopRow: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  shopIcon: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
  },
  shopLabel: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  shopDesc: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 15, marginTop: 2 },

  // Faction Missions
  missionRow: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceTertiary, borderRadius: RADIUS.md, padding: SPACING.sm,
  },
  missionIcon: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    marginTop: 2,
  },
  missionTitleRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  missionTitle: { color: COLORS.onSurface, fontSize: 12, fontWeight: "700" },
  missionTypePill: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.pill,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  missionTypeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  missionStatusPill: {
    borderRadius: RADIUS.pill, borderWidth: 1,
    paddingHorizontal: 5, paddingVertical: 2,
  },
  missionStatusTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  missionDesc: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16 },
  missionRewardRow: { flexDirection: "row", gap: 4, alignItems: "center" },
  missionReward: { color: "#F59E0B", fontSize: 11, fontWeight: "600" },

  // Reward grid
  rewardGrid: { gap: SPACING.sm },
  rewardCard: {
    borderRadius: RADIUS.md, borderWidth: 1,
    backgroundColor: COLORS.surfaceTertiary, padding: SPACING.md, gap: 4,
  },
  rewardIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
    marginBottom: 4,
  },
  rewardTitle: { fontSize: 13, fontWeight: "700" },
  rewardDesc: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16 },
  rewardEarnsRow: { flexDirection: "row", gap: 4, alignItems: "flex-start", marginTop: 4 },
  rewardEarns: { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 14, flex: 1, fontStyle: "italic" },

  closingNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
});
