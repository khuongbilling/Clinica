/**
 * Player Hero foundation.
 *
 * This is deliberately not part of Hero, hero_progression, Recruitment, or
 * Class Tree. A Player Hero is a single, separately-owned character whose
 * valuable state is issued by the server after the complete awakening gate.
 * Higher-tier definitions are contracts only until their balance gates ship.
 */
import type { ClassId } from "./classTree";
import type { ElementSystem } from "./types";

export type PlayerHeroState = "hidden" | "foreshadowed" | "locked" | "unlocked" | "created";
export type PlayerHeroPotential = "standard" | "prodigy" | "convergence";
export type PlayerHeroStat = "insight" | "carePower" | "intervention" | "guard" | "coordination";
export type PlayerHeroTraitKind = "core" | "acquired";
export type PlayerHeroTalentKind = "natural" | "acquired";
export type PlayerHeroArtifactNamespace =
  | "creation"
  | "doctrine"
  | "resonance"
  | "echo"
  | "aegis"
  | "covenant"
  | "genesis";
export type PlayerHeroStageId =
  | "baseline"
  | "doctrine"
  | "resonance"
  | "echo"
  | "aegis"
  | "covenant"
  | "ascendant"
  | "exalted"
  | "genesis"
  | "sovereign"
  | "convergence";

export const PLAYER_HERO_STAT_KEYS: readonly PlayerHeroStat[] = [
  "insight", "carePower", "intervention", "guard", "coordination",
] as const;
export const PLAYER_HERO_STAT_TOTAL = 25;
export const PLAYER_HERO_STAT_MAX = 10;

export type PlayerHeroAppearance = {
  skinTone: number;
  hairStyle: number;
  hairColor: number;
  faceStyle: number;
  accentColor: number;
};

export type RootCallingSnapshot = {
  classId: ClassId | string;
  specializationId: string;
  capturedAt: string;
};

export type PlayerHeroIdentity = {
  displayName: string;
  pronouns: string;
  appearance: PlayerHeroAppearance;
  focus: string;
  rootCalling: RootCallingSnapshot;
};

export type PlayerHeroSkillDNA = {
  element: ElementSystem;
  actionType: "scout" | "strike" | "stabilize" | "shield" | "command" | "analyze" | "support" | "counter";
  signatureId: string;
  signatureTier: "standard";
  equilibriumCost: number;
};

export type PlayerHeroEquilibrium = {
  activeStrongEffects: number;
  counterTags: string[];
  amplificationCap: number;
  mitigationCap: number;
  freeActionCap: number;
};

export type PlayerHeroPotentialProfile = {
  tier: PlayerHeroPotential;
  rolledAt: string;
  receiptId: string;
  ratesBp: { standard: 9400; prodigy: 500; convergence: 100 };
};

export type PlayerHeroProficiencyEvidence = {
  id: string;
  practiceType: "validated_meaningful_practice";
  source: "university_practice" | "qualifying_journey";
  verifiedAt: string;
  proficiencyAward: number;
};

export type PlayerHeroProgression = {
  coreTraitId: string;
  acquiredTraitId: string | null;
  naturalTalentId: string;
  acquiredTalentId: string | null;
  activeFeatIds: string[];
  creedId: string;
  signatureLineageId: string;
  covenantId: string | null;
  primaryAegisId: string | null;
  proficiency: number;
  proficiencyEvidence: PlayerHeroProficiencyEvidence[];
};

export type PlayerHeroRecord = {
  id: string;
  state: "created";
  identity: PlayerHeroIdentity;
  skillDNA: PlayerHeroSkillDNA;
  stats: Record<PlayerHeroStat, number>;
  potential: PlayerHeroPotentialProfile;
  progression: PlayerHeroProgression;
  equilibrium: PlayerHeroEquilibrium;
  createdAt: string;
};

export type PlayerHeroRequirement = {
  id: string;
  label: string;
  met: boolean;
  detail: string;
};

export type PlayerHeroEligibility = {
  state: PlayerHeroState;
  canCreate: boolean;
  requirements: PlayerHeroRequirement[];
};

export type PlayerHeroArtifact = {
  id: string;
  namespace: PlayerHeroArtifactNamespace;
  family: "creation" | "doctrine" | "resonance" | "echo" | "aegis" | "covenant" | "genesis";
  rarity: "standard" | "apex" | "sovereign";
  cosmeticOnly: boolean;
  requiredStage: PlayerHeroStageId;
};

export type PlayerHeroOpportunity = {
  id: string;
  source: "journey" | "npc";
  requiredStage?: PlayerHeroStageId;
  runId?: string;
  awarded?: boolean;
  kind: "focus_blueprint" | "principle" | "trial" | "candidate_pool" | "manifestation_component" | null;
  persistedResolution: "server_roll_once";
};

export type PlayerHeroNpcOffering = {
  id: string;
  npc: "artificer" | "instructor" | "researcher_apothecary";
  namespace: PlayerHeroArtifactNamespace | "principle" | "trial";
  requiredStage: PlayerHeroStageId;
  status: "future_gated" | "available";
  paidPower: false;
};

export const PLAYER_HERO_STAGE_GATES: Readonly<Record<PlayerHeroStageId, { minLevel: number; playable: boolean }>> = {
  baseline: { minLevel: 30, playable: true },
  doctrine: { minLevel: 35, playable: true },
  resonance: { minLevel: 40, playable: false },
  echo: { minLevel: 40, playable: false },
  aegis: { minLevel: 45, playable: false },
  covenant: { minLevel: 45, playable: false },
  ascendant: { minLevel: 50, playable: false },
  exalted: { minLevel: 50, playable: false },
  genesis: { minLevel: 50, playable: false },
  sovereign: { minLevel: 50, playable: false },
  convergence: { minLevel: 50, playable: false },
};

export const PLAYER_HERO_ARTIFACT_CATALOG: readonly PlayerHeroArtifact[] = [
  { id: "creation_focus_blueprint", namespace: "creation", family: "creation", rarity: "standard", cosmeticOnly: true, requiredStage: "baseline" },
  { id: "doctrine_principle", namespace: "doctrine", family: "doctrine", rarity: "standard", cosmeticOnly: false, requiredStage: "doctrine" },
  { id: "resonance_fragment", namespace: "resonance", family: "resonance", rarity: "standard", cosmeticOnly: false, requiredStage: "resonance" },
  { id: "echo_fragment", namespace: "echo", family: "echo", rarity: "standard", cosmeticOnly: false, requiredStage: "echo" },
  { id: "player_hero_aegis", namespace: "aegis", family: "aegis", rarity: "apex", cosmeticOnly: false, requiredStage: "aegis" },
  { id: "player_hero_covenant", namespace: "covenant", family: "covenant", rarity: "apex", cosmeticOnly: false, requiredStage: "covenant" },
  { id: "genesis_component", namespace: "genesis", family: "genesis", rarity: "sovereign", cosmeticOnly: false, requiredStage: "genesis" },
];

export const PLAYER_HERO_NPC_OFFERINGS: readonly PlayerHeroNpcOffering[] = [
  { id: "artificer_creation_focus", npc: "artificer", namespace: "creation", requiredStage: "baseline", status: "future_gated", paidPower: false },
  { id: "instructor_doctrine_principle", npc: "instructor", namespace: "doctrine", requiredStage: "doctrine", status: "future_gated", paidPower: false },
  { id: "researcher_manifestation_trial", npc: "researcher_apothecary", namespace: "genesis", requiredStage: "genesis", status: "future_gated", paidPower: false },
];

export const PLAYER_HERO_LIMITS = {
  traits: { core: 1, acquired: 1 },
  talents: { natural: 1, acquired: 1 },
  activeFeats: 3,
  creeds: 1,
  signatureLineages: 1,
  covenants: 1,
  primaryAegis: 1,
} as const;

/** Family-specific conversion rules; fragments never substitute across families. */
export const PLAYER_HERO_ARTIFACT_RECIPES: Readonly<Record<Exclude<PlayerHeroArtifactNamespace, "creation">, {
  fragmentId: string;
  artifactId: string;
  fragmentsRequired: number;
}>> = {
  doctrine: { fragmentId: "player_hero_doctrine_fragment", artifactId: "doctrine_principle", fragmentsRequired: 5 },
  resonance: { fragmentId: "player_hero_resonance_fragment", artifactId: "resonance_fragment", fragmentsRequired: 5 },
  echo: { fragmentId: "player_hero_echo_fragment", artifactId: "echo_fragment", fragmentsRequired: 5 },
  aegis: { fragmentId: "player_hero_aegis_fragment", artifactId: "player_hero_aegis", fragmentsRequired: 8 },
  covenant: { fragmentId: "player_hero_covenant_fragment", artifactId: "player_hero_covenant", fragmentsRequired: 8 },
  genesis: { fragmentId: "player_hero_genesis_fragment", artifactId: "genesis_component", fragmentsRequired: 12 },
};

export function potentialFromBasisPoints(roll: number): PlayerHeroPotential {
  const basisPoints = Math.max(0, Math.min(9999, Math.floor(roll)));
  if (basisPoints < 100) return "convergence";
  if (basisPoints < 600) return "prodigy";
  return "standard";
}

export function validatePlayerHeroStats(stats: Record<string, number>): string[] {
  const errors: string[] = [];
  const total = PLAYER_HERO_STAT_KEYS.reduce((sum, key) => {
    const value = Number(stats[key]);
    if (!Number.isInteger(value) || value < 0 || value > PLAYER_HERO_STAT_MAX) {
      errors.push(`${key} must be an integer from 0 to ${PLAYER_HERO_STAT_MAX}`);
    }
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  if (total !== PLAYER_HERO_STAT_TOTAL) errors.push(`combat stat allocations must total ${PLAYER_HERO_STAT_TOTAL}`);
  return errors;
}

export function validateLawOfEquilibrium(equilibrium: PlayerHeroEquilibrium): string[] {
  const errors: string[] = [];
  if (equilibrium.activeStrongEffects > 1) errors.push("only one strong active effect may be equipped");
  if (equilibrium.amplificationCap > 0.25) errors.push("amplification cap exceeds the Player Hero budget");
  if (equilibrium.mitigationCap > 0.25) errors.push("mitigation cap exceeds the Player Hero budget");
  if (equilibrium.freeActionCap > 0) errors.push("Player Hero effects cannot create free actions");
  return errors;
}

export function playerHeroStateLabel(state: PlayerHeroState): string {
  return {
    hidden: "Hidden",
    foreshadowed: "Foreshadowed",
    locked: "Locked",
    unlocked: "Unlocked",
    created: "Created",
  }[state];
}