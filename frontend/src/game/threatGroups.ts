/**
 * game/threatGroups.ts — Push 6: chapter-scaled threat group generation.
 *
 * Produces the initial Threat[] (and optional phase list) for one battle
 * encounter based on chapter number, encounter kind, and a deterministic
 * string seed.  The same (seed, chapter, kind) triple always yields the same
 * threat composition, so returning to an unresolved tile never reshuffles the
 * encounter.
 *
 * Three encounter kinds
 * ──────────────────────
 *  normal        — 1–3 threats rolled from the chapter probability table.
 *  area_boss     — boss (acute) + 0–2 caller-supplied supports, total ≤ 3.
 *  chapter_boss  — boss (acute) alone; additional supports rotate in per phase
 *                  (see BossPhaseInput / BossPhase) rather than stacking bars.
 *
 * PRNG namespace
 * ───────────────
 * Seed string is hashed via fnv1a32 and namespaced per kind+chapter so
 * independent encounter types drawing from the same run seed never share
 * an RNG stream:
 *
 *   normal       → fnv1a32(`${seed}:tg:normal:ch${chapter}`)
 *   area_boss    → fnv1a32(`${seed}:tg:area_boss:ch${chapter}`)
 *   chapter_boss → fnv1a32(`${seed}:tg:chapter_boss:ch${chapter}`)
 *
 * The caller is responsible for ensuring the seed is tile-specific when the
 * same run visits multiple normal encounters (e.g. pass `${runSeed}:${tileId}`).
 *
 * Dependencies
 * ─────────────
 *  threats.ts          — Threat types + builders
 *  journeyMap/prng.ts  — mulberry32 / fnv1a32 (pure math, no React)
 */

import { mulberry32, fnv1a32 }           from './journeyMap/prng';
import {
  buildThreats,
  makeThreat,
  threatFromEnemy,
  MAX_THREATS,
  type Threat,
  type ThreatRole,
} from './threats';
import type { Enemy } from './types';

// ── Chapter count-weight table ─────────────────────────────────────────────────

/** Weight entry: how many concurrent threats, and its basis-point probability. */
interface CountEntry {
  readonly count:  1 | 2 | 3;
  /** Basis points (10 000 = 100 %). Must sum to 10 000 within each row. */
  readonly bpWeight: number;
}

/** Total basis points per row — used as the RNG ceiling. */
const TOTAL_BP = 10_000;

/**
 * Chapter probability rows.
 * Evaluated top-to-bottom; first matching row wins.
 *
 * Chapter 1  : 100 % one threat.
 * Chapter 2  :  70 % one / 30 % two.
 * Chapter 3  : 100 % two.
 * Chapters 4–6:  80 % two / 20 % three.
 * Chapters 7–10: 40 % two / 60 % three.
 * Chapter 11+ :  25 % two / 75 % three.
 */
const COUNT_ROWS: ReadonlyArray<{
  match:   (ch: number) => boolean;
  entries: readonly CountEntry[];
}> = [
  {
    match:   ch => ch <= 1,
    entries: [{ count: 1, bpWeight: 10_000 }],
  },
  {
    match:   ch => ch === 2,
    entries: [{ count: 1, bpWeight: 7_000 }, { count: 2, bpWeight: 3_000 }],
  },
  {
    match:   ch => ch === 3,
    entries: [{ count: 2, bpWeight: 10_000 }],
  },
  {
    match:   ch => ch >= 4 && ch <= 6,
    entries: [{ count: 2, bpWeight: 8_000 }, { count: 3, bpWeight: 2_000 }],
  },
  {
    match:   ch => ch >= 7 && ch <= 10,
    entries: [{ count: 2, bpWeight: 4_000 }, { count: 3, bpWeight: 6_000 }],
  },
  {
    match:   () => true,           // ch >= 11 — catch-all
    entries: [{ count: 2, bpWeight: 2_500 }, { count: 3, bpWeight: 7_500 }],
  },
] as const;

// ── Public types ───────────────────────────────────────────────────────────────

/** Discriminates between the three encounter build strategies. */
export type ThreatGroupKind = 'normal' | 'area_boss' | 'chapter_boss';

/**
 * Phase specification provided by the caller when building a chapter boss.
 *
 * Phases describe when (corruption %) the boss transitions and what support
 * threats (if any) accompany it in that phase.  Supports are phase-exclusive —
 * they replace the previous phase's supports, never stack additively.
 * Total concurrent threats (boss + supports) must not exceed MAX_THREATS.
 */
export interface BossPhaseInput {
  /** Matches a phaseId in boss.phases[] if the enemy uses per-phase weak elements. */
  phaseId:     string;
  /** Short label shown in the battle HUD when this phase is active. */
  label:       string;
  /**
   * Boss corruption percentage threshold at which this phase becomes active.
   * Phases are evaluated with "activatesAt >= currentCorruptionPct".
   * List phases in descending activatesAt order so the first phase is always active
   * at full HP (e.g. 100, 66, 33).
   */
  activatesAt: number;
  /**
   * Support enemies for this phase (0–2).
   * These replace the prior phase's supports when the threshold is crossed.
   * Omit or pass [] for a solo-boss phase.
   */
  supports?:   readonly Enemy[];
}

/** Resolved phase stored inside ThreatGroup — Threat objects pre-built. */
export interface BossPhase {
  readonly phaseId:     string;
  readonly label:       string;
  readonly activatesAt: number;
  /** Pre-built Threat objects for this phase's supports (may be empty). */
  readonly supports:    readonly Threat[];
}

/**
 * The output of all three builder functions.
 *
 *  kind          — which builder produced this group.
 *  chapter       — chapter number used for count probabilities.
 *  seed          — the seed string provided by the caller (stored for debugging).
 *  threats       — initial active threats, length 1–MAX_THREATS.
 *                  For chapter_boss this is always [bossAsThreat]; phase
 *                  supports are latent until the phase transition fires.
 *  phases        — only present for chapter_boss; sorted descending by activatesAt.
 */
export interface ThreatGroup {
  readonly kind:    ThreatGroupKind;
  readonly chapter: number;
  readonly seed:    string;
  readonly threats: readonly Threat[];
  readonly phases?: readonly BossPhase[];
}

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Weighted categorical sample from a CountEntry[].
 * Returns the count of the first entry whose cumulative weight exceeds the roll.
 */
function sampleCount(entries: readonly CountEntry[], rng: () => number): 1 | 2 | 3 {
  const roll = rng() * TOTAL_BP;
  let cumulative = 0;
  for (const entry of entries) {
    cumulative += entry.bpWeight;
    if (roll < cumulative) return entry.count;
  }
  // Floating-point safety: return last entry's count.
  return entries[entries.length - 1].count;
}

/**
 * Derive the seeded RNG for a given kind + chapter.
 * @internal
 */
function makeRng(seed: string, kind: ThreatGroupKind, chapter: number): () => number {
  return mulberry32(fnv1a32(`${seed}:tg:${kind}:ch${chapter}`));
}

/**
 * Resolve the chapter count table row for a given chapter.
 * Returns a defensive fallback (1 threat) if no row matches (should never happen
 * since the catch-all row always matches ch >= 11).
 */
function rowForChapter(chapter: number): readonly CountEntry[] {
  const row = COUNT_ROWS.find(r => r.match(chapter));
  return row?.entries ?? [{ count: 1, bpWeight: TOTAL_BP }];
}

// ── Public API: count table ────────────────────────────────────────────────────

/**
 * Roll the number of concurrent threats for a normal encounter in `chapter`.
 * Uses the provided RNG — the caller is responsible for seeding it correctly.
 *
 * Useful for inspecting the probability tables in tests without needing Enemy
 * objects.
 *
 * @param chapter  Chapter number (1-indexed; values < 1 are treated as ch 1).
 * @param rng      Seeded random-number generator returning floats in [0, 1).
 * @returns        1, 2, or 3.
 */
export function rollThreatCount(chapter: number, rng: () => number): 1 | 2 | 3 {
  return sampleCount(rowForChapter(Math.max(1, chapter)), rng);
}

/**
 * Return the raw basis-point weight entries for a chapter's count distribution.
 * Intended for tests and balance tooling.
 */
export function getCountWeightsForChapter(chapter: number): readonly CountEntry[] {
  return rowForChapter(Math.max(1, chapter));
}

// ── Builder: normal encounter ──────────────────────────────────────────────────

/**
 * Build a normal encounter threat group.
 *
 * Algorithm
 * ──────────
 * 1. Hash `seed:tg:normal:ch${chapter}` → Mulberry32 RNG.
 * 2. Roll threat count from the chapter probability table.
 * 3. Clamp count to Math.min(rolledCount, enemies.length, MAX_THREATS).
 * 4. Assign default roles: first → acute, second → progressive, third → disruptor.
 * 5. Return ThreatGroup.
 *
 * The caller selects which Enemy objects to use for the encounter; this function
 * only determines how many of them become active threats.  Passing more than
 * MAX_THREATS enemies is safe — extras are silently ignored.
 *
 * @param enemies  Enemy objects pre-selected for this tile (1–N).
 * @param chapter  Chapter number (determines count probabilities).
 * @param seed     Deterministic seed string (e.g. `${runSeed}:${tileId}`).
 */
export function buildNormalThreatGroup(
  enemies:  readonly Enemy[],
  chapter:  number,
  seed:     string,
): ThreatGroup {
  const rng          = makeRng(seed, 'normal', chapter);
  const rolledCount  = rollThreatCount(chapter, rng);
  const count        = Math.min(rolledCount, enemies.length, MAX_THREATS);
  const threats      = buildThreats(enemies.slice(0, count));

  return { kind: 'normal', chapter, seed, threats };
}

// ── Builder: area boss ─────────────────────────────────────────────────────────

/**
 * Build an area boss encounter threat group.
 *
 * The boss is always the first (acute) threat.
 * Up to two caller-supplied support enemies are added as progressive / disruptor.
 * Total threats are capped at MAX_THREATS (3); excess supports are discarded.
 *
 * No probabilistic count roll: the number of threats equals 1 + supports.length
 * (capped at 3).  The seed is stored for provenance but is not used for
 * count determination.
 *
 * @param boss      The area boss enemy (role: 'acute').
 * @param supports  Optional support enemies (0–2; role: 'progressive', 'disruptor').
 * @param seed      Seed string (stored in ThreatGroup; used for future extensions).
 * @param chapter   Chapter number (stored in ThreatGroup).
 */
export function buildAreaBossThreatGroup(
  boss:     Enemy,
  supports: readonly Enemy[],
  seed:     string,
  chapter:  number,
): ThreatGroup {
  const supportRoles: ThreatRole[] = ['progressive', 'disruptor'];
  const bossT = threatFromEnemy(boss, 'acute');

  const supportTs: Threat[] = supports
    .slice(0, MAX_THREATS - 1)           // at most 2 supports so total ≤ 3
    .map((e, i) => threatFromEnemy(e, supportRoles[i]));

  const threats: readonly Threat[] = [bossT, ...supportTs];
  return { kind: 'area_boss', chapter, seed, threats };
}

// ── Builder: chapter boss ──────────────────────────────────────────────────────

/**
 * Build a chapter boss encounter threat group.
 *
 * The boss starts as the sole active threat (role: 'acute').  Phase supports are
 * pre-built as latent Threats and stored in BossPhase.supports — the battle
 * engine activates them when the corresponding corruption threshold is crossed.
 *
 * Rule: boss + any single phase's supports must not exceed MAX_THREATS.
 * Excess phase supports beyond MAX_THREATS - 1 are silently discarded.
 *
 * Phases are returned sorted descending by activatesAt so the first entry in the
 * array always represents the opening (full-HP) phase.
 *
 * @param boss    The chapter boss enemy (role: 'acute').
 * @param phases  Optional phase definitions.  Pass [] or omit for a solo boss.
 * @param seed    Seed string (stored for provenance).
 * @param chapter Chapter number (stored in ThreatGroup).
 */
export function buildChapterBossThreatGroup(
  boss:     Enemy,
  phases:   readonly BossPhaseInput[],
  seed:     string,
  chapter:  number,
): ThreatGroup {
  const supportRoles: ThreatRole[] = ['progressive', 'disruptor'];
  const bossT = threatFromEnemy(boss, 'acute');

  // Build BossPhase objects — supports are latent Threats.
  const resolvedPhases: BossPhase[] = phases.map(ph => {
    const supEnems = (ph.supports ?? []).slice(0, MAX_THREATS - 1);
    const supports: Threat[] = supEnems.map((e, i) =>
      makeThreat({
        id:            e.id,
        name:          e.name,
        corruptionMax: e.corruption,
        speed:         e.instability,
        role:          supportRoles[i],
        latent:        true,   // activated by the battle engine at phase transition
      }),
    );
    return {
      phaseId:     ph.phaseId,
      label:       ph.label,
      activatesAt: ph.activatesAt,
      supports,
    };
  });

  // Sort descending so index 0 = opening phase (activatesAt = 100 or highest).
  resolvedPhases.sort((a, b) => b.activatesAt - a.activatesAt);

  return {
    kind:    'chapter_boss',
    chapter,
    seed,
    threats: [bossT],
    phases:  resolvedPhases,
  };
}

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Validate a ThreatGroup.  Returns a (possibly empty) array of error strings.
 *
 * Checks:
 *  • threats.length is in [1, MAX_THREATS].
 *  • No duplicate threat ids.
 *  • For area_boss: first threat must be role 'acute'.
 *  • For chapter_boss:
 *      - threats must be exactly [boss] (length 1).
 *      - phases must be present (not undefined).
 *      - Each phase's activatesAt must be in [0, 100].
 *      - Each phase's supports + 1 (boss) must not exceed MAX_THREATS.
 *      - Phases must be sorted descending by activatesAt.
 *  • For normal: threats.length must not exceed MAX_THREATS.
 */
export function validateThreatGroup(group: ThreatGroup): readonly string[] {
  const errors: string[] = [];
  const { kind, threats, phases } = group;

  if (threats.length === 0) {
    errors.push('ThreatGroup must contain at least one threat.');
  }
  if (threats.length > MAX_THREATS) {
    errors.push(`ThreatGroup has ${threats.length} threats (max ${MAX_THREATS}).`);
  }

  // Duplicate id check
  const ids = new Set<string>();
  for (const t of threats) {
    if (ids.has(t.id)) errors.push(`Duplicate threat id: "${t.id}".`);
    ids.add(t.id);
  }

  if (kind === 'area_boss') {
    if (threats[0]?.role !== 'acute') {
      errors.push("area_boss: first threat must have role 'acute'.");
    }
  }

  if (kind === 'chapter_boss') {
    if (threats.length !== 1) {
      errors.push(`chapter_boss: initial threats must be exactly [boss]; got ${threats.length}.`);
    }
    if (!phases) {
      errors.push("chapter_boss: phases must be defined (use [] for solo boss).");
    } else {
      for (let i = 0; i < phases.length; i++) {
        const ph = phases[i];
        if (ph.activatesAt < 0 || ph.activatesAt > 100) {
          errors.push(`Phase "${ph.phaseId}": activatesAt ${ph.activatesAt} out of [0, 100].`);
        }
        if (ph.supports.length + 1 > MAX_THREATS) {
          errors.push(
            `Phase "${ph.phaseId}": ${ph.supports.length} support(s) + boss exceeds MAX_THREATS (${MAX_THREATS}).`,
          );
        }
        // Check descending sort
        if (i > 0 && ph.activatesAt > phases[i - 1].activatesAt) {
          errors.push(
            `phases must be sorted descending by activatesAt ` +
            `(index ${i - 1}: ${phases[i - 1].activatesAt}, index ${i}: ${ph.activatesAt}).`,
          );
        }
      }
    }
  }

  return errors;
}
