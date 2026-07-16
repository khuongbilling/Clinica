/**
 * journeyRewards.ts — J2: Journey Map first-clear reward definitions (Chapters 1–5)
 *
 * Each journey node has two reward tiers:
 *   FIRST-CLEAR (one-time): Full listed rewards, tracked in
 *     player.claimed_journey_nodes. Hero XP split equally among active team.
 *   REPLAY (repeatable): JOURNEY_REPLAY_FACTOR × (coins + playerXp) only;
 *     no shards, no credits, no Refined Lotus Gems.
 *
 * For BATTLE / MINI_BOSS / WARD_DEFENSE nodes, playerXp and coins scale with
 * star rating (1★ = 33%, 2★ = 67%, 3★ = 100%).
 * For STORY / REFLECTION / REALM nodes, rewards are flat (isStory = true →
 * no replay reward, no star scaling, non-farmable).
 *
 * Anti-duplication rules:
 *   • Refined Lotus Gems: chapter chest + 3-star mastery only; never node clears.
 *   • Story nodes: first-clear only — isStory=true means getReplayReward returns null.
 *   • Sweep: handled separately by performSweep in store.tsx (unchanged).
 *
 * Reward values match the J2 spec exactly. The existing in-battle
 * computePlayerXpReward still fires as immediate feedback; journey node claims
 * are ADDITIVE first-clear bonuses tracked separately on the map.
 * Values are centralised here and easy to tune — edit this file to adjust pacing.
 */

// ── Core types ────────────────────────────────────────────────────────────────

export interface JourneyNodeDef {
  nodeId: string;        // matches ChapterPart.id (e.g. "c1p1")
  chapter: number;       // 1–5
  /** Player XP at 3★ for battle nodes; flat for story/realm/reflection. */
  playerXp: number;
  /** Hero XP at 3★ for battle nodes; 0 for most story nodes. */
  heroXp: number;
  /** Ward Coins at 3★ for battle nodes; flat otherwise. */
  coins: number;
  /** University Credits (some story/reflection/WD nodes). */
  credits?: number;
  /** Summoning Shards (battle/mini-boss/WD; never from story nodes). */
  shards?: number;
  /** True → flat reward, non-farmable, no replay. */
  isStory: boolean;
  /** True → playerXp + coins multiplied by star fraction (0.33/0.67/1.0). */
  starsScale: boolean;
}

export interface ComputedJourneyReward {
  playerXp: number;
  heroXp: number;
  coins: number;
  credits: number;
  shards: number;
}

// ── Replay factor ─────────────────────────────────────────────────────────────

/**
 * Fraction of (coins + playerXp) granted on subsequent clears.
 * Story/reflection nodes have no replay reward at all (isStory=true).
 */
export const JOURNEY_REPLAY_FACTOR = 0.32;

// ── Scene → node mapping ──────────────────────────────────────────────────────
// Maps story scene ids (storyScenes.ts) to their journey node id.
// Only scenes with a live non-placeholder ChapterPart entry need a mapping.

const SCENE_TO_NODE: Record<string, string> = {
  'chapter_01': 'c1n1', // P1: updated to new 6-node Chapter 1 format
};

/** Returns the journey node id linked to a story scene, or null. */
export function getNodeIdForScene(sceneId: string): string | null {
  return SCENE_TO_NODE[sceneId] ?? null;
}

// ── Node definitions (Chapters 1–5) — exact J2 spec values ──────────────────
// "up to X player XP by stars" → 3★ = X, 2★ = 67%, 1★ = 33%.

const JOURNEY_NODE_DEFS: JourneyNodeDef[] = [

  // ── Chapter 1: The Fading Apprenticeship (Level 1, 6 nodes — P1 format) ──
  // c1n1: memory_fragment (flat)  c1n2: challenge-triage (flat)
  // c1n3: challenge-stack (flat)  c1n4: battle (stars)
  // c1n5: reflection (flat)       c1n6: mini_boss (stars)
  // Approx totals at 3★: 180 XP, 60 hero XP, 195 coins, 30 credits, 25 shards.
  { nodeId: 'c1n1', chapter: 1, playerXp:  20, heroXp:  0,  coins:  25,                   isStory: true,  starsScale: false },
  { nodeId: 'c1n2', chapter: 1, playerXp:  20, heroXp:  0,  coins:  15, credits: 10,      isStory: true,  starsScale: false },
  { nodeId: 'c1n3', chapter: 1, playerXp:  20, heroXp:  0,  coins:  15, credits: 10,      isStory: true,  starsScale: false },
  { nodeId: 'c1n4', chapter: 1, playerXp:  45, heroXp:  25, coins:  65,                   isStory: false, starsScale: true  },
  { nodeId: 'c1n5', chapter: 1, playerXp:  20, heroXp:  0,  coins:   0, credits: 10,      isStory: true,  starsScale: false },
  { nodeId: 'c1n6', chapter: 1, playerXp:  55, heroXp:  35, coins:  75, shards: 25,       isStory: false, starsScale: true  },

  // ── Chapter 2: The First Ward Rotation (Level 2, 8 nodes — P8 format) ───
  // c2p1: memory_fragment (flat)  c2p2: challenge-cue-hunt (flat)
  // c2p3: challenge-rapid-triage (flat)  c2p4: challenge-stack (flat)
  // c2p5: battle (stars)          c2p6: memory_fragment (flat)
  // c2p7: mini_boss (stars)       c2p8: reflection (flat)
  // Approx totals at 3★: 265 XP, 80 hero XP, 200 coins, 95 credits, 65 shards.
  { nodeId: 'c2p1', chapter: 2, playerXp:  25, heroXp:  0, coins:  0, credits: 10,       isStory: true,  starsScale: false },
  { nodeId: 'c2p2', chapter: 2, playerXp:  15, heroXp:  0, coins:  0, credits: 15,       isStory: true,  starsScale: false },
  { nodeId: 'c2p3', chapter: 2, playerXp:  15, heroXp:  0, coins:  0, credits: 15,       isStory: true,  starsScale: false },
  { nodeId: 'c2p4', chapter: 2, playerXp:  15, heroXp:  0, coins:  0, credits: 15,       isStory: true,  starsScale: false },
  { nodeId: 'c2p5', chapter: 2, playerXp:  55, heroXp: 30, coins: 75,                    isStory: false, starsScale: true  },
  { nodeId: 'c2p6', chapter: 2, playerXp:  25, heroXp:  0, coins:  0, shards: 25,        isStory: true,  starsScale: false },
  { nodeId: 'c2p7', chapter: 2, playerXp:  85, heroXp: 50, coins: 125, shards: 40,       isStory: false, starsScale: true  },
  { nodeId: 'c2p8', chapter: 2, playerXp:  30, heroXp:  0, coins:  0, credits: 20,       isStory: true,  starsScale: false },

  // ── Chapter 3: Breath Before Battle (Level 3, 9 nodes) ───────────────────
  // P9: memory → chal → chal → battle → memory → chal → battle → mini_boss → reflection
  // Approximate totals at 3★: ~600 player XP, 270 hero XP, 770 Ward Coins,
  //   230 University Credits, 200 Summoning Shards.
  { nodeId: 'c3p1', chapter: 3, playerXp:  30, heroXp:   0, coins:   0, credits: 25,      isStory: true,  starsScale: false },
  { nodeId: 'c3p2', chapter: 3, playerXp:  55, heroXp:   0, coins:   0, credits: 30,      isStory: false, starsScale: false },
  { nodeId: 'c3p3', chapter: 3, playerXp:  60, heroXp:   0, coins:   0, credits: 30,      isStory: false, starsScale: false },
  { nodeId: 'c3p4', chapter: 3, playerXp:  85, heroXp:  50, coins: 125,                   isStory: false, starsScale: true  },
  { nodeId: 'c3p5', chapter: 3, playerXp:  30, heroXp:   0, coins:   0, credits: 25,      isStory: true,  starsScale: false },
  { nodeId: 'c3p6', chapter: 3, playerXp:  65, heroXp:   0, coins:   0, credits: 35,      isStory: false, starsScale: false },
  { nodeId: 'c3p7', chapter: 3, playerXp:  95, heroXp:  55, coins: 145,                   isStory: false, starsScale: true  },
  { nodeId: 'c3p8', chapter: 3, playerXp: 125, heroXp:  75, coins: 180, shards: 55,       isStory: false, starsScale: true  },
  // Reflection: flat XP + credits. Lesson Note preview deferred to J3/J4.
  { nodeId: 'c3p9', chapter: 3, playerXp:  35, heroXp:   0, coins:   0, credits: 30,      isStory: true,  starsScale: false },

  // ── Chapter 4: Code Rush (Level 4, 6 nodes) ───────────────────────────────
  // Approximate totals at 3★: 655 player XP, 365 hero XP, 1035 Ward Coins,
  //   160 University Credits, 285 Summoning Shards, 15 RLG.
  { nodeId: 'c4p1', chapter: 4, playerXp:  35, heroXp:   0, coins:   0, credits: 30,      isStory: true,  starsScale: false },
  { nodeId: 'c4p2', chapter: 4, playerXp: 100, heroXp:  60, coins: 160,                   isStory: false, starsScale: true  },
  { nodeId: 'c4p3', chapter: 4, playerXp: 110, heroXp:  65, coins: 175, shards: 25,       isStory: false, starsScale: true  },
  { nodeId: 'c4p4', chapter: 4, playerXp:  35, heroXp:   0, coins:   0, credits: 30,      isStory: true,  starsScale: false },
  { nodeId: 'c4p5', chapter: 4, playerXp: 125, heroXp:  75, coins: 200, shards: 35,       isStory: false, starsScale: true  },
  { nodeId: 'c4p6', chapter: 4, playerXp: 150, heroXp:  90, coins: 250, shards: 75,       isStory: false, starsScale: true  },

  // ── Chapter 5: Building the Sanctuary (Level 5, 8 nodes) ─────────────────
  // Approximate totals at 3★: 1035 player XP, 590 hero XP, 1850 Ward Coins,
  //   195 University Credits, 365 Summoning Shards, 20 RLG.
  { nodeId: 'c5p1', chapter: 5, playerXp:  40, heroXp:   0, coins:   0, credits: 35,      isStory: true,  starsScale: false },
  // Realm task: one-time, flat (no stars), has heroXp unlike other story nodes.
  { nodeId: 'c5p2', chapter: 5, playerXp:  60, heroXp:  20, coins: 150,                   isStory: true,  starsScale: false },
  { nodeId: 'c5p3', chapter: 5, playerXp: 130, heroXp:  80, coins: 225,                   isStory: false, starsScale: true  },
  { nodeId: 'c5p4', chapter: 5, playerXp:  40, heroXp:   0, coins:   0, credits: 35,      isStory: true,  starsScale: false },
  { nodeId: 'c5p5', chapter: 5, playerXp: 140, heroXp:  85, coins: 250, shards: 25,       isStory: false, starsScale: true  },
  { nodeId: 'c5p6', chapter: 5, playerXp: 150, heroXp:  90, coins: 275, shards: 40,       isStory: false, starsScale: true  },
  { nodeId: 'c5p7', chapter: 5, playerXp: 160, heroXp:  95, coins: 300, shards: 50,       isStory: false, starsScale: true  },
  { nodeId: 'c5p8', chapter: 5, playerXp: 190, heroXp: 120, coins: 350, shards: 100,      isStory: false, starsScale: true  },
];

const NODE_DEF_MAP: Record<string, JourneyNodeDef> = Object.fromEntries(
  JOURNEY_NODE_DEFS.map((d) => [d.nodeId, d]),
);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the node definition for a journey node id, or null if not defined. */
export function getJourneyNodeDef(nodeId: string): JourneyNodeDef | null {
  return NODE_DEF_MAP[nodeId] ?? null;
}

/**
 * Computes the actual first-clear reward for a node, applying the star
 * multiplier (0.33 / 0.67 / 1.0) for battle-type nodes.
 * Stars are clamped to 1–3; passing 0 uses the 1★ floor so any win pays.
 */
export function computeJourneyReward(
  def: JourneyNodeDef,
  stars: number,
): ComputedJourneyReward {
  const mul = def.starsScale ? Math.min(3, Math.max(1, stars)) / 3 : 1;
  return {
    playerXp: Math.max(1, Math.round(def.playerXp * mul)),
    heroXp:   Math.max(0, Math.round(def.heroXp   * mul)),
    coins:    Math.max(0, Math.round(def.coins     * mul)),
    credits:  def.credits ?? 0,
    shards:   def.shards  ?? 0,
  };
}

/**
 * Returns the repeatable replay reward for a non-story node.
 * Story / reflection / realm nodes (isStory = true) are never farmable → null.
 */
export function computeJourneyReplayReward(
  def: JourneyNodeDef,
): ComputedJourneyReward | null {
  if (def.isStory) return null;
  return {
    playerXp: Math.max(1, Math.round(def.playerXp * JOURNEY_REPLAY_FACTOR)),
    heroXp:   0,
    coins:    Math.max(0, Math.round(def.coins * JOURNEY_REPLAY_FACTOR)),
    credits:  0,
    shards:   0,
  };
}

/** Returns all node ids for a given chapter number (1–5). */
export function getChapterNodeIds(chapter: number): string[] {
  return JOURNEY_NODE_DEFS
    .filter((d) => d.chapter === chapter)
    .map((d) => d.nodeId);
}
