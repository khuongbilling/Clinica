/**
 * C4 — Level Milestone Rewards, Chapter Completion Chests, First-Time 3-Star Bonuses.
 *
 * All rewards are one-time claim-only.  Replay and sweep must NOT re-trigger
 * milestone, chapter, or 3-star rewards — gated by `claimed_level_rewards`,
 * `claimed_chapter_chests`, and `claimed_chapter_3star` on the player object.
 *
 * Currency mapping:
 *   playerXp           → player.xp  (Player Level progression)
 *   heroXp             → split equally among active team hero_progression
 *   codexShards        → codex_shards  (Summoning Shards in-game)
 *   crowns             → crowns         (Ward Coins)
 *   refinedLotusGems   → refined_lotus_gems
 *   universityCredits  → university_credits
 *
 * J2: playerXp and heroXp added to MilestoneReward + CHAPTER_CHESTS updated.
 */

// ── Shared reward shape ───────────────────────────────────────────────────────

export interface MilestoneReward {
  /** J2: Player XP awarded from this chest/milestone. */
  playerXp?: number;
  /** J2: Hero XP split equally among the active team. */
  heroXp?: number;
  codexShards?: number;
  crowns?: number;
  refinedLotusGems?: number;
  universityCredits?: number;
}

// ── Level milestones ──────────────────────────────────────────────────────────

export interface LevelMilestone {
  id: string;       // e.g. "lvl_2" — stored in claimed_level_rewards
  level: number;
  label: string;
  unlock: string;   // one-line description of what opens at this level
  rewards: MilestoneReward;
}

export const LEVEL_MILESTONES: LevelMilestone[] = [
  {
    id: "lvl_2", level: 2, label: "Level 2",
    unlock: "Summoning Hall · Daily Rounds · Ward Shift",
    rewards: { codexShards: 50, crowns: 100, universityCredits: 5 },
  },
  {
    id: "lvl_3", level: 3, label: "Level 3",
    unlock: "Hall of Heroes full access",
    rewards: { crowns: 150, refinedLotusGems: 3 },
  },
  {
    id: "lvl_4", level: 4, label: "Level 4",
    unlock: "Ward Defense unlocked",
    rewards: { crowns: 200, universityCredits: 10 },
  },
  {
    id: "lvl_5", level: 5, label: "Level 5",
    unlock: "Realm / Sanctuary unlocked",
    rewards: { crowns: 250, codexShards: 30 },
  },
  {
    id: "lvl_7", level: 7, label: "Level 7",
    unlock: "Boss Ward unlocked",
    rewards: { codexShards: 75, refinedLotusGems: 5 },
  },
  {
    id: "lvl_10", level: 10, label: "Level 10",
    unlock: "Class Tree Tier 1",
    rewards: { universityCredits: 20, codexShards: 50 },
  },
  {
    id: "lvl_15", level: 15, label: "Level 15",
    unlock: "Chapter 9 — Real Ward Preparation",
    rewards: { codexShards: 100, refinedLotusGems: 10 },
  },
  {
    id: "lvl_18", level: 18, label: "Level 18",
    unlock: "Chapter 10 — Finale Preparation",
    rewards: { codexShards: 125, refinedLotusGems: 12 },
  },
  {
    id: "lvl_20", level: 20, label: "Level 20",
    unlock: "Phase 2 preview milestone",
    rewards: { refinedLotusGems: 20, codexShards: 150 },
  },
  {
    id: "lvl_30", level: 30, label: "Level 30",
    unlock: "Long-term mastery milestone",
    rewards: { refinedLotusGems: 30, codexShards: 200 },
  },
];

// ── Chapter completion chests ─────────────────────────────────────────────────
// J2: Chapters 1–5 updated to include playerXp and heroXp.
// Chapters 6–10 retain their existing rewards (J3+ scope).

export interface ChapterChest {
  id: string;       // e.g. "chest_ch1" — stored in claimed_chapter_chests
  chapter: number;  // 1–10
  titleId?: string; // optional once-only title award
  rewards: MilestoneReward;
}

export const CHAPTER_CHESTS: ChapterChest[] = [
  {
    id: "chest_ch1", chapter: 1, titleId: "apprentice_healer",
    rewards: {
      playerXp: 30, heroXp: 25,
      codexShards: 50, crowns: 100, refinedLotusGems: 5,
    },
  },
  {
    id: "chest_ch2", chapter: 2,
    rewards: {
      playerXp: 60, heroXp: 40,
      codexShards: 100, crowns: 150, universityCredits: 50, refinedLotusGems: 10,
    },
  },
  {
    id: "chest_ch3", chapter: 3,
    rewards: {
      playerXp: 80, heroXp: 50,
      codexShards: 125, crowns: 200, universityCredits: 75, refinedLotusGems: 15,
    },
  },
  {
    id: "chest_ch4", chapter: 4,
    rewards: {
      playerXp: 100, heroXp: 75,
      codexShards: 150, crowns: 250, universityCredits: 100, refinedLotusGems: 15,
    },
  },
  {
    id: "chest_ch5", chapter: 5,
    rewards: {
      playerXp: 125, heroXp: 100,
      codexShards: 150, crowns: 300, universityCredits: 125, refinedLotusGems: 20,
    },
  },
  {
    id: "chest_ch6", chapter: 6,
    rewards: { codexShards: 175, crowns: 400, universityCredits: 20 },
  },
  {
    id: "chest_ch7", chapter: 7,
    rewards: { codexShards: 200, refinedLotusGems: 25 },
  },
  {
    id: "chest_ch8", chapter: 8,
    rewards: { codexShards: 225, crowns: 500, universityCredits: 25 },
  },
  {
    id: "chest_ch9", chapter: 9,
    rewards: { codexShards: 250, refinedLotusGems: 30, crowns: 500 },
  },
  {
    id: "chest_ch10", chapter: 10, titleId: "recall_survivor",
    rewards: { codexShards: 500, refinedLotusGems: 75 },
  },
];

// ── First-time 3-star chapter bonuses ────────────────────────────────────────
// Total Phase 1 perfect-play bonus: 220 Refined Lotus Gems.

export interface Chapter3StarReward {
  id: string;       // e.g. "3star_ch1" — stored in claimed_chapter_3star
  chapter: number;
  refinedLotusGems: number;
}

export const CHAPTER_3STAR_REWARDS: Chapter3StarReward[] = [
  { id: "3star_ch1",  chapter: 1,  refinedLotusGems: 10 },
  { id: "3star_ch2",  chapter: 2,  refinedLotusGems: 10 },
  { id: "3star_ch3",  chapter: 3,  refinedLotusGems: 15 },
  { id: "3star_ch4",  chapter: 4,  refinedLotusGems: 15 },
  { id: "3star_ch5",  chapter: 5,  refinedLotusGems: 20 },
  { id: "3star_ch6",  chapter: 6,  refinedLotusGems: 20 },
  { id: "3star_ch7",  chapter: 7,  refinedLotusGems: 25 },
  { id: "3star_ch8",  chapter: 8,  refinedLotusGems: 25 },
  { id: "3star_ch9",  chapter: 9,  refinedLotusGems: 30 },
  { id: "3star_ch10", chapter: 10, refinedLotusGems: 50 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true if at least one enemy at the given chapter difficulty has been
 * cleared with a 3-star rating.  "Chapter difficulty" = chapter.number.
 */
export function hasChapter3StarClear(
  battleStars: Record<string, number>,
  chapterNum: number,
  enemies: Array<{ id: string; difficulty: number }>,
): boolean {
  return enemies.some(
    (e) => e.difficulty === chapterNum && (battleStars[e.id] ?? 0) >= 3,
  );
}

/** Human-readable reward summary string (e.g. "100 Shards · 10 Refined Gems"). */
export function formatReward(rewards: MilestoneReward): string {
  const parts: string[] = [];
  if (rewards.playerXp)         parts.push(`${rewards.playerXp} XP`);
  if (rewards.codexShards)      parts.push(`${rewards.codexShards} Shards`);
  if (rewards.crowns)           parts.push(`${rewards.crowns} Crowns`);
  if (rewards.refinedLotusGems) parts.push(`${rewards.refinedLotusGems} Refined Gems`);
  if (rewards.universityCredits) parts.push(`${rewards.universityCredits} UC`);
  return parts.join(" · ") || "Reward";
}
