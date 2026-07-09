// ────────────────────────────────────────────────────────────────────────────
// WORLD EVENT FOUNDATION — Push 10: Miasma Bloom
// ────────────────────────────────────────────────────────────────────────────
// This module is DATA + DOCUMENTATION only. It does not wire any gameplay,
// currencies, purchases, multiplayer, leaderboards, or online synchronisation.
// All `progress` values are static preview numbers for UI layout purposes.
// Every entry carries a `badge` of "Preview" | "Planned" | "Coming Soon".
//
// Art direction: donghua / manhwa / anime (Genshin-style cel shading, luminous
// teal-green-gold palette, soft clean linework). NOT western comic-book style.
// ────────────────────────────────────────────────────────────────────────────

export type WorldEventBadge = "Preview" | "Planned" | "Coming Soon";

// ── Lore ────────────────────────────────────────────────────────────────────

export interface WorldEventLore {
  title: string;
  subtitle: string;
  flavor: string;
  chapter: string;
  setting: string;
  threat: string;
  hook: string;
}

export const MIASMA_BLOOM_LORE: WorldEventLore = {
  title: "Miasma Bloom",
  subtitle: "A Realm-Wide Epidemic Event",
  flavor:
    "The Verdant Miasma — a luminous, spore-bearing fungal entity — has drifted from the Outer Wilds into the Sanctuary districts, seeding disease-bloom outbreaks across every ward. It is not a single patient, not a single battle. It is a tide.",
  chapter: "Interlude I — Between the Wards",
  setting:
    "The Sanctuary of Clinica, Grand Ward Atrium and its surrounding districts",
  threat:
    "Miasma Bloom is a slow-moving epidemic — it does not attack directly but corrupts the land itself, weakening healer effectiveness and multiplying disease-monster pressure until the Sanctuary's Vital Lantern dims. Every system in the Sanctuary must coordinate: ward shifts slow the spread, Ward Defense holds the perimeter, the University develops countermeasures, the Realm generates supplies, the Lotus Journal sustains healer wellness, and the Faction Embassy coordinates sector contributions.",
  hook:
    "The Bloom only recedes when Sanctuary-wide pressure crosses the Global Containment Threshold — a collective milestone tracked across all active healers' contributions.",
};

// ── Event State (static preview) ─────────────────────────────────────────────

export interface WorldEventPhase {
  id: string;
  label: string;
  description: string;
  threshold: number; // Containment tokens required to clear this phase
  badge: WorldEventBadge;
}

// ── Balance choice (single-player local model) ────────────────────────────────
// In this local build the player's own Epidemic Tokens stand in for the whole
// collective containment contribution, so the thresholds must be reachable by
// one healer in a handful of sessions — otherwise the meter reads as "live but
// stuck". We deliberately keep the original 1 : 5 : 10 phase ratio but scale the
// absolute numbers down so that, paired with the per-run accrual in
// computeEpidemicTokens (~25–45 tokens per Ward Shift run), a normal session of
// ~6–10 runs visibly climbs the Phase I bar (roughly a third to a half of it),
// Phase I clears in ~1–2 sessions, and Phase III (the Verdantha unlock) is a
// multi-session goal rather than an unreachable grind.
export const MIASMA_BLOOM_PHASES: WorldEventPhase[] = [
  {
    id: "phase_seedfall",
    label: "Phase I — Seedfall",
    description:
      "Initial spore dispersal detected. Ward shifts are encountering mutated Bloom-variants of known disease monsters. Containment protocols activated.",
    threshold: 500,
    badge: "Preview",
  },
  {
    id: "phase_bloom",
    label: "Phase II — Full Bloom",
    description:
      "Miasma density rising. Ward Defense perimeters are under elevated pressure. The University races to formulate a Research Countermeasure.",
    threshold: 2500,
    badge: "Planned",
  },
  {
    id: "phase_convergence",
    label: "Phase III — Convergence",
    description:
      "World Boss Verdantha materialises at the Sanctuary Core. All factions redirect resources to the final push.",
    threshold: 5000,
    badge: "Planned",
  },
];

// ── Per-run token accrual (live) ──────────────────────────────────────────────
// How many Epidemic Tokens a completed Ward Shift run against the Bloom awards.
// Centralised here (rather than inline in battle.tsx) so the accrual scale and
// the phase thresholds above stay balanced against each other in one place.
//
// Scale, for a mid-game run:
//   base 12  +  stars×6 (0–18)  +  difficulty×4  [ +12 first clear ]
//   → a 2★, difficulty-2 clear ≈ 32 tokens (44 on first clear).
// Boss / World-event encounters are a major containment push (×2.5). At this
// rate a normal 6–10 run session earns ~200–350 tokens, so the Phase I bar
// (threshold 500) visibly climbs every session instead of barely moving.
export function computeEpidemicTokens(opts: {
  stars: number; // 0..3 clinical performance for the run
  difficulty: number; // enemy.difficulty band (1..~6)
  isBoss?: boolean;
  isFirstClear?: boolean;
}): number {
  const stars = Math.max(0, Math.min(3, Math.round(opts.stars || 0)));
  const difficulty = Math.max(1, Math.round(opts.difficulty || 1));
  let tokens = 12; // base contribution for containing a Bloom shift run
  tokens += stars * 6; // better clinical care contains more of the Bloom
  tokens += difficulty * 4; // tougher wards seed denser Bloom
  if (opts.isFirstClear) tokens += 12; // first-clear discovery bonus
  if (opts.isBoss) tokens = Math.round(tokens * 2.5); // World-scale push
  return Math.max(1, tokens);
}

// ── Containment progress (live, derived from the player's Epidemic Tokens) ─────
// Single-player local model: the player's own Epidemic Tokens stand in for the
// collective containment contribution. Each phase's bar fills toward its
// absolute token threshold.
export function getPhaseProgress(tokens: number, phase: WorldEventPhase): number {
  if (phase.threshold <= 0) return 0;
  return Math.max(0, Math.min(1, tokens / phase.threshold));
}

export function formatContainmentLabel(tokens: number, phase: WorldEventPhase): string {
  const capped = Math.min(Math.max(0, tokens), phase.threshold);
  return `Containment ${capped.toLocaleString()} / ${phase.threshold.toLocaleString()}`;
}

// ── Sanctuary Corruption Meter ────────────────────────────────────────────────
// Lore: "Each cleared patient reduces the Sanctuary Corruption Meter by 1 point."
// In this single-player local build every Epidemic Token earned represents a
// cleared Bloom-patient, so the meter drains 1 point per token from its starting
// maximum. A lower meter means a safer Sanctuary. Kept in step with the Phase I
// threshold so that fully pushing back the local corruption meter lines up with
// clearing the first containment phase (see the balance note above).
export const SANCTUARY_CORRUPTION_MAX = 500;

export function getSanctuaryCorruption(tokens: number): number {
  return Math.max(0, SANCTUARY_CORRUPTION_MAX - Math.max(0, tokens));
}

export function getCorruptionCleared(tokens: number): number {
  return Math.min(Math.max(0, tokens), SANCTUARY_CORRUPTION_MAX);
}

export function getCorruptionClearedFraction(tokens: number): number {
  return getCorruptionCleared(tokens) / SANCTUARY_CORRUPTION_MAX;
}

// ── System Connections ────────────────────────────────────────────────────────

export interface SystemContribution {
  id: string;
  systemName: string;
  icon: string;
  accentColor: string;
  badge: WorldEventBadge;
  shortDesc: string;
  mechanicDesc: string;
  contribution: string;
  rewardHint: string;
  route?: string;
}

export const MIASMA_BLOOM_SYSTEMS: SystemContribution[] = [
  {
    id: "ward_shift",
    systemName: "Ward Shift",
    icon: "flame",
    accentColor: "#EF4444",
    badge: "Preview",
    shortDesc: "Every patient treated pushes back the Bloom.",
    mechanicDesc:
      "Completing Ward Shift runs against Bloom-variant enemies earns Epidemic Tokens. Each cleared patient reduces the Sanctuary Corruption Meter by 1 point. Bloom-variant enemies are harder but drop Rare Loot.",
    contribution:
      "Epidemic Tokens (~25–45 per shift run, scaled by clinical performance and difficulty), reduced Sanctuary Corruption, chance of Supply Crate drops from Bloom enemies.",
    rewardHint: "Bloom-tier enemies have a chance to drop World Boss Relic shards.",
    route: "/(tabs)",
  },
  {
    id: "ward_defense",
    systemName: "Ward Defense: Code Rush",
    icon: "shield-checkmark",
    accentColor: "#06B6D4",
    badge: "Preview",
    shortDesc: "Hold the supply perimeter against Bloom waves.",
    mechanicDesc:
      "Bloom waves in Ward Defense: Code Rush carry upgraded Miasma units. Every wave survived earns Supply Crates that feed the Realm's production bonus. A new Bloom-boss unit spawns at wave 10 during the event.",
    contribution:
      "Supply Crates per wave, Faction Marks for the embassy, Insight Crystals.",
    rewardHint: "Surviving the Bloom wave boss unlocks an event-exclusive unit skin (Coming Soon).",
    route: "/ward-defense",
  },
  {
    id: "university",
    systemName: "Clinica University",
    icon: "school",
    accentColor: "#A78BFA",
    badge: "Preview",
    shortDesc: "Research countermeasures that slow the Bloom's spread.",
    mechanicDesc:
      "Completing University Lessons and Simulations tagged [BLOOM-RESPONSE] earns Research Points that contribute to the Research Countermeasure bar. At each countermeasure tier, Sanctuary-wide Corruption decay rate improves for all players.",
    contribution:
      "Research Points → countermeasure tiers, bonus University Credits, Codex Shards.",
    rewardHint: "Completing the Research Countermeasure chain unlocks a Bloom Anatomy Codex entry.",
    route: "/university",
  },
  {
    id: "lotus_journal",
    systemName: "Lotus Plate Journal",
    icon: "flower",
    accentColor: "#34D399",
    badge: "Preview",
    shortDesc: "Healer wellness sustains the team through the outbreak.",
    mechanicDesc:
      "Logging meals, hydration, and wellness check-ins during the event earns Bloom-Resilience Points. Higher resilience reduces the penalty the Bloom applies to Stamina regeneration. This is entirely off-shift — no gameplay power advantage, purely optional.",
    contribution:
      "Bloom-Resilience Points, bonus Nourishment Petals, Insight Crystals.",
    rewardHint: "Reaching max Bloom-Resilience grants a wellness-themed profile badge (Coming Soon).",
    route: "/lotus-journal",
  },
  {
    id: "realm",
    systemName: "Realm — Sanctuary Buildings",
    icon: "business",
    accentColor: "#D4AF37",
    badge: "Preview",
    shortDesc: "Realm buildings generate event supplies passively.",
    mechanicDesc:
      "Placed and hero-assigned producer buildings (Clinica University, Research Library, Sanctuary Bank) generate event Supply Crates alongside their normal currencies. Supply Crates are capped per building per day — more heroes assigned means faster fill.",
    contribution:
      "Supply Crates (based on assignment), bonus production during the event window.",
    rewardHint: "Buildings at max hero-assignment generate double Supply Crates during Phase III.",
    route: "/(tabs)/kingdom",
  },
  {
    id: "faction_embassy",
    systemName: "Faction Embassy",
    icon: "flag",
    accentColor: "#F472B6",
    badge: "Planned",
    shortDesc: "Factions coordinate sector containment strategies.",
    mechanicDesc:
      "The Faction Embassy coordinates Sector Contribution Drive — each faction targets a different Bloom district. Depositing Faction Marks (earned across all systems) into your chosen faction's drive accelerates that sector's containment and unlocks faction-specific event rewards.",
    contribution:
      "Faction Marks → sector containment progress, Faction Reputation, cosmetic faction banner.",
    rewardHint: "The leading faction at Phase III earns a permanent cosmetic banner for all members (Planned).",
    route: "/(tabs)/faction",
  },
];

// ── Milestone Rewards ─────────────────────────────────────────────────────────

// A milestone's progress is tracked against one real PlayerState-derived signal.
//   runs     → total Ward Shift / battle runs completed (player.runs_completed)
//   waves    → Ward Defense: Code Rush Bloom waves survived (player.ward_defense_waves)
//   patients → total Bloom-variant patients treated (sum of enemy_mastery counts)
//   lessons  → University lessons completed (player.lessons_completed.length)
//   tokens   → Epidemic Tokens earned = collective containment (player.epidemic_tokens)
//   boss     → World Boss Verdantha defeated (player.bosses_defeated includes verdantha)
export type MilestoneMetric = "runs" | "waves" | "patients" | "lessons" | "tokens" | "boss";

// What claiming a milestone actually hands the player. Every field maps to a
// real PlayerState currency / inventory / codex sink, so a claimed milestone
// always delivers something concrete (mirrors the honest-grant exchange model).
export interface MilestoneGrant {
  epidemicTokens?: number;
  insightCrystals?: number;
  codexShards?: number;
  materials?: Record<string, number>;
  codex?: string[]; // Codex entry ids to unlock
  titles?: string[]; // Cosmetic profile Title ids to award (see EVENT_TITLES)
}

// ── Profile Titles (cosmetic) ─────────────────────────────────────────────────
// Earned, purely-cosmetic honorifics displayed under the player's name on the
// Profile screen. They carry NO stat effect. Each id below maps to a real
// PlayerState grant (player.owned_titles) so a title reward always delivers a
// concrete, displayable thing — mirroring the honest-grant model used for
// currencies/materials/codex entries.
export interface EventTitle {
  id: string;
  label: string;
  accentColor: string;
  description: string;
}

export const EVENT_TITLES: Record<string, EventTitle> = {
  bloom_researcher: {
    id: "bloom_researcher",
    label: "Bloom Researcher",
    accentColor: "#A78BFA",
    description:
      "Awarded for completing a Bloom-Response lesson at the University during the Miasma Bloom. A mark of scholarly countermeasure work.",
  },
  bloom_veteran: {
    id: "bloom_veteran",
    label: "Bloom Veteran",
    accentColor: "#34D399",
    description:
      "Awarded for pushing Sanctuary containment across the Phase I threshold. A seasoned hand at holding back the tide.",
  },
  verdantha_slayer: {
    id: "verdantha_slayer",
    label: "Verdantha Slayer",
    accentColor: "#EF4444",
    description:
      "Awarded to healers who contributed to the defeat of the World Boss Verdantha in Phase III. The rarest Bloom honorific.",
  },
};

// Resolve a title id to its catalog entry, defensively (unknown ids read as a
// minimal fallback so the UI never crashes on legacy / future title ids).
export function getEventTitle(id: string): EventTitle {
  return (
    EVENT_TITLES[id] ?? {
      id,
      label: id,
      accentColor: "#94A3B8",
      description: "",
    }
  );
}

export interface MilestoneReward {
  id: string;
  tier: number;
  label: string;
  requirement: string;
  rewards: { icon: string; label: string; accentColor: string }[];
  badge: WorldEventBadge;
  metric: MilestoneMetric;
  goal: number; // requirement target for the metric above
  grant: MilestoneGrant; // concrete rewards applied on claim
}

export const MIASMA_BLOOM_MILESTONES: MilestoneReward[] = [
  {
    id: "ms_1",
    tier: 1,
    label: "First Response",
    requirement: "Complete 1 Ward Shift against a Bloom-variant enemy.",
    rewards: [
      { icon: "flask", label: "50 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "cube", label: "1 Supply Crate", accentColor: "#D4AF37" },
    ],
    badge: "Preview",
    metric: "runs",
    goal: 1,
    grant: { epidemicTokens: 50, materials: { "Supply Crate": 1 } },
  },
  {
    id: "ms_2",
    tier: 2,
    label: "Ward Containment",
    requirement: "Treat 5 Bloom-variant patients in total.",
    rewards: [
      { icon: "flask", label: "200 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "sparkles", label: "Bloom Research Notes (Codex)", accentColor: "#A78BFA" },
    ],
    badge: "Preview",
    metric: "patients",
    goal: 5,
    grant: { epidemicTokens: 200, codex: ["bloom_research_notes"] },
  },
  {
    id: "ms_3",
    tier: 3,
    label: "Perimeter Held",
    requirement: "Survive 3 Bloom waves in Ward Defense: Code Rush.",
    rewards: [
      { icon: "flask", label: "500 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "diamond", label: "200 Insight Crystals", accentColor: "#22D3EE" },
      { icon: "cube", label: "3 Supply Crates", accentColor: "#D4AF37" },
    ],
    badge: "Preview",
    metric: "waves",
    goal: 3,
    grant: { epidemicTokens: 500, insightCrystals: 200, materials: { "Supply Crate": 3 } },
  },
  {
    id: "ms_4",
    tier: 4,
    label: "Research Breakthrough",
    requirement: "Complete any Bloom-Response lesson in the University.",
    rewards: [
      { icon: "flask", label: "1 000 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "library", label: "Bloom Anatomy entry (Codex)", accentColor: "#5B9BD5" },
      { icon: "ribbon", label: "Title: Bloom Researcher", accentColor: "#A78BFA" },
    ],
    badge: "Preview",
    metric: "lessons",
    goal: 1,
    grant: { epidemicTokens: 1000, codex: ["bloom_anatomy"], titles: ["bloom_researcher"] },
  },
  {
    id: "ms_5",
    tier: 5,
    label: "Phase I Cleared",
    requirement: "Reach Phase I Containment Threshold (collective milestone).",
    rewards: [
      { icon: "flask", label: "2 000 Epidemic Tokens", accentColor: "#34D399" },
      { icon: "cube", label: "World Boss Relic Shard ×3", accentColor: "#F97316" },
      { icon: "ribbon", label: "Title: Bloom Veteran", accentColor: "#34D399" },
    ],
    badge: "Preview",
    metric: "tokens",
    // Locked to the live Phase I threshold so this milestone triggers exactly
    // when the containment bar clears Phase I — never drifts out of sync with it.
    goal: MIASMA_BLOOM_PHASES[0].threshold,
    grant: { epidemicTokens: 2000, materials: { "World Boss Relic Shard": 3 }, titles: ["bloom_veteran"] },
  },
  {
    id: "ms_6",
    tier: 6,
    label: "Bloom Suppressed",
    requirement: "Reach Phase III — defeat the World Boss Verdantha.",
    rewards: [
      { icon: "star", label: "Rare Material: Verdanthite ×5", accentColor: "#34D399" },
      { icon: "cube", label: "World Boss Relic — Verdantha's Core", accentColor: "#F97316" },
      { icon: "ribbon", label: "Title: Verdantha Slayer", accentColor: "#EF4444" },
    ],
    badge: "Planned",
    metric: "boss",
    goal: 1,
    grant: { materials: { "Verdanthite": 5, "Verdantha's Core": 1 }, titles: ["verdantha_slayer"] },
  },
];

// ── Milestone progress (live, derived from real PlayerState signals) ──────────

export interface MilestoneProgress {
  current: number;
  goal: number;
  met: boolean;
  claimed: boolean;
  pct: number; // 0..1 clamped
}

// Resolve a milestone's current progress from the player's real counters. Kept
// pure/defensive so a partially-loaded player never throws — missing counters
// read as 0. `claimed` is sourced from the player's persisted claim list.
export function getMilestoneProgress(
  ms: MilestoneReward,
  player: {
    runs_completed?: number;
    ward_defense_waves?: number;
    enemy_mastery?: Record<string, number>;
    lessons_completed?: string[];
    epidemic_tokens?: number;
    bosses_defeated?: string[];
    claimed_milestones?: string[];
  } | null | undefined,
): MilestoneProgress {
  const claimed = !!player?.claimed_milestones?.includes(ms.id);
  let current = 0;
  switch (ms.metric) {
    case "runs":
      current = Math.max(0, player?.runs_completed ?? 0);
      break;
    case "waves":
      current = Math.max(0, player?.ward_defense_waves ?? 0);
      break;
    case "patients":
      current = Object.values(player?.enemy_mastery ?? {}).reduce((a, b) => a + (b || 0), 0);
      break;
    case "lessons":
      current = player?.lessons_completed?.length ?? 0;
      break;
    case "tokens":
      current = Math.max(0, player?.epidemic_tokens ?? 0);
      break;
    case "boss":
      current = player?.bosses_defeated?.includes("verdantha") ? 1 : 0;
      break;
  }
  const goal = Math.max(1, ms.goal);
  const met = current >= goal;
  return { current, goal, met, claimed, pct: Math.max(0, Math.min(1, current / goal)) };
}

// ── Reward Catalog Preview ────────────────────────────────────────────────────

export interface EventRewardItem {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  category: "currency" | "material" | "cosmetic" | "title" | "relic" | "codex";
  description: string;
  source: string;
  badge: WorldEventBadge;
}

export const MIASMA_BLOOM_REWARDS: EventRewardItem[] = [
  {
    id: "epidemic_tokens",
    name: "Epidemic Tokens",
    icon: "flask",
    accentColor: "#34D399",
    category: "currency",
    description:
      "The primary event currency. Earned from all systems during the Miasma Bloom. Spent at the Event Token Exchange for materials, cosmetics, and relics.",
    source: "Ward Shift, Ward Defense, University Lessons, Lotus Journal",
    badge: "Preview",
  },
  {
    id: "supply_crates",
    name: "Supply Crate",
    icon: "cube",
    accentColor: "#D4AF37",
    category: "material",
    description:
      "A crate of clinical supplies assembled during the outbreak. Opened for a random selection of useful materials: Ward Coins, Codex Shards, Insight Crystals, or rare materials.",
    source: "Realm buildings, Ward Defense waves, Bloom enemy drops",
    badge: "Preview",
  },
  {
    id: "insight_crystals_event",
    name: "Insight Crystals",
    icon: "diamond",
    accentColor: "#22D3EE",
    category: "currency",
    description:
      "Realm-generated premium currency, boosted during the event. Earned from Ward Defense waves and Lotus Journal wellness milestones.",
    source: "Ward Defense Bloom waves, Lotus Journal",
    badge: "Preview",
  },
  {
    id: "faction_marks",
    name: "Faction Marks",
    icon: "flag",
    accentColor: "#F472B6",
    category: "currency",
    description:
      "Deposited into the Faction Embassy's Sector Contribution Drive to accelerate your faction's containment of a Bloom district.",
    source: "All systems (bonus during Bloom event)",
    badge: "Planned",
  },
  {
    id: "world_boss_relic",
    name: "World Boss Relic — Verdantha's Core",
    icon: "cube",
    accentColor: "#F97316",
    category: "relic",
    description:
      "A crystallised remnant of Verdantha's core, pulsing with contained miasmic energy. A rare enhancement material for hero skills and Realm buildings.",
    source: "Phase III World Boss drop, Milestone Tier 5-6",
    badge: "Planned",
  },
  {
    id: "verdanthite",
    name: "Verdanthite",
    icon: "star",
    accentColor: "#34D399",
    category: "material",
    description:
      "A rare event-exclusive material harvested from neutralised Bloom sites. Used in advanced hero evolution and Realm building upgrades.",
    source: "Phase III completion, Supply Crate (rare)",
    badge: "Planned",
  },
  {
    id: "bloom_researcher_title",
    name: "Bloom Researcher Title",
    icon: "ribbon",
    accentColor: "#A78BFA",
    category: "title",
    description:
      "Displayed on your Profile screen below your healer name. Earned by completing the Research Breakthrough milestone. Purely cosmetic — no stat effect.",
    source: "Milestone Tier 4",
    badge: "Preview",
  },
  {
    id: "verdantha_slayer_title",
    name: "Verdantha Slayer Title",
    icon: "ribbon",
    accentColor: "#EF4444",
    category: "title",
    description:
      "Awarded to healers who contributed to the defeat of the World Boss in Phase III. Displayed on Profile. Cosmetic only.",
    source: "Milestone Tier 6 / Phase III completion",
    badge: "Planned",
  },
  {
    id: "bloom_ward_skin",
    name: "Bloom Ward Skin",
    icon: "color-palette",
    accentColor: "#F472B6",
    category: "cosmetic",
    description:
      "A limited cosmetic skin for the Ward Shift arena, replacing the standard backdrop with a bioluminescent Bloom-variant scene. No gameplay effect.",
    source: "Milestone Tier 6 / Phase III completion",
    badge: "Coming Soon",
  },
  {
    id: "bloom_anatomy_codex",
    name: "Bloom Anatomy — Codex Entry",
    icon: "library",
    accentColor: "#5B9BD5",
    category: "codex",
    description:
      "A detailed clinical-lore entry in the Great Codex covering the Verdant Miasma's spore biology, infection pathway, and recommended countermeasures.",
    source: "Milestone Tier 4 / Research Breakthrough",
    badge: "Preview",
  },
];

// ── World Boss ────────────────────────────────────────────────────────────────

export interface WorldBossPreview {
  id: string;
  name: string;
  title: string;
  lore: string;
  primarySystem: string;
  secondarySystem: string;
  difficulty: string;
  badge: WorldEventBadge;
  signatureAttack: string;
  weaknesses: string;
  clinicalAnalog: string;
  unlockCondition: string;
  dropRewards: string[];
  artBrief: string;
}

// Unlock gate for the playable Verdantha encounter. The Bloom Matriarch only
// manifests at Phase III — Convergence. Rather than a hardcoded bool, this is
// driven by real world-event phase progress: in this single-player local model
// the player's own Epidemic Tokens stand in for the collective containment
// contribution, so Verdantha becomes reachable once the Sanctuary crosses into
// Phase III (i.e. the player has cleared the Phase II containment threshold).
export const PHASE_III_ID = "phase_convergence";

// The token total at which the Sanctuary enters Phase III — Convergence. This is
// the threshold of the phase immediately BEFORE Phase III (Phase II — Full
// Bloom), because clearing that phase is what tips the event into Convergence
// and materialises Verdantha at the Sanctuary Core.
export function getPhaseIIIEntryThreshold(): number {
  const idx = MIASMA_BLOOM_PHASES.findIndex((p) => p.id === PHASE_III_ID);
  if (idx <= 0) {
    // Defensive fallback: if the phase list changes shape, gate on the last
    // phase's own threshold so the boss never unlocks accidentally early.
    return MIASMA_BLOOM_PHASES[MIASMA_BLOOM_PHASES.length - 1]?.threshold ?? Number.MAX_SAFE_INTEGER;
  }
  return MIASMA_BLOOM_PHASES[idx - 1].threshold;
}

// True once the player's containment contribution has tipped the event into
// Phase III — Convergence, making the Verdantha world-boss fight reachable.
export function isVerdanthaUnlocked(tokens: number): boolean {
  return Math.max(0, tokens) >= getPhaseIIIEntryThreshold();
}

// Epidemic Tokens still needed before Verdantha manifests (0 once unlocked).
export function getVerdanthaTokensRemaining(tokens: number): number {
  return Math.max(0, getPhaseIIIEntryThreshold() - Math.max(0, tokens));
}

export const VERDANTHA: WorldBossPreview = {
  id: "verdantha",
  name: "Verdantha",
  title: "The Bloom Matriarch",
  lore:
    "Verdantha is the source-entity of the Verdant Miasma — a colossal, semi-sentient fungal intelligence that has been dormant in the Outer Wilds for centuries. Awakened by a surge of corrupted Clinical Cue energy, she drifts toward the Sanctuary's Vital Lantern, drawn to its life-force resonance. She does not attack with malice; she simply grows, and her growth is catastrophic.",
  primarySystem: "Growth",
  secondarySystem: "Filter",
  difficulty: "World-Scale (Phase III Only)",
  badge: "Planned",
  signatureAttack:
    "Bloom Cascade — releases a wave of spore-bombs targeting all active wards simultaneously, applying Corruption stacks to every placed hero and building. Blocked by coordinated shield actions across multiple systems.",
  weaknesses:
    "Fire (burns spore clouds), River (flushes toxins), and Research Countermeasure tier buffs from the University reduce her effective HP.",
  clinicalAnalog:
    "Invasive fungal infection (analogous to disseminated aspergillosis or mucormycosis) — requires systemic multi-agent treatment, not a single counter. Models real-world pandemic coordination challenges.",
  unlockCondition:
    "Spawns automatically at Phase III when the global Containment Threshold is crossed. Available to all participating healers for a limited window.",
  dropRewards: [
    "Verdantha's Core (World Boss Relic)",
    "Verdanthite ×3–5",
    "Verdantha Slayer Title",
    "Bloom Ward Skin (first kill)",
    "Epidemic Tokens ×5 000",
  ],
  artBrief:
    "A massive, beautiful-yet-terrifying fungal entity — her form is a cascading canopy of bioluminescent blue-green bloom-caps, trailing luminous spore-silk. Her face is serene, almost human, but her body is pure infection. She floats at the centre of the Sanctuary courtyard as petals of miasma drift around her. Donghua art style: cel-shaded, luminous, every surface glowing with soft internal light.",
};

// ── Token Exchange Preview ────────────────────────────────────────────────────

// A grant describes exactly what a redeemed exchange item hands the player.
// Items with a grant are live and purchasable; items without one stay locked so
// the exchange never promises a reward it can't actually deliver.
export type ExchangeGrant =
  | { kind: "currency"; field: "codex_shards" | "insight_crystals"; amount: number }
  | { kind: "material"; itemName: string; qty: number }
  // Cosmetic grant: adds a ward/hero skin id to player.owned_skins (mirrors
  // purchaseSkin). Never touches stats — purely visual, so it stays event-safe.
  | { kind: "cosmetic"; skinId: string };

export interface TokenExchangeItem {
  id: string;
  name: string;
  icon: string;
  accentColor: string;
  cost: number;
  badge: WorldEventBadge;
  category: "material" | "cosmetic" | "relic" | "currency";
  grant?: ExchangeGrant;
}

export const TOKEN_EXCHANGE: TokenExchangeItem[] = [
  { id: "ex_crate",       name: "Supply Crate",           icon: "cube",           accentColor: "#D4AF37", cost: 100,   badge: "Preview",      category: "material",  grant: { kind: "material", itemName: "Supply Crate",           qty: 1   } },
  { id: "ex_codex_shard", name: "Codex Shards ×50",       icon: "diamond",        accentColor: "#22D3EE", cost: 200,   badge: "Preview",      category: "currency",  grant: { kind: "currency", field: "codex_shards",             amount: 50  } },
  { id: "ex_crystals",    name: "Insight Crystals ×100",  icon: "diamond",        accentColor: "#22D3EE", cost: 300,   badge: "Preview",      category: "currency",  grant: { kind: "currency", field: "insight_crystals",         amount: 100 } },
  { id: "ex_verdanthite", name: "Verdanthite ×1",         icon: "star",           accentColor: "#34D399", cost: 1000,  badge: "Preview",      category: "material",  grant: { kind: "material", itemName: "Verdanthite",           qty: 1   } },
  { id: "ex_relic_shard", name: "World Boss Relic Shard", icon: "cube",           accentColor: "#F97316", cost: 2000,  badge: "Preview",      category: "relic",     grant: { kind: "material", itemName: "World Boss Relic Shard", qty: 1   } },
  { id: "ex_skin",        name: "Bloom Ward Skin",         icon: "color-palette",  accentColor: "#F472B6", cost: 5000,  badge: "Preview",      category: "cosmetic",  grant: { kind: "cosmetic", skinId: "skin_bloom_ward" } },
];

// ── Active Event (static preview) ─────────────────────────────────────────────
// A single flag + summary so hub screens can surface the currently-running world
// event without importing the whole data set. Still preview-only — nothing here
// wires live timers, progress, or rewards.

export interface ActiveWorldEvent {
  id: string;
  title: string;
  subtitle: string;
  accentColor: string;
  route: string;
  badge: WorldEventBadge;
}

export const WORLD_EVENT_ACTIVE = true;

export const ACTIVE_WORLD_EVENT: ActiveWorldEvent = {
  id: "miasma_bloom",
  title: MIASMA_BLOOM_LORE.title,
  subtitle: MIASMA_BLOOM_LORE.subtitle,
  accentColor: "#34D399",
  route: "/world-event",
  badge: "Preview",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export const WORLD_EVENT_BADGE_COLOR: Record<WorldEventBadge, string> = {
  Preview:      "#5B9BD5",
  Planned:      "#A78BFA",
  "Coming Soon": "#F59E0B",
};

export const REWARD_CATEGORY_LABEL: Record<EventRewardItem["category"], string> = {
  currency: "Currency",
  material: "Material",
  cosmetic: "Cosmetic",
  title:    "Profile Title",
  relic:    "Boss Relic",
  codex:    "Codex Entry",
};

// ── B6 — Community Health Board: Public Health Education Cards ────────────
// Shown read-only to all players (even below Level 5) in the world-event
// locked view. Plain-language, non-medical-advice cards framed in Clinica
// fantasy terms. Art direction: donghua/anime, luminous teal-green palette.

export interface PublicHealthCard {
  id: string;
  title: string;
  icon: string; // Ionicons name
  accentColor: string;
  body: string;
  fantasyFrame: string; // How this maps to Clinica's game world
}

export const PUBLIC_HEALTH_EDUCATION_CARDS: PublicHealthCard[] = [
  {
    id: "what-is-outbreak",
    title: "What Is an Outbreak?",
    icon: "alert-circle-outline",
    accentColor: "#F59E0B",
    body:
      "An outbreak happens when more people than expected get the same illness in the same place at the same time. Disease spreads when a pathogen finds new hosts faster than the body — or community — can respond.",
    fantasyFrame:
      "In the Sanctuary, an outbreak looks like Bloom-variant disease-monsters multiplying faster than healers can contain them — crossing ward lines and weakening the Vital Lantern.",
  },
  {
    id: "why-prevention-matters",
    title: "Why Prevention Matters",
    icon: "shield-checkmark-outline",
    accentColor: "#34D399",
    body:
      "Preventing one case can stop dozens more. Vaccination, hand hygiene, clean water, and early recognition all break the chain of transmission before it grows. Prevention is always cheaper — in lives and resources — than outbreak response.",
    fantasyFrame:
      "Each ward shift you complete strengthens the Sanctuary's Containment threshold. Every disease-monster you treat represents a real chain of transmission broken before it spreads.",
  },
  {
    id: "how-communities-reduce-spread",
    title: "How Communities Reduce Spread",
    icon: "people-outline",
    accentColor: "#6EE7B7",
    body:
      "Disease spreads through networks of people. When a community works together — sharing information, reducing crowding, supporting sick members to stay home — the pathogen has fewer pathways to travel. Collective action flattens the spread curve.",
    fantasyFrame:
      "The Miasma Bloom recedes only when the entire Sanctuary coordinates — ward shifts slow spread, the University develops countermeasures, Realm buildings generate supplies. No single healer stops an epidemic alone.",
  },
  {
    id: "public-health-roles",
    title: "What Public Health Teams Do",
    icon: "medkit-outline",
    accentColor: "#A78BFA",
    body:
      "Public health nurses and teams investigate cases, trace contacts, educate communities, and connect people to care. They look beyond individual patients to understand why illness is spreading and who is most at risk — then act before it worsens.",
    fantasyFrame:
      "The Clinica healer team tracks outbreak patterns using Clinical Cues and ward logs — identifying Disease Priority, recognizing Vital Signs, and deploying the right care before corruption spreads to the next ward.",
  },
  {
    id: "surveillance-recognition",
    title: "Surveillance & Early Recognition",
    icon: "eye-outline",
    accentColor: "#5B9BD5",
    body:
      "Surveillance means watching for unusual patterns — more fever cases than normal, a cluster of similar symptoms, or new pathogen reports from a community. Early recognition by frontline workers is often what stops an outbreak from becoming a crisis.",
    fantasyFrame:
      "In Clinica, surveillance looks like reading the Containment Meter, recognizing Bloom-pattern enemies before they multiply, and acting on Clinical Cue warnings before corruption reaches a critical ward site.",
  },
];
