import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { goBack } from "@/src/utils/navigation";
import { PlayerHeader } from "@/src/components/PlayerHeader";
import { InlineNotice, useInlineNotice } from "@/src/components/WebAlert";
import { usePlayer } from "@/src/game/store";
import { playerLevelFromXp, isFeatureUnlocked, FEATURE_UNLOCKS } from "@/src/game/progression";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import {
  MIASMA_BLOOM_LORE,
  MIASMA_BLOOM_PHASES,
  MIASMA_BLOOM_SYSTEMS,
  MIASMA_BLOOM_MILESTONES,
  MIASMA_BLOOM_REWARDS,
  VERDANTHA,
  TOKEN_EXCHANGE,
  WORLD_EVENT_BADGE_COLOR,
  REWARD_CATEGORY_LABEL,
  getPhaseProgress,
  getMilestoneProgress,
  formatContainmentLabel,
  getSanctuaryCorruption,
  getCorruptionCleared,
  getCorruptionClearedFraction,
  isVerdanthaUnlocked,
  SANCTUARY_CORRUPTION_MAX,
  type WorldEventBadge,
} from "@/src/game/worldEvent";

// ────────────────────────────────────────────────────────────────────────────
// Push 10 — Miasma Bloom: World Event UI Foundation
// Static prototype — no multiplayer, no live sync, no purchases, no
// leaderboards. All progress values are static previews for layout purposes.
// ────────────────────────────────────────────────────────────────────────────

type Tab = "overview" | "systems" | "rewards" | "boss";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview",  icon: "earth"         },
  { id: "systems",  label: "Systems",   icon: "git-network"   },
  { id: "rewards",  label: "Rewards",   icon: "gift"          },
  { id: "boss",     label: "World Boss",icon: "skull"         },
];

const BLOOM_ACCENT = "#34D399";
const BLOOM_DARK   = "#065F46";
const BLOOM_GLOW   = "#6EE7B7";

export default function WorldEventScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const [tab, setTab] = useState<Tab>("overview");

  if (!player) {
    return (
      <SafeAreaView style={[styles.root, styles.loading]} edges={["top", "bottom"]} testID="world-event-loading">
        <ActivityIndicator color={COLORS.brand} />
      </SafeAreaView>
    );
  }

  // World Events (Miasma Bloom) are later-game content — gated at Player Level 10.
  // Deep-link / back-nav safety net: if an under-level player reaches this route
  // directly, show a locked card instead of the full event dashboard.
  const worldEventLevel = FEATURE_UNLOCKS.find((f) => f.id === "world_event")?.level ?? 10;
  const worldEventUnlocked = isFeatureUnlocked("world_event", playerLevelFromXp(player.xp).level);
  if (!worldEventUnlocked) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]} testID="world-event-locked">
        <PlayerHeader player={player} />
        <View style={styles.lockedWrap}>
          <View style={styles.lockedIcon}>
            <Ionicons name="lock-closed" size={34} color={BLOOM_ACCENT} />
          </View>
          <Text style={styles.lockedKicker}>WORLD EVENT · LOCKED</Text>
          <Text style={styles.lockedTitle}>{MIASMA_BLOOM_LORE.title}</Text>
          <Text style={styles.lockedBody}>
            Realm-wide World Events are later-game content. Reach{" "}
            <Text style={{ color: BLOOM_GLOW, fontWeight: "700" }}>Player Level {worldEventLevel}</Text>{" "}
            to answer the Miasma Bloom outbreak and unlock the World Boss.
          </Text>
          <Pressable style={styles.lockedBtn} onPress={() => goBack(router, "/shift")} testID="world-event-locked-back">
            <Ionicons name="arrow-back" size={16} color={COLORS.onBrand} />
            <Text style={styles.lockedBtnTxt}>BACK</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <PlayerHeader player={player} />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={() => goBack(router, "/events")} hitSlop={10} testID="world-event-back">
          <Ionicons name="arrow-back" size={20} color={COLORS.onSurfaceSecondary} />
        </Pressable>
        <LinearGradient
          colors={[BLOOM_DARK + "CC", "transparent"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>WORLD EVENT · PUSH 10 PROTOTYPE</Text>
          <Text style={styles.title}>{MIASMA_BLOOM_LORE.title}</Text>
          <Text style={styles.subtitle}>{MIASMA_BLOOM_LORE.subtitle}</Text>
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <BadgePill badge="Preview" />
          <View style={styles.headerTokenPill} testID="world-event-header-tokens">
            <Ionicons name="flask" size={11} color={BLOOM_ACCENT} />
            <Text style={styles.headerTokenTxt}>{(player.epidemic_tokens ?? 0).toLocaleString()}</Text>
          </View>
        </View>
      </View>

      {/* ── Preview notice ── */}
      <View style={styles.noticeBar}>
        <Ionicons name="flask-outline" size={13} color={BLOOM_ACCENT} />
        <Text style={styles.noticeTxt}>
          Prototype preview — no purchases, multiplayer, live sync, or leaderboards. Your Containment
          and Corruption meters track your real Epidemic Tokens; other sections use placeholder data.
          Labels mark each section's readiness.
        </Text>
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <Pressable
            key={t.id}
            style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}
            onPress={() => setTab(t.id)}
            testID={`world-event-tab-${t.id}`}
          >
            <Ionicons
              name={t.icon as any}
              size={14}
              color={tab === t.id ? BLOOM_ACCENT : COLORS.onSurfaceTertiary}
            />
            <Text style={[styles.tabTxt, tab === t.id && styles.tabTxtActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        testID="world-event-scroll"
      >
        {tab === "overview" && <OverviewTab />}
        {tab === "systems"  && <SystemsTab router={router} />}
        {tab === "rewards"  && <RewardsTab />}
        {tab === "boss"     && <BossTab router={router} />}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { player } = usePlayer();
  const tokens = player?.epidemic_tokens ?? 0;
  return (
    <View style={styles.section}>
      {/* Live contribution — real Epidemic Tokens earned from Ward Shift runs */}
      <SectionHeading icon="flask-outline" title="Your Contribution" />
      <View style={[styles.contributionCard, { borderColor: BLOOM_ACCENT + "66" }]} testID="world-event-token-balance">
        <LinearGradient
          colors={[BLOOM_DARK + "44", "transparent"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.contributionIconBox, { backgroundColor: BLOOM_ACCENT + "22" }]}>
          <Ionicons name="flask" size={22} color={BLOOM_ACCENT} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.contributionValue}>{tokens.toLocaleString()}</Text>
          <Text style={styles.contributionLabel}>Epidemic Tokens earned</Text>
        </View>
        <Text style={styles.contributionHint}>
          {tokens > 0
            ? "Earned from Ward Shift runs against the Bloom."
            : "Complete a Ward Shift run to start earning tokens."}
        </Text>
      </View>

      {/* Sanctuary Corruption Meter — drains as the player clears Bloom-patients */}
      <SectionHeading icon="pulse-outline" title="Sanctuary Corruption Meter" />
      <View style={[styles.corruptionCard, { borderColor: BLOOM_ACCENT + "55" }]} testID="world-event-corruption-meter">
        <LinearGradient
          colors={[BLOOM_DARK + "44", "transparent"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.corruptionTopRow}>
          <Text style={styles.corruptionValue}>{getSanctuaryCorruption(tokens).toLocaleString()}</Text>
          <Text style={styles.corruptionMax}>/ {SANCTUARY_CORRUPTION_MAX.toLocaleString()} corruption</Text>
        </View>
        {/* Bar fills from the right — a fuller bar means MORE corruption remaining */}
        <View style={styles.corruptionTrack}>
          <View
            style={[
              styles.corruptionFill,
              { width: `${(getSanctuaryCorruption(tokens) / SANCTUARY_CORRUPTION_MAX) * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.corruptionHint}>
          {getCorruptionCleared(tokens) > 0
            ? `You've pushed back ${getCorruptionCleared(tokens).toLocaleString()} point${getCorruptionCleared(tokens) > 1 ? "s" : ""} of corruption (${Math.round(getCorruptionClearedFraction(tokens) * 100)}%). Each Bloom-patient you clear drains 1 point.`
            : "Each Bloom-patient you clear in a Ward Shift drains 1 point from the Sanctuary's corruption."}
        </Text>
      </View>

      {/* Lore block */}
      <SectionHeading icon="book-outline" title="Event Lore" />
      <View style={[styles.loreCard, { borderColor: BLOOM_ACCENT + "55" }]}>
        <LinearGradient
          colors={[BLOOM_DARK + "44", "transparent"]}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.loreChapter}>{MIASMA_BLOOM_LORE.chapter}</Text>
        <Text style={styles.loreFlavor}>{MIASMA_BLOOM_LORE.flavor}</Text>
        <View style={styles.loreDivider} />
        <InfoRow label="Setting"  value={MIASMA_BLOOM_LORE.setting} />
        <InfoRow label="Hook"     value={MIASMA_BLOOM_LORE.hook} />
      </View>

      {/* Threat brief */}
      <SectionHeading icon="warning-outline" title="The Threat" />
      <View style={styles.threatCard}>
        <Ionicons name="warning" size={18} color={BLOOM_ACCENT} />
        <Text style={styles.threatTxt}>{MIASMA_BLOOM_LORE.threat}</Text>
      </View>

      {/* Phase roadmap — bars fill live from the player's Epidemic Tokens */}
      <SectionHeading icon="map-outline" title="Event Phases" />
      {MIASMA_BLOOM_PHASES.map((phase, i) => {
        const progress = getPhaseProgress(tokens, phase);
        const cleared = progress >= 1;
        const active = tokens < phase.threshold && (i === 0 || tokens >= MIASMA_BLOOM_PHASES[i - 1].threshold);
        const highlight = cleared || active;
        return (
          <View key={phase.id} style={styles.phaseRow} testID={`world-event-phase-${phase.id}`}>
            <View style={[styles.phaseIndex, { backgroundColor: highlight ? BLOOM_ACCENT + "33" : COLORS.surfaceTertiary }]}>
              {cleared ? (
                <Ionicons name="checkmark" size={16} color={BLOOM_ACCENT} />
              ) : (
                <Text style={[styles.phaseIndexTxt, { color: highlight ? BLOOM_ACCENT : COLORS.onSurfaceTertiary }]}>
                  {i + 1}
                </Text>
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.phaseTopRow}>
                <Text style={styles.phaseLabel}>{phase.label}</Text>
                <BadgePill badge={phase.badge} />
              </View>
              <Text style={styles.phaseDesc}>{phase.description}</Text>
              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: BLOOM_ACCENT }]} />
              </View>
              <Text style={styles.phaseThreshold}>
                {formatContainmentLabel(tokens, phase)}
                {cleared ? "  ·  Cleared" : `  ·  ${Math.round(progress * 100)}%`}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Collective note */}
      <View style={styles.collectiveNote}>
        <Ionicons name="people-outline" size={14} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.collectiveNoteTxt}>
          These meters fill from your own Epidemic Tokens. In the full event, phase thresholds are
          collective — all participating healers contribute together — but live synchronisation and
          leaderboards are not implemented in this prototype.
        </Text>
      </View>
    </View>
  );
}

// ── Systems Tab ───────────────────────────────────────────────────────────────

function SystemsTab({ router }: { router: any }) {
  return (
    <View style={styles.section}>
      <SectionHeading icon="git-network-outline" title="How Your Systems Contribute" />
      <Text style={styles.sectionSub}>
        The Miasma Bloom does not have a single counter — every mode in the Sanctuary feeds into
        containment. Tap a system card to navigate there.
      </Text>

      {MIASMA_BLOOM_SYSTEMS.map((sys) => (
        <Pressable
          key={sys.id}
          style={[styles.systemCard, { borderColor: sys.accentColor + "44" }]}
          onPress={() => sys.route && router.push(sys.route as any)}
          testID={`world-event-system-${sys.id}`}
        >
          <LinearGradient
            colors={[sys.accentColor + "18", "transparent"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          />
          <View style={styles.systemCardHeader}>
            <View style={[styles.systemIconBox, { backgroundColor: sys.accentColor + "22" }]}>
              <Ionicons name={sys.icon as any} size={22} color={sys.accentColor} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.systemTitleRow}>
                <Text style={[styles.systemName, { color: sys.accentColor }]}>{sys.systemName}</Text>
                <BadgePill badge={sys.badge} />
              </View>
              <Text style={styles.systemShort}>{sys.shortDesc}</Text>
            </View>
            {sys.route && (
              <Ionicons name="chevron-forward" size={16} color={COLORS.onSurfaceTertiary} />
            )}
          </View>

          <View style={styles.systemBody}>
            <Text style={styles.systemMechanic}>{sys.mechanicDesc}</Text>
            <View style={styles.systemContribRow}>
              <Ionicons name="gift-outline" size={12} color={BLOOM_ACCENT} />
              <Text style={styles.systemContrib}>{sys.contribution}</Text>
            </View>
            <View style={styles.systemHintRow}>
              <Ionicons name="star-outline" size={12} color={COLORS.onSurfaceTertiary} />
              <Text style={styles.systemHint}>{sys.rewardHint}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

// ── Rewards Tab ───────────────────────────────────────────────────────────────

function RewardsTab() {
  const { player, redeemExchangeItem, claimMilestone } = usePlayer();
  const { notice, flashNotice } = useInlineNotice();
  const [busyId, setBusyId] = useState<string | null>(null);
  const tokens = player?.epidemic_tokens ?? 0;
  const [rewardFilter, setRewardFilter] = useState<"all" | "milestones" | "catalog" | "exchange">("all");

  const handleClaimMilestone = async (ms: typeof MIASMA_BLOOM_MILESTONES[number]) => {
    if (busyId) return;
    setBusyId(ms.id);
    const res = await claimMilestone(ms.id);
    setBusyId(null);
    flashNotice(res.message);
  };

  const handleRedeem = async (item: typeof TOKEN_EXCHANGE[number]) => {
    if (busyId) return;
    if (!item.grant) {
      flashNotice(`${item.name} is coming soon — not yet redeemable.`);
      return;
    }
    if (tokens < item.cost) {
      flashNotice(`Not enough Epidemic Tokens for ${item.name} (need ${item.cost.toLocaleString()}).`);
      return;
    }
    setBusyId(item.id);
    const res = await redeemExchangeItem(item);
    setBusyId(null);
    flashNotice(res.message);
  };

  const filters: { id: typeof rewardFilter; label: string }[] = [
    { id: "all",        label: "All"       },
    { id: "milestones", label: "Milestones"},
    { id: "catalog",    label: "Catalog"   },
    { id: "exchange",   label: "Exchange"  },
  ];

  return (
    <View style={styles.section}>
      {/* Filter pills */}
      <View style={styles.filterRow}>
        {filters.map((f) => (
          <Pressable
            key={f.id}
            style={[styles.filterPill, rewardFilter === f.id && styles.filterPillActive]}
            onPress={() => setRewardFilter(f.id)}
            testID={`world-event-filter-${f.id}`}
          >
            <Text style={[styles.filterTxt, rewardFilter === f.id && styles.filterTxtActive]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Milestones */}
      {(rewardFilter === "all" || rewardFilter === "milestones") && (
        <>
          <SectionHeading icon="trophy-outline" title="Event Milestones" />
          <Text style={styles.sectionSub}>
            Individual milestone rewards earned as you contribute to the event. Meet a milestone's requirement, then tap Claim to collect its rewards.
          </Text>
          {MIASMA_BLOOM_MILESTONES.map((ms) => {
            const prog = getMilestoneProgress(ms, player);
            const busy = busyId === ms.id;
            return (
            <View key={ms.id} style={styles.milestoneCard} testID={`world-event-milestone-${ms.id}`}>
              <View style={styles.milestoneTierBadge}>
                <Text style={styles.milestoneTierTxt}>{ms.tier}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.msTopRow}>
                  <Text style={styles.msLabel}>{ms.label}</Text>
                  <BadgePill badge={ms.badge} />
                </View>
                <Text style={styles.msReq}>{ms.requirement}</Text>
                {/* Live progress toward the requirement */}
                <View style={styles.msProgressRow}>
                  <View style={styles.msProgressTrack}>
                    <View style={[styles.msProgressFill, { width: `${Math.round(prog.pct * 100)}%` }]} />
                  </View>
                  <Text style={styles.msProgressTxt}>
                    {prog.claimed ? "Claimed" : `${Math.min(prog.current, prog.goal)}/${prog.goal}`}
                  </Text>
                </View>
                <View style={styles.msRewardRow}>
                  {ms.rewards.map((r, i) => (
                    <View key={i} style={[styles.msRewardChip, { borderColor: r.accentColor + "55" }]}>
                      <Ionicons name={r.icon as any} size={12} color={r.accentColor} />
                      <Text style={[styles.msRewardTxt, { color: r.accentColor }]}>{r.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              {prog.claimed ? (
                <View style={[styles.msClaimBtn, styles.msClaimBtnClaimed]} testID={`world-event-milestone-claimed-${ms.id}`}>
                  <Ionicons name="checkmark" size={14} color="#34D399" />
                </View>
              ) : prog.met ? (
                <Pressable
                  style={[styles.msClaimBtn, busy && { opacity: 0.6 }]}
                  onPress={() => handleClaimMilestone(ms)}
                  disabled={busy}
                  testID={`world-event-milestone-claim-${ms.id}`}
                >
                  <Ionicons name="gift" size={14} color={COLORS.onBrand ?? "#0B0B0F"} />
                </Pressable>
              ) : (
                <View style={[styles.msClaimBtn, styles.msClaimBtnDisabled]}>
                  <Ionicons name="lock-closed" size={12} color={COLORS.onSurfaceTertiary} />
                </View>
              )}
            </View>
            );
          })}
        </>
      )}

      {/* Reward Catalog */}
      {(rewardFilter === "all" || rewardFilter === "catalog") && (
        <>
          <SectionHeading icon="gift-outline" title="Reward Catalog" />
          <Text style={styles.sectionSub}>
            All earnable rewards from the Miasma Bloom event — currencies, materials, cosmetics, and relics.
          </Text>
          <View style={styles.catalogGrid}>
            {MIASMA_BLOOM_REWARDS.map((reward) => (
              <View
                key={reward.id}
                style={[styles.catalogCard, { borderColor: reward.accentColor + "55" }]}
                testID={`world-event-reward-${reward.id}`}
              >
                <View style={[styles.catalogIconBox, { backgroundColor: reward.accentColor + "22" }]}>
                  <Ionicons name={reward.icon as any} size={20} color={reward.accentColor} />
                </View>
                <View style={styles.catalogMeta}>
                  <BadgePill badge={reward.badge} />
                  <Text style={styles.catalogCategory}>{REWARD_CATEGORY_LABEL[reward.category]}</Text>
                </View>
                <Text style={[styles.catalogName, { color: reward.accentColor }]}>{reward.name}</Text>
                <Text style={styles.catalogDesc}>{reward.description}</Text>
                <View style={styles.catalogSourceRow}>
                  <Ionicons name="navigate-outline" size={10} color={COLORS.onSurfaceTertiary} />
                  <Text style={styles.catalogSource}>{reward.source}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Token Exchange */}
      {(rewardFilter === "all" || rewardFilter === "exchange") && (
        <>
          <SectionHeading icon="swap-horizontal-outline" title="Epidemic Token Exchange" />
          <View style={styles.exchangeNotice}>
            <Ionicons name="flask" size={13} color={BLOOM_ACCENT} />
            <Text style={styles.exchangeNoticeTxt}>
              Spend the Epidemic Tokens you earn from Ward Shift runs here. You currently
              hold {tokens.toLocaleString()}. Items marked Coming Soon aren't redeemable yet.
            </Text>
          </View>
          <InlineNotice notice={notice} icon="flask" testID="world-event-exchange-notice" />
          {TOKEN_EXCHANGE.map((item) => {
            const locked = !item.grant;
            const affordable = !locked && tokens >= item.cost;
            const busy = busyId === item.id;
            const disabled = locked || !affordable || busy;
            return (
              <View key={item.id} style={styles.exchangeRow} testID={`world-event-exchange-${item.id}`}>
                <View style={[styles.exchangeIconBox, { backgroundColor: item.accentColor + "22" }]}>
                  <Ionicons name={item.icon as any} size={18} color={item.accentColor} />
                </View>
                <Text style={styles.exchangeItemName}>{item.name}</Text>
                <View style={{ flex: 1 }} />
                <View style={styles.exchangeCostBox}>
                  <Ionicons name="flask" size={11} color={affordable || locked ? BLOOM_ACCENT : COLORS.error} />
                  <Text style={[styles.exchangeCost, !affordable && !locked && { color: COLORS.error }]}>
                    {item.cost.toLocaleString()}
                  </Text>
                </View>
                <BadgePill badge={item.badge} />
                <Pressable
                  style={[styles.exchangeBtn, disabled && { opacity: 0.4 }]}
                  onPress={() => handleRedeem(item)}
                  disabled={busy}
                  hitSlop={6}
                  testID={`world-event-exchange-buy-${item.id}`}
                >
                  <Ionicons
                    name={locked ? "lock-closed" : affordable ? "cart" : "close"}
                    size={12}
                    color={COLORS.onBrand}
                  />
                </Pressable>
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}

// ── Boss Tab ──────────────────────────────────────────────────────────────────

function BossTab({ router }: { router: any }) {
  const { player } = usePlayer();
  const boss = VERDANTHA;
  const tokens = player?.epidemic_tokens ?? 0;
  const unlocked = isVerdanthaUnlocked(tokens);
  return (
    <View style={styles.section}>
      {/* Boss hero card */}
      <View style={[styles.bossHeroCard, { borderColor: BLOOM_ACCENT + "66" }]}>
        <LinearGradient
          colors={[BLOOM_DARK + "88", COLORS.surfaceSecondary]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.bossIconCircle}>
          <Ionicons name="skull" size={40} color={BLOOM_ACCENT} />
          <View style={styles.bossGlow} />
        </View>
        <BadgePill badge={boss.badge} />
        <Text style={styles.bossName}>{boss.name}</Text>
        <Text style={styles.bossTitle}>{boss.title}</Text>
        <View style={styles.bossSystemRow}>
          <SystemTag label={boss.primarySystem} color={BLOOM_ACCENT} />
          <SystemTag label={boss.secondarySystem} color="#22D3EE" />
          <SystemTag label={boss.difficulty} color={COLORS.onSurfaceTertiary} />
        </View>
      </View>

      {/* Lore */}
      <SectionHeading icon="book-outline" title="Boss Lore" />
      <View style={styles.bossLoreCard}>
        <Text style={styles.bossLoreTxt}>{boss.lore}</Text>
      </View>

      {/* Clinical context */}
      <SectionHeading icon="medkit-outline" title="Clinical Analog" />
      <View style={[styles.infoBox, { borderColor: BLOOM_ACCENT + "44" }]}>
        <Ionicons name="school-outline" size={15} color={BLOOM_ACCENT} />
        <Text style={styles.infoBoxTxt}>{boss.clinicalAnalog}</Text>
      </View>

      {/* Mechanics */}
      <SectionHeading icon="flash-outline" title="Signature Attack" />
      <View style={styles.attackCard}>
        <Ionicons name="warning" size={16} color="#EF4444" />
        <Text style={styles.attackTxt}>{boss.signatureAttack}</Text>
      </View>

      <SectionHeading icon="shield-checkmark-outline" title="Weaknesses" />
      <View style={[styles.infoBox, { borderColor: COLORS.success + "44" }]}>
        <Ionicons name="shield-checkmark-outline" size={15} color={COLORS.success} />
        <Text style={styles.infoBoxTxt}>{boss.weaknesses}</Text>
      </View>

      {/* Unlock condition */}
      <SectionHeading icon="lock-open-outline" title="Unlock Condition" />
      <View style={[styles.infoBox, { borderColor: COLORS.onSurfaceTertiary + "44" }]}>
        <Ionicons name="people-outline" size={15} color={COLORS.onSurfaceTertiary} />
        <Text style={styles.infoBoxTxt}>{boss.unlockCondition}</Text>
      </View>

      {/* Drop rewards */}
      <SectionHeading icon="gift-outline" title="Boss Drop Rewards" />
      {boss.dropRewards.map((drop, i) => (
        <View key={i} style={styles.dropRow}>
          <Ionicons name="cube-outline" size={14} color={BLOOM_GLOW} />
          <Text style={styles.dropTxt}>{drop}</Text>
        </View>
      ))}

      {/* Challenge entry — routes to the gated /boss encounter screen */}
      <Pressable
        style={[styles.challengeBtn, { borderColor: BLOOM_ACCENT + "88" }]}
        onPress={() => router.push({ pathname: "/boss", params: { bossId: "verdantha" } })}
        testID="world-event-challenge-verdantha"
      >
        <LinearGradient
          colors={[BLOOM_DARK + "AA", "transparent"]}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        />
        <Ionicons name="skull" size={18} color={BLOOM_ACCENT} />
        <View style={{ flex: 1 }}>
          <Text style={styles.challengeTxt}>Challenge Verdantha</Text>
          <Text style={styles.challengeSub}>
            {unlocked ? "Phase III live — enter the battle" : "Manifests at Phase III — Convergence"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={BLOOM_ACCENT} />
      </Pressable>

      {/* Art direction note */}
      <SectionHeading icon="color-palette-outline" title="Art Direction Note" />
      <View style={[styles.artCard, { borderColor: COLORS.brand + "44" }]}>
        <Text style={styles.artLabel}>Concept Art Brief</Text>
        <Text style={styles.artBrief}>{boss.artBrief}</Text>
        <View style={styles.artNotice}>
          <Ionicons name="brush-outline" size={12} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.artNoticeTxt}>
            Art is not yet generated — brief is placeholder for future asset creation.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

function BadgePill({ badge }: { badge: WorldEventBadge }) {
  const color = WORLD_EVENT_BADGE_COLOR[badge];
  return (
    <View style={[styles.badge, { borderColor: color + "60", backgroundColor: color + "18" }]}>
      <Text style={[styles.badgeTxt, { color }]}>{badge.toUpperCase()}</Text>
    </View>
  );
}

function SectionHeading({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Ionicons name={icon as any} size={14} color={BLOOM_ACCENT} />
      <Text style={styles.sectionHeadingTxt}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

function SystemTag({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.systemTag, { borderColor: color + "55" }]}>
      <Text style={[styles.systemTagTxt, { color }]}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: COLORS.surface },
  loading:  { alignItems: "center", justifyContent: "center" },

  lockedWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.md,
  },
  lockedIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: BLOOM_ACCENT + "1A", borderWidth: 1, borderColor: BLOOM_ACCENT + "55",
    alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm,
  },
  lockedKicker: { color: BLOOM_ACCENT, fontSize: 10, fontWeight: "700", letterSpacing: 2 },
  lockedTitle:  { color: COLORS.onSurface, fontSize: 24, fontWeight: "300", textAlign: "center" },
  lockedBody:   {
    color: COLORS.onSurfaceSecondary, fontSize: 14, lineHeight: 21,
    textAlign: "center", maxWidth: 340,
  },
  lockedBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.brand, borderRadius: RADIUS.pill,
    paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl, marginTop: SPACING.md,
  },
  lockedBtnTxt: { color: COLORS.onBrand, fontSize: 13, fontWeight: "700", letterSpacing: 1 },

  header: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    padding: SPACING.lg, paddingBottom: SPACING.sm, overflow: "hidden",
    backgroundColor: BLOOM_DARK + "44",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  kicker:   { color: BLOOM_ACCENT, fontSize: 9, fontWeight: "700", letterSpacing: 2 },
  title:    { color: COLORS.onSurface, fontSize: 22, fontWeight: "300", lineHeight: 26 },
  subtitle: { color: BLOOM_ACCENT + "BB", fontSize: 11, marginTop: 2 },

  noticeBar: {
    flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm,
    marginHorizontal: SPACING.lg, marginVertical: SPACING.sm,
    backgroundColor: BLOOM_DARK + "44", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: BLOOM_ACCENT + "44", padding: SPACING.md,
  },
  noticeTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16, flex: 1 },

  tabBar: {
    flexDirection: "row", paddingHorizontal: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
    gap: 2,
  },
  tabBtn: {
    flex: 1, alignItems: "center", flexDirection: "row", justifyContent: "center",
    gap: 4, paddingVertical: SPACING.sm, borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: BLOOM_ACCENT },
  tabTxt:       { color: COLORS.onSurfaceTertiary, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  tabTxtActive: { color: BLOOM_ACCENT },

  scroll:  { padding: SPACING.lg, gap: SPACING.md, paddingBottom: 100 },
  section: { gap: SPACING.md },

  // Section heading
  sectionHeading:    { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  sectionHeadingTxt: { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },
  sectionSub:        { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },

  // Badge
  badge:    { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2 },
  badgeTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 1 },

  // Lore card
  headerTokenPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: BLOOM_ACCENT + "1F", borderColor: BLOOM_ACCENT + "55", borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 3 },
  headerTokenTxt: { color: BLOOM_ACCENT, fontSize: 11, fontWeight: "800" },
  contributionCard: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1,
    padding: SPACING.lg, overflow: "hidden",
  },
  contributionIconBox: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  contributionValue: { color: BLOOM_ACCENT, fontSize: 24, fontWeight: "800" },
  contributionLabel: { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "600" },
  contributionHint: { color: COLORS.onSurfaceTertiary, fontSize: 10, flex: 1, textAlign: "right", lineHeight: 14 },

  // Sanctuary Corruption Meter
  corruptionCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1,
    padding: SPACING.lg, gap: SPACING.sm, overflow: "hidden",
  },
  corruptionTopRow: { flexDirection: "row", alignItems: "baseline", gap: SPACING.xs },
  corruptionValue:  { color: BLOOM_ACCENT, fontSize: 22, fontWeight: "800" },
  corruptionMax:    { color: COLORS.onSurfaceSecondary, fontSize: 11, fontWeight: "600" },
  corruptionTrack:  { height: 8, backgroundColor: COLORS.surfaceTertiary, borderRadius: 4, overflow: "hidden" },
  corruptionFill:   { height: "100%", borderRadius: 4, backgroundColor: "#EF4444", alignSelf: "flex-end" },
  corruptionHint:   { color: COLORS.onSurfaceTertiary, fontSize: 10, lineHeight: 14 },

  loreCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1,
    padding: SPACING.lg, gap: SPACING.sm, overflow: "hidden",
  },
  loreChapter: { color: BLOOM_ACCENT, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  loreFlavor:  { color: COLORS.onSurface, fontSize: 13, lineHeight: 20, fontStyle: "italic" },
  loreDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.xs },
  infoRow:     { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  infoRowLabel:{ color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700", minWidth: 54 },
  infoRowValue:{ color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16, flex: 1 },

  // Threat
  threatCard: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: BLOOM_DARK + "44", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: BLOOM_ACCENT + "44", padding: SPACING.md,
  },
  threatTxt: { color: COLORS.onSurface, fontSize: 12, lineHeight: 18, flex: 1 },

  // Phases
  phaseRow: {
    flexDirection: "row", gap: SPACING.md, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  phaseIndex: {
    width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
  },
  phaseIndexTxt: { fontSize: 14, fontWeight: "700" },
  phaseTopRow:   { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  phaseLabel:    { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", flex: 1 },
  phaseDesc:     { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 16 },
  progressTrack: { height: 6, backgroundColor: COLORS.surfaceTertiary, borderRadius: 3, overflow: "hidden", marginTop: 4 },
  progressFill:  { height: "100%", borderRadius: 3 },
  phaseThreshold:{ color: COLORS.onSurfaceTertiary, fontSize: 10 },

  collectiveNote: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    padding: SPACING.md, backgroundColor: COLORS.surfaceSecondary,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border,
  },
  collectiveNoteTxt: { color: COLORS.onSurfaceTertiary, fontSize: 11, lineHeight: 16, flex: 1, fontStyle: "italic" },

  // Systems
  systemCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 1,
    padding: SPACING.md, gap: SPACING.sm, overflow: "hidden",
  },
  systemCardHeader: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  systemIconBox:    { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  systemTitleRow:   { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  systemName:       { fontSize: 14, fontWeight: "700" },
  systemShort:      { color: COLORS.onSurfaceSecondary, fontSize: 11, marginTop: 2 },
  systemBody:       { gap: SPACING.xs, paddingLeft: 44 + SPACING.sm },
  systemMechanic:   { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 17 },
  systemContribRow: { flexDirection: "row", gap: 4, alignItems: "flex-start" },
  systemContrib:    { color: COLORS.onSurface, fontSize: 11, flex: 1 },
  systemHintRow:    { flexDirection: "row", gap: 4, alignItems: "flex-start" },
  systemHint:       { color: COLORS.onSurfaceTertiary, fontSize: 10, flex: 1, fontStyle: "italic" },

  // Rewards filter
  filterRow: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  filterPill: {
    paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.pill,
    backgroundColor: COLORS.surfaceSecondary, borderWidth: 1, borderColor: COLORS.border,
  },
  filterPillActive: { borderColor: BLOOM_ACCENT, backgroundColor: BLOOM_ACCENT + "18" },
  filterTxt:        { color: COLORS.onSurfaceTertiary, fontSize: 11, fontWeight: "700" },
  filterTxtActive:  { color: BLOOM_ACCENT },

  // Milestones
  milestoneCard: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  milestoneTierBadge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: BLOOM_DARK + "66",
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BLOOM_ACCENT + "44",
  },
  milestoneTierTxt: { color: BLOOM_ACCENT, fontSize: 12, fontWeight: "800" },
  msTopRow:  { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  msLabel:   { color: COLORS.onSurface, fontSize: 13, fontWeight: "700", flex: 1 },
  msReq:     { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 15 },
  msRewardRow: { flexDirection: "row", gap: 4, flexWrap: "wrap", marginTop: 2 },
  msRewardChip: {
    flexDirection: "row", alignItems: "center", gap: 3, borderWidth: 1,
    borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 2,
  },
  msRewardTxt: { fontSize: 9, fontWeight: "700" },
  msProgressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  msProgressTrack: {
    flex: 1, height: 5, borderRadius: 3, backgroundColor: COLORS.surfaceTertiary, overflow: "hidden",
  },
  msProgressFill: { height: "100%", borderRadius: 3, backgroundColor: BLOOM_ACCENT },
  msProgressTxt: { color: COLORS.onSurfaceSecondary, fontSize: 9, fontWeight: "700", minWidth: 34, textAlign: "right" },
  msClaimBtn: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: BLOOM_ACCENT,
    alignItems: "center", justifyContent: "center",
  },
  msClaimBtnDisabled: { backgroundColor: COLORS.surfaceTertiary },
  msClaimBtnClaimed: { backgroundColor: "#34D39922", borderWidth: 1, borderColor: "#34D39966" },

  // Catalog
  catalogGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  catalogCard: {
    width: "47%", backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, padding: SPACING.md, gap: SPACING.xs,
  },
  catalogIconBox: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  catalogMeta:    { flexDirection: "row", gap: 4, alignItems: "center", flexWrap: "wrap" },
  catalogCategory:{ color: COLORS.onSurfaceTertiary, fontSize: 9, letterSpacing: 0.5, fontWeight: "700" },
  catalogName:    { fontSize: 12, fontWeight: "700", lineHeight: 15 },
  catalogDesc:    { color: COLORS.onSurfaceSecondary, fontSize: 10, lineHeight: 14 },
  catalogSourceRow:{ flexDirection: "row", gap: 3, alignItems: "flex-start", marginTop: 2 },
  catalogSource:  { color: COLORS.onSurfaceTertiary, fontSize: 9, flex: 1, lineHeight: 13 },

  // Exchange
  exchangeNotice: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: BLOOM_DARK + "44", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: BLOOM_ACCENT + "44", padding: SPACING.md,
  },
  exchangeNoticeTxt: { color: COLORS.onSurfaceSecondary, fontSize: 11, lineHeight: 15, flex: 1 },
  exchangeRow: {
    flexDirection: "row", alignItems: "center", gap: SPACING.sm,
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: COLORS.border, padding: SPACING.md,
  },
  exchangeIconBox:  { width: 34, height: 34, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  exchangeItemName: { color: COLORS.onSurface, fontSize: 12, fontWeight: "600" },
  exchangeCostBox:  { flexDirection: "row", alignItems: "center", gap: 3 },
  exchangeCost:     { color: BLOOM_ACCENT, fontSize: 12, fontWeight: "700" },
  exchangeBtn: {
    width: 28, height: 28, borderRadius: 6, backgroundColor: BLOOM_ACCENT,
    alignItems: "center", justifyContent: "center",
  },

  // Boss
  bossHeroCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg, borderWidth: 2,
    padding: SPACING.xl, alignItems: "center", gap: SPACING.sm, overflow: "hidden",
  },
  bossIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: BLOOM_DARK + "88", alignItems: "center", justifyContent: "center" },
  bossGlow:  { position: "absolute", width: 80, height: 80, borderRadius: 40, backgroundColor: BLOOM_ACCENT + "22" },
  bossName:  { color: BLOOM_ACCENT, fontSize: 26, fontWeight: "300", letterSpacing: 1 },
  bossTitle: { color: COLORS.onSurfaceSecondary, fontSize: 13 },
  bossSystemRow: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap", justifyContent: "center" },
  systemTag: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 8, paddingVertical: 2 },
  systemTagTxt: { fontSize: 10, fontWeight: "700" },

  bossLoreCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, borderColor: BLOOM_ACCENT + "33", padding: SPACING.lg,
  },
  bossLoreTxt: { color: COLORS.onSurface, fontSize: 13, lineHeight: 21, fontStyle: "italic" },

  infoBox: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.md,
    borderWidth: 1, padding: SPACING.md,
  },
  infoBoxTxt: { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18, flex: 1 },

  attackCard: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start",
    backgroundColor: "#EF444418", borderRadius: RADIUS.md,
    borderWidth: 1, borderColor: "#EF444444", padding: SPACING.md,
  },
  attackTxt: { color: COLORS.onSurface, fontSize: 12, lineHeight: 18, flex: 1 },

  dropRow: {
    flexDirection: "row", gap: SPACING.sm, alignItems: "center",
    paddingVertical: SPACING.xs, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  dropTxt: { color: COLORS.onSurface, fontSize: 12 },

  challengeBtn: {
    flexDirection: "row", alignItems: "center", gap: SPACING.md,
    marginTop: SPACING.md, padding: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden",
    backgroundColor: COLORS.surfaceSecondary,
  },
  challengeTxt: { color: COLORS.onSurface, fontSize: 14, fontWeight: "700" },
  challengeSub: { color: COLORS.onSurfaceTertiary, fontSize: 11, marginTop: 2 },

  artCard: {
    backgroundColor: COLORS.surfaceSecondary, borderRadius: RADIUS.lg,
    borderWidth: 1, padding: SPACING.md, gap: SPACING.sm,
  },
  artLabel:   { color: COLORS.brand, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  artBrief:   { color: COLORS.onSurfaceSecondary, fontSize: 12, lineHeight: 18, fontStyle: "italic" },
  artNotice:  { flexDirection: "row", gap: 4, alignItems: "center" },
  artNoticeTxt: { color: COLORS.onSurfaceTertiary, fontSize: 10 },
});
