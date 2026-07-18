import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PlayerHeader } from "@/src/components/PlayerHeader";
import { usePlayer } from "@/src/game/store";
import { playerLevelFromXp, isFeatureUnlocked, FEATURE_UNLOCKS } from "@/src/game/progression";
import { COLORS, RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

// ─── Push 25: Community Board — Visual Public-Health Map + Public Health Loop ─
// Replaces the old "Faction Embassy" placeholder. No faction systems, no
// multiplayer, no new currencies. Active participation in the Miasma Bloom
// outbreak response gates at Lv7 (world_event); below that, a rich read-only
// preview with map, NPC notices, and preview missions.

// ─── Design tokens ─────────────────────────────────────────────────────────────
const JADE       = "#3DC4A8";
const JADE_DIM   = "#2A8C79";
const JADE_GLOW  = "#6DD5C0";
const GOLD       = "#E8C868";
const SKY        = "#A6D8F6";
const LOTUS      = "#F4A9C4";
const AMBER      = "#F59E0B";
const PANEL      = UI.sanctuaryPanel;
const CARD       = UI.sanctuaryCard;
const BORDER_J   = UI.sanctuaryBorder;

// ─── Ward district map data ────────────────────────────────────────────────────
// Each district has a static infection level showing the public-health map.
// These are narrative/visual — no live multiplayer sync in this push.
const WARD_DISTRICTS = [
  { id: "gate_ward",      name: "Gate Ward",       infectionPct: 0.81, icon: "shield-half-outline",   color: "#EF4444" },
  { id: "outer_market",   name: "Outer Market",    infectionPct: 0.68, icon: "cart-outline",           color: "#F97316" },
  { id: "river_district", name: "River District",  infectionPct: 0.51, icon: "water-outline",          color: AMBER     },
  { id: "scholar_qtr",    name: "Scholar Quarter", infectionPct: 0.33, icon: "book-outline",           color: "#A78BFA" },
  { id: "lotus_quarter",  name: "Lotus Quarter",   infectionPct: 0.22, icon: "flower-outline",         color: LOTUS     },
  { id: "healing_ward",   name: "Healing Ward",    infectionPct: 0.14, icon: "heart-circle-outline",   color: JADE      },
] as const;

// ─── NPC Notice Board ─────────────────────────────────────────────────────────
// Messages from ward NPCs — feel like a real fantasy bulletin board.
const NPC_NOTICES = [
  {
    id: "system",
    name: "The System",
    role: "Realm AI Overseer",
    icon: "hardware-chip-outline",
    color: GOLD,
    tag: "Outbreak Alert",
    message:
      "Community containment is at 18%. All licensed healers must contribute at least one ward shift this cycle. The outer wards cannot hold without your response.",
  },
  {
    id: "baiwen",
    name: "Elder Nurse Baiwen",
    role: "Ward Supervisor",
    icon: "person-circle-outline",
    color: JADE,
    tag: "Hand Hygiene",
    message:
      "Ritual hand-cleansing before every patient contact — without exception. The Bloom spreads through touch. Remind your apprentices before every shift.",
  },
  {
    id: "mei",
    name: "Apprentice Mei",
    role: "Field Scout",
    icon: "person-outline",
    color: SKY,
    tag: "Clean Water",
    message:
      "Fresh clean water barrels arrived at the Outer Market! Stay hydrated — dehydrated healers lose clarity faster than anyone. Grab supplies before your next shift.",
  },
  {
    id: "chun",
    name: "Warden Chun",
    role: "Gate Commander",
    icon: "shield-checkmark-outline",
    color: LOTUS,
    tag: "Rest Protocol",
    message:
      "Please rest between long shifts. The Bloom feeds on exhaustion. A rested healer catches the signs a tired one misses — and that difference saves lives.",
  },
] as const;

// ─── Public health missions ────────────────────────────────────────────────────
// Each mission is grounded in a real public-health concept, expressed through
// fantasy-medical gameplay. No personal advice — educational context only.
// `met`: derived from existing player state; no new stored fields.
const PH_MISSIONS: {
  id: string;
  title: string;
  theme: string;
  icon: string;
  color: string;
  flavor: string;
  taskLabel: string;
  reward: string;
  rewardIcon: string;
  rewardColor: string;
  met: (p: any) => boolean;
}[] = [
  {
    id: "ritual_cleanse",
    title: "Ritual Cleanse",
    theme: "Hand Hygiene",
    icon: "water-outline",
    color: JADE,
    flavor:
      "Cleanse your hands before and after each patient contact. Prevent the Bloom from spreading ward-to-ward.",
    taskLabel: "Complete 1 Ward Shift run",
    reward: "10 Ward Coins",
    rewardIcon: "wallet-outline",
    rewardColor: GOLD,
    met: (p) => (p?.runs_completed ?? 0) >= 1,
  },
  {
    id: "outbreak_watch",
    title: "Outbreak Watch",
    theme: "Awareness",
    icon: "eye-outline",
    color: LOTUS,
    flavor:
      "Know the signs. The Bloom manifests as fever, spreading discoloration, and fatigue. Early recognition contains it fastest.",
    taskLabel: "Visit the Community Board",
    reward: "20 Crowns",
    rewardIcon: "star-outline",
    rewardColor: GOLD,
    met: (_) => true,
  },
  {
    id: "clear_water_ward",
    title: "Clear Water Ward",
    theme: "Clean Water",
    icon: "beaker-outline",
    color: SKY,
    flavor:
      "Ensure the ward water supply is purified. Contaminated water accelerates Bloom spread into surrounding districts.",
    taskLabel: "Complete 1 University lesson",
    reward: "5 University Credits",
    rewardIcon: "school-outline",
    rewardColor: SKY,
    met: (p) => (p?.lessons_completed?.length ?? 0) >= 1,
  },
  {
    id: "rest_protocol",
    title: "Rest Protocol",
    theme: "Sleep & Rest",
    icon: "moon-outline",
    color: "#A78BFA",
    flavor:
      "Mandate rest between extended shifts. Exhausted healers miss critical signs — and the Bloom is patient.",
    taskLabel: "Return on 3 separate days",
    reward: "50 Crowns",
    rewardIcon: "star-outline",
    rewardColor: GOLD,
    met: (p) => (p?.total_logins ?? (p?.runs_completed ?? 0) + (p?.lessons_completed?.length ?? 0)) >= 3,
  },
  {
    id: "community_nourishment",
    title: "Nourishment Distribution",
    theme: "Nutrition",
    icon: "leaf-outline",
    color: AMBER,
    flavor:
      "Distribute ration supplies to ward families. A well-nourished community resists the Bloom far longer.",
    taskLabel: "Complete 5 Ward Shifts total",
    reward: "1 Insight Crystal",
    rewardIcon: "diamond-outline",
    rewardColor: "#22D3EE",
    met: (p) => (p?.runs_completed ?? 0) >= 5,
  },
  {
    id: "ask_for_help",
    title: "Ask for Help",
    theme: "Community Support",
    icon: "people-outline",
    color: JADE_GLOW,
    flavor:
      "No healer works alone. Consult senior practitioners when uncertain. In Clinica, The System guides your path — trust the process.",
    taskLabel: "Complete 3 University lessons",
    reward: "10 University Credits",
    rewardIcon: "school-outline",
    rewardColor: SKY,
    met: (p) => (p?.lessons_completed?.length ?? 0) >= 3,
  },
];

// ─── Reward milestones ─────────────────────────────────────────────────────────
// Existing non-pay-to-win currencies only. No new mode-specific currencies.
const REWARD_MILESTONES = [
  { pts: 5,   name: "First Responder",     reward: "50 Ward Coins",        icon: "wallet-outline",    color: GOLD,      rColor: GOLD      },
  { pts: 15,  name: "Ward Defender",        reward: "200 Crowns",           icon: "star-outline",      color: GOLD,      rColor: GOLD      },
  { pts: 30,  name: "Bloom Fighter",        reward: "5 University Credits", icon: "school-outline",    color: SKY,       rColor: SKY       },
  { pts: 60,  name: "Sentinel Healer",      reward: "1 Insight Crystal",    icon: "diamond-outline",   color: "#22D3EE", rColor: "#22D3EE" },
  { pts: 100, name: "Community Champion",   reward: "Rare Hero Shard ×3",   icon: "people-outline",    color: LOTUS,     rColor: LOTUS     },
] as const;

// ─── Derived community points ─────────────────────────────────────────────────
// Derived from existing player state — no new stored fields required.
function getCommunityPoints(player: any): number {
  if (!player) return 0;
  const runPts    = (player.runs_completed ?? 0) * 3;
  const lessonPts = (player.lessons_completed?.length ?? 0) * 2;
  const visitPt   = 1; // visiting the board always counts
  return runPts + lessonPts + visitPt;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function CommunityBoardScreen() {
  const { player } = usePlayer();
  const router = useRouter();

  if (!player) {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.loading}>
          <Ionicons name="earth" size={32} color={JADE} />
        </View>
      </SafeAreaView>
    );
  }

  const level = player.player_level ?? playerLevelFromXp(player.xp ?? 0).level;
  const worldEventLevel = FEATURE_UNLOCKS.find((f) => f.id === "world_event")?.level ?? 7;
  const active = isFeatureUnlocked("world_event", level);
  const pts    = getCommunityPoints(player);
  const nextMs = REWARD_MILESTONES.find((m) => pts < m.pts);

  return (
    <SafeAreaView style={styles.root} edges={["top"]} testID="community-board-screen">
      <PlayerHeader player={player} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        testID="community-board-scroll"
      >
        {/* ── 1. Visual map hero ── */}
        <MapHeroSection />

        {/* ── 2. Threat + contribution meters ── */}
        <MeterSection active={active} pts={pts} worldEventLevel={worldEventLevel} />

        {/* ── 3. NPC Notice Board ── */}
        <NoticeBoardSection />

        {/* ── 4. Public health missions ── */}
        <MissionsSection player={player} active={active} worldEventLevel={worldEventLevel} />

        {/* ── 5. Reward milestones ── */}
        <MilestonesSection pts={pts} nextMs={nextMs} active={active} worldEventLevel={worldEventLevel} />

        {/* ── 6. Deep-link to full World Event (active players only) ── */}
        {active && (
          <Pressable
            style={styles.eventLink}
            onPress={() => router.push("/world-event" as any)}
            testID="community-board-world-event-link"
          >
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: JADE_DIM + "30", pointerEvents: "none" }]} />
            <View style={styles.eventLinkIconWrap}>
              <Ionicons name="earth" size={20} color={JADE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.eventLinkTitle}>Miasma Bloom World Event</Text>
              <Text style={styles.eventLinkSub}>
                Full event dashboard · token exchange · boss encounter
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={JADE} />
          </Pressable>
        )}

        {/* ── Disclaimer ── */}
        <Text style={styles.disclaimer}>
          Public health content is educational context only — not medical advice. Clinica is a game.
          Always consult a qualified health professional for real health concerns.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── 1. Map Hero Section ──────────────────────────────────────────────────────
function MapHeroSection() {
  return (
    <View style={[styles.mapHero, { backgroundColor: "#0D2035" }]} testID="community-board-map">

      {/* Header text */}
      <View style={styles.mapHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.mapKicker}>OUTER WARDS · MIASMA BLOOM WATCH</Text>
          <Text style={styles.mapTitle}>Community Health Board</Text>
          <Text style={styles.mapSub}>
            Following the Bloom outbreak across all ward districts
          </Text>
        </View>
        <View style={styles.outbreakBadge}>
          <Ionicons name="alert-circle" size={10} color={JADE} />
          <Text style={styles.outbreakBadgeTxt}>ACTIVE{"\n"}OUTBREAK</Text>
        </View>
      </View>

      {/* District grid — the visual public-health map */}
      <View style={styles.districtGrid}>
        {WARD_DISTRICTS.map((d) => (
          <DistrictTile key={d.id} district={d} />
        ))}
      </View>

      {/* Map legend */}
      <View style={styles.mapLegend}>
        {(
          [
            { label: "Contained",  color: JADE     },
            { label: "At Risk",    color: AMBER    },
            { label: "Spreading",  color: "#EF4444"},
          ] as const
        ).map((l) => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendTxt}>{l.label}</Text>
          </View>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={styles.legendNote}>Preview map · not live-synced</Text>
      </View>
    </View>
  );
}

function DistrictTile({ district }: { district: typeof WARD_DISTRICTS[number] }) {
  const inf = district.infectionPct;
  const col = inf > 0.65 ? "#EF4444" : inf > 0.4 ? AMBER : JADE;
  return (
    <View style={[styles.districtTile, { borderColor: col + "55", backgroundColor: col + "12" }]}>
      <Ionicons name={district.icon as any} size={15} color={col} />
      <Text style={styles.districtName} numberOfLines={1}>{district.name}</Text>
      <View style={styles.districtTrack}>
        <View style={[styles.districtFill, { width: `${inf * 100}%` as any, backgroundColor: col }]} />
      </View>
      <Text style={[styles.districtPct, { color: col }]}>
        {Math.round(inf * 100)}%
      </Text>
    </View>
  );
}

// ─── 2. Meters ────────────────────────────────────────────────────────────────
function MeterSection({ active, pts, worldEventLevel }: {
  active: boolean;
  pts: number;
  worldEventLevel: number;
}) {
  const bloomSpreadPct       = 0.62;  // static narrative value
  const communityContainPct  = 0.18;  // static community value (no live sync yet)
  const personalFraction     = Math.min(1, pts / 100);

  return (
    <View style={styles.meterSection} testID="community-board-meters">
      {/* Miasma Bloom spread */}
      <View style={styles.meterCard}>
        <View style={styles.meterRow}>
          <View style={[styles.meterIconWrap, { backgroundColor: "#EF444420" }]}>
            <Ionicons name="warning-outline" size={15} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.meterTitle}>Miasma Bloom Spread</Text>
            <Text style={styles.meterCaption}>How far the outbreak has reached across the Sanctuary</Text>
          </View>
          <Text style={[styles.meterBig, { color: "#EF4444" }]}>
            {Math.round(bloomSpreadPct * 100)}%
          </Text>
        </View>
        {/* tri-color bar: jade → amber → red shows health-to-danger */}
        <View style={styles.meterTrackWrap}>
          <View style={{ flexDirection: "row", flex: 1, borderRadius: 4, overflow: "hidden" }}>
            <View style={{ flex: 1, backgroundColor: JADE }} />
            <View style={{ flex: 1, backgroundColor: AMBER }} />
            <View style={{ flex: 1, backgroundColor: "#EF4444" }} />
          </View>
          {/* dark overlay on the "not yet spread" portion */}
          <View style={[styles.meterUnspread, { width: `${(1 - bloomSpreadPct) * 100}%` as any }]} />
        </View>
        <View style={styles.meterHints}>
          <Text style={styles.meterHintTxt}>← Contained</Text>
          <Text style={styles.meterHintTxt}>Spreading →</Text>
        </View>
      </View>

      {/* Community protection */}
      <View style={styles.meterCard}>
        <View style={styles.meterRow}>
          <View style={[styles.meterIconWrap, { backgroundColor: JADE + "20" }]}>
            <Ionicons name="people-outline" size={15} color={JADE} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.meterTitle}>Community Protection</Text>
            <Text style={styles.meterCaption}>
              {active
                ? "Collective healer effort pushing back the Bloom"
                : "Collective healer effort (preview — join at Level " + worldEventLevel + ")"}
            </Text>
          </View>
          <Text style={[styles.meterBig, { color: JADE }]}>
            {Math.round(communityContainPct * 100)}%
          </Text>
        </View>
        <View style={styles.meterTrackWrap}>
          <View style={[styles.meterFill, { width: `${communityContainPct * 100}%` as any }]} />
        </View>
        {!active && (
          <View style={styles.meterNote}>
            <Ionicons name="lock-closed-outline" size={10} color={JADE + "99"} />
            <Text style={styles.meterNoteTxt}>
              Your personal contribution bar activates when you join the outbreak response.
            </Text>
          </View>
        )}
      </View>

      {/* Personal contribution — active players only */}
      {active && (
        <View style={[styles.meterCard, { borderColor: GOLD + "44" }]}>
          <View style={styles.meterRow}>
            <View style={[styles.meterIconWrap, { backgroundColor: GOLD + "20" }]}>
              <Ionicons name="flask-outline" size={15} color={GOLD} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.meterTitle}>Your Contribution</Text>
              <Text style={styles.meterCaption}>{pts} community points earned</Text>
            </View>
            <Text style={[styles.meterBig, { color: GOLD }]}>{pts}</Text>
          </View>
          <View style={styles.meterTrackWrap}>
            <View style={[styles.meterFill, { width: `${personalFraction * 100}%` as any, backgroundColor: GOLD }]} />
          </View>
          <Text style={styles.meterCaption}>Earn points from Ward Shifts, lessons, and public health missions.</Text>
        </View>
      )}
    </View>
  );
}

// ─── 3. NPC Notice Board ─────────────────────────────────────────────────────
function NoticeBoardSection() {
  return (
    <View style={styles.section} testID="community-board-notices">
      <SectionHeader icon="mail-open-outline" title="Ward Notice Board" color={GOLD} />
      <Text style={styles.sectionSub}>
        Messages from ward staff and The System. Posted for all licensed healers.
      </Text>
      {NPC_NOTICES.map((n) => (
        <NoticeCard key={n.id} notice={n} />
      ))}
    </View>
  );
}

function NoticeCard({ notice }: { notice: typeof NPC_NOTICES[number] }) {
  return (
    <View
      style={[styles.noticeCard, { borderColor: notice.color + "35" }]}
      testID={`community-notice-${notice.id}`}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: notice.color + "08", pointerEvents: "none" }]} />
      <View style={styles.noticeTop}>
        <View style={[styles.noticeAvatar, { backgroundColor: notice.color + "20", borderColor: notice.color + "55" }]}>
          <Ionicons name={notice.icon as any} size={16} color={notice.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.noticeName}>{notice.name}</Text>
          <Text style={styles.noticeRole}>{notice.role}</Text>
        </View>
        <View style={[styles.noticeTag, { borderColor: notice.color + "55", backgroundColor: notice.color + "18" }]}>
          <Text style={[styles.noticeTagTxt, { color: notice.color }]}>{notice.tag}</Text>
        </View>
      </View>
      <Text style={styles.noticeMsg}>"{notice.message}"</Text>
    </View>
  );
}

// ─── 4. Public Health Missions ────────────────────────────────────────────────
function MissionsSection({ player, active, worldEventLevel }: {
  player: any;
  active: boolean;
  worldEventLevel: number;
}) {
  return (
    <View style={styles.section} testID="community-board-missions">
      <SectionHeader icon="checkbox-outline" title="Public Health Missions" color={JADE} />
      <Text style={styles.sectionSub}>
        {active
          ? "Complete missions to earn community points and push back the Bloom."
          : `Preview — active missions unlock at Level ${worldEventLevel}. You can see what's coming.`}
      </Text>

      {/* Locked state: hopeful teaser, not a dead wall */}
      {!active && (
        <View style={styles.previewBanner} testID="community-board-preview-banner">
          <Ionicons name="earth-outline" size={22} color={JADE} />
          <View style={{ flex: 1 }}>
            <Text style={styles.previewBannerTitle}>The Bloom is spreading — but you can help.</Text>
            <Text style={styles.previewBannerBody}>
              Complete public health missions to earn community points, protect the outer wards, and
              push back the Miasma Bloom. Reach{" "}
              <Text style={{ color: JADE, fontWeight: "700" }}>
                Level {worldEventLevel}
              </Text>{" "}
              to join the outbreak response.
            </Text>
          </View>
        </View>
      )}

      {PH_MISSIONS.map((m) => (
        <MissionCard key={m.id} mission={m} player={player} active={active} />
      ))}
    </View>
  );
}

function MissionCard({ mission, player, active }: {
  mission: typeof PH_MISSIONS[number];
  player: any;
  active: boolean;
}) {
  const done       = mission.met(player);
  const statusCol  = !active ? COLORS.onSurfaceTertiary : done ? JADE : mission.color;
  const doneIcon   = done && active ? "checkmark-circle" : mission.icon;

  return (
    <View
      style={[styles.missionCard, { borderColor: statusCol + "35" }]}
      testID={`community-mission-${mission.id}`}
    >
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: statusCol + "08", pointerEvents: "none" }]} />
      {/* Header */}
      <View style={styles.missionTop}>
        <View style={[styles.missionIconBox, { backgroundColor: statusCol + "20" }]}>
          <Ionicons name={doneIcon as any} size={18} color={statusCol} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.missionTitle, { color: done && active ? JADE : UI.text }]}>
            {mission.title}
          </Text>
          <View style={[styles.themeChip, { borderColor: statusCol + "44", backgroundColor: statusCol + "14" }]}>
            <Text style={[styles.themeChipTxt, { color: statusCol }]}>{mission.theme}</Text>
          </View>
        </View>
        {active ? (
          <View style={[styles.statusDot, { backgroundColor: done ? JADE : COLORS.border }]}>
            {done && <Ionicons name="checkmark" size={9} color="#082019" />}
          </View>
        ) : (
          <Ionicons name="lock-closed-outline" size={13} color={COLORS.onSurfaceTertiary} />
        )}
      </View>

      {/* Flavor text */}
      <Text style={styles.missionFlavor}>{mission.flavor}</Text>

      {/* Task + reward */}
      <View style={styles.missionFooter}>
        <View style={styles.missionTaskRow}>
          <Ionicons name="chevron-forward-circle-outline" size={11} color={COLORS.onSurfaceTertiary} />
          <Text style={styles.missionTask}>{mission.taskLabel}</Text>
        </View>
        <View style={styles.missionRewardRow}>
          <Ionicons name={mission.rewardIcon as any} size={11} color={mission.rewardColor} />
          <Text style={[styles.missionReward, { color: done && active ? mission.rewardColor : COLORS.onSurfaceTertiary }]}>
            {mission.reward}
          </Text>
          {done && active && (
            <View style={styles.earnedChip}>
              <Text style={styles.earnedChipTxt}>EARNED</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── 5. Reward Milestones ─────────────────────────────────────────────────────
function MilestonesSection({ pts, nextMs, active, worldEventLevel }: {
  pts: number;
  nextMs: typeof REWARD_MILESTONES[number] | undefined;
  active: boolean;
  worldEventLevel: number;
}) {
  return (
    <View style={styles.section} testID="community-board-milestones">
      <SectionHeader icon="trophy-outline" title="Reward Milestones" color={GOLD} />
      <Text style={styles.sectionSub}>
        {active
          ? nextMs
            ? `You have ${pts} community points. Next milestone: ${nextMs.name} at ${nextMs.pts} pts.`
            : `${pts} pts — all milestones reached. Outstanding work, Healer.`
          : `Preview — milestones activate at Level ${worldEventLevel}. Rewards use only existing currencies.`}
      </Text>

      <View style={styles.milestonesList}>
        {REWARD_MILESTONES.map((ms) => {
          const reached = active && pts >= ms.pts;
          const isNext  = active && !reached && nextMs?.pts === ms.pts;
          const dimCol  = reached ? ms.color : isNext ? ms.color + "BB" : COLORS.onSurfaceTertiary;
          return (
            <View key={ms.pts} style={styles.milestoneRow} testID={`community-milestone-${ms.pts}`}>
              {/* Left indicator dot */}
              <View style={[
                styles.msDot,
                {
                  borderColor: dimCol,
                  backgroundColor: reached ? ms.color + "30" : CARD,
                },
              ]}>
                {reached
                  ? <Ionicons name="checkmark" size={10} color={ms.color} />
                  : <Text style={[styles.msDotTxt, { color: dimCol }]}>{ms.pts}</Text>
                }
              </View>

              {/* Milestone card */}
              <View style={[styles.msCard, { borderColor: dimCol + "35" }]}>
                <View style={[StyleSheet.absoluteFillObject, { backgroundColor: dimCol + "08", pointerEvents: "none" }]} />
                <View style={styles.msCardTop}>
                  <Text style={[styles.msPts, { color: dimCol }]}>{ms.pts} pts</Text>
                  <Text style={[styles.msName, { color: reached ? UI.text : UI.textDim }]}>
                    {ms.name}
                  </Text>
                  {reached && (
                    <View style={styles.msReachedBadge}>
                      <Text style={styles.msReachedTxt}>✓ REACHED</Text>
                    </View>
                  )}
                  {isNext && (
                    <View style={[styles.msReachedBadge, { backgroundColor: GOLD + "20", borderColor: GOLD + "55" }]}>
                      <Text style={[styles.msReachedTxt, { color: GOLD }]}>NEXT</Text>
                    </View>
                  )}
                </View>
                <View style={styles.msRewardRow}>
                  <Ionicons name={ms.icon as any} size={12} color={reached ? ms.rColor : COLORS.onSurfaceTertiary} />
                  <Text style={[styles.msReward, { color: reached ? ms.rColor : COLORS.onSurfaceTertiary }]}>
                    {ms.reward}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Shared primitives ────────────────────────────────────────────────────────
function SectionHeader({ icon, title, color }: { icon: string; title: string; color: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={13} color={color} />
      <Text style={[styles.sectionHeaderTxt, { color }]}>{title.toUpperCase()}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: UI.sanctuaryBg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:  { gap: SPACING.md, paddingBottom: SPACING.xxxl },

  // ── Map hero ──────────────────────────────────────────────────────────────
  mapHero: {
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.md,
    gap: SPACING.md,
    overflow: "hidden",
    borderBottomWidth: 1,
    borderBottomColor: BORDER_J,
  },
  mapHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  mapKicker: {
    color: JADE,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 2,
  },
  mapTitle: {
    color: UI.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  mapSub: {
    color: UI.textSoft,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  outbreakBadge: {
    alignItems: "center",
    gap: 2,
    backgroundColor: JADE + "18",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: JADE + "44",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    minWidth: 68,
    marginTop: 4,
  },
  outbreakBadgeTxt: {
    color: JADE,
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.2,
    textAlign: "center",
    lineHeight: 11,
  },

  // District grid
  districtGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  districtTile: {
    width: "47%",
    backgroundColor: CARD,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    gap: 3,
    overflow: "hidden",
  },
  districtName: { color: UI.text, fontSize: 11, fontWeight: "700" },
  districtTrack: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: "hidden",
    marginTop: 2,
  },
  districtFill: { height: "100%", borderRadius: 2 },
  districtPct:  { fontSize: 9, fontWeight: "700" },

  // Map legend
  mapLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    flexWrap: "wrap",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot:  { width: 7, height: 7, borderRadius: 4 },
  legendTxt:  { color: UI.textDim, fontSize: 10, fontWeight: "600" },
  legendNote: { color: UI.textDim, fontSize: 9, fontStyle: "italic" },

  // ── Meters ────────────────────────────────────────────────────────────────
  meterSection: { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  meterCard: {
    backgroundColor: PANEL,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BORDER_J,
    padding: SPACING.md,
    gap: SPACING.sm,
    overflow: "hidden",
  },
  meterRow:     { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  meterIconWrap: { width: 32, height: 32, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  meterTitle:   { color: UI.text, fontSize: 13, fontWeight: "700" },
  meterCaption: { color: UI.textDim, fontSize: 10, lineHeight: 14, marginTop: 1 },
  meterBig:     { fontSize: 20, fontWeight: "800" },
  meterTrackWrap: {
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
    overflow: "hidden",
    position: "relative",
  },
  meterUnspread: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.surface + "DD",
  },
  meterFill: { height: "100%", borderRadius: 4, backgroundColor: JADE },
  meterHints: { flexDirection: "row", justifyContent: "space-between" },
  meterHintTxt: { color: UI.textDim, fontSize: 9, fontWeight: "600" },
  meterNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: JADE + "0F",
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
  },
  meterNoteTxt: { color: UI.textDim, fontSize: 10, lineHeight: 14, flex: 1 },

  // ── Section shared ─────────────────────────────────────────────────────────
  section:          { gap: SPACING.sm, paddingHorizontal: SPACING.lg },
  sectionHeader:    { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.xs },
  sectionHeaderTxt: { fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  sectionSub:       { color: UI.textSoft, fontSize: 12, lineHeight: 17 },

  // ── Notice cards ──────────────────────────────────────────────────────────
  noticeCard: {
    backgroundColor: PANEL,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    overflow: "hidden",
  },
  noticeTop: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  noticeAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noticeName: { color: UI.text, fontSize: 13, fontWeight: "700" },
  noticeRole: { color: UI.textDim, fontSize: 10, marginTop: 1 },
  noticeTag: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  noticeTagTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  noticeMsg: {
    color: UI.textSoft,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: "italic",
  },

  // ── Preview banner (locked missions state) ────────────────────────────────
  previewBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: JADE + "10",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: JADE + "35",
    padding: SPACING.md,
    overflow: "hidden",
  },
  previewBannerTitle: {
    color: UI.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  previewBannerBody: {
    color: UI.textSoft,
    fontSize: 12,
    lineHeight: 18,
  },

  // ── Mission cards ─────────────────────────────────────────────────────────
  missionCard: {
    backgroundColor: PANEL,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    gap: SPACING.sm,
    overflow: "hidden",
  },
  missionTop: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.sm },
  missionIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  missionTitle:  { color: UI.text, fontSize: 13, fontWeight: "700" },
  themeChip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  themeChipTxt: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  statusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  missionFlavor: {
    color: UI.textSoft,
    fontSize: 11,
    lineHeight: 16,
    fontStyle: "italic",
  },
  missionFooter: { gap: 3, marginTop: SPACING.xs },
  missionTaskRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  missionTask:    { color: UI.textDim, fontSize: 10, flex: 1 },
  missionRewardRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  missionReward:  { fontSize: 11, fontWeight: "700" },
  earnedChip: {
    backgroundColor: JADE + "20",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: JADE + "55",
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  earnedChipTxt: { color: JADE, fontSize: 7, fontWeight: "800", letterSpacing: 1 },

  // ── Milestones ────────────────────────────────────────────────────────────
  milestonesList: { gap: SPACING.sm },
  milestoneRow:   { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  msDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  msDotTxt: { fontSize: 8, fontWeight: "800" },
  msCard: {
    flex: 1,
    backgroundColor: PANEL,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    gap: 4,
    overflow: "hidden",
  },
  msCardTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  msPts:     { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, minWidth: 40 },
  msName:    { fontSize: 12, fontWeight: "700", flex: 1 },
  msReachedBadge: {
    backgroundColor: JADE + "20",
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: JADE + "55",
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  msReachedTxt: { color: JADE, fontSize: 7, fontWeight: "800", letterSpacing: 1 },
  msRewardRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  msReward:     { fontSize: 11 },

  // ── World Event deep-link ─────────────────────────────────────────────────
  eventLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    backgroundColor: PANEL,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: JADE + "44",
    padding: SPACING.md,
    overflow: "hidden",
  },
  eventLinkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: JADE + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  eventLinkTitle: { color: UI.text, fontSize: 13, fontWeight: "700" },
  eventLinkSub:   { color: UI.textDim, fontSize: 10, marginTop: 1 },

  // ── Disclaimer ────────────────────────────────────────────────────────────
  disclaimer: {
    color: UI.textDim,
    fontSize: 10,
    lineHeight: 14,
    textAlign: "center",
    marginHorizontal: SPACING.lg,
    fontStyle: "italic",
  },
});
