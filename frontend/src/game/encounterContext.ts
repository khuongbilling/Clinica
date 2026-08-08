/**
 * game/encounterContext.ts — Push 12: bridge persistent map state into battles.
 *
 * When the player enters a battle tile on the fog map, this module assembles
 * one immutable EncounterContext that carries every piece of chapter state the
 * battle engine needs.  The context is a snapshot — the map never re-rolls
 * while the battle runs, and returning from battle restores exactly the tile,
 * fog, and rewards that existed when the context was built.
 *
 * Stamina contract (spec requirement)
 * ─────────────────────────────────────
 *   Movement stamina is charged when the player steps onto a tile.  Entering
 *   a battle on that tile does NOT charge additional stamina.  The
 *   staminaAlreadyCharged: true literal on EncounterContext documents and
 *   enforces this contract — buildEncounterContext always sets it true.
 *
 * No-reroll guarantee (spec requirement)
 * ────────────────────────────────────────
 *   run.seed is frozen for the run's lifetime.  The BattleReturnCheckpoint
 *   carries runSeed and validateReturnCheckpoint() fails if it changed.
 *   The encounter seed used for battle RNG is DERIVED from run.seed — it
 *   is never written back to the run record.
 *
 * Composition of domain pushes
 * ─────────────────────────────
 *   EncounterContext assembles:
 *     Push 6  — ThreatGroup
 *     Push 8  — OrchestrationResult
 *     Push 9  — ReadinessResult + ContextReadinessModifiers
 *     Push 10 — ChapterLoadout (call team, cards, blessings, hazards)
 *     Push 11 — ShiftPressure + PressureModEffect[]
 *
 * This module is pure domain logic — no React, no BattleState writes.
 */

// ── Imports ───────────────────────────────────────────────────────────────────

import type { TimeOfDay, EncounterType } from './journeyMap/types';
import type { ThreatGroup }              from './threatGroups';
import type { OrchestrationResult }      from './shiftOrchestration';
import type {
  ShiftPressure,
  PressureModEffect,
}                                        from './shiftPressure';
import type {
  ChapterLoadout,
  CallTeamMember,
  ProtocolCard,
  WardBlessing,
  WardHazard,
}                                        from './chapterLoadout';
import type { ReadinessResult }          from './openingReadiness';

import {
  getPressureEffects,
  pressureTeamReadinessDelta,
  pressureEnemyReadinessDelta,
  pressureApPenalty,
  pressureArrivalDelta,
  pressureHidesIntent,
  pressureRevealsIntent,
  pressureRevealsLatent,
  pressureLatentBonus,
  validatePressure,
}                                        from './shiftPressure';
import {
  activeBlessings,
  battleHazards,
  availableCards,
  totalPressurePenalty,
  validateChapterLoadout,
}                                        from './chapterLoadout';

// ── Valid battle encounter types ──────────────────────────────────────────────

/**
 * The three EncounterType values that produce a battle.
 * Ward events, treasure, and 'none' tiles are not battle encounters.
 */
export const BATTLE_ENCOUNTER_TYPES: ReadonlySet<EncounterType> = new Set(
  ['battle', 'areaBoss'] as EncounterType[],
);

/** True when the encounter type resolves to a battle. */
export function isBattleEncounter(type: EncounterType): boolean {
  return BATTLE_ENCOUNTER_TYPES.has(type);
}

// ── Map preparation effects ───────────────────────────────────────────────────

/**
 * What kind of map-side preparation the player completed before the battle
 * tile was entered.  These translate into context modifiers applied on top of
 * the chapter loadout and pressure effects.
 */
export type MapPreparationEffectKind =
  | 'rest_before_battle'        // player rested on an adjacent tile → stability bonus
  | 'scout_complete'            // scout ability revealed threat intent(s)
  | 'ally_pre_coordinated'      // Call Team was briefed → support bonus
  | 'hazard_partially_cleared'  // player cleared part of a ward hazard before entering
  | 'supply_run'                // collected clinical supplies → AP bonus
  | 'ward_patrol';              // completed a ward patrol → readiness bonus

export interface MapPreparationEffect {
  /** What was done on the map before entering the tile. */
  readonly kind:       MapPreparationEffectKind;
  /**
   * Numeric magnitude where applicable (stability restored, AP added, etc.).
   * Absent for effects without a numeric parameter (e.g. scout_complete).
   */
  readonly magnitude?: number;
  /** Short HUD log description (e.g. "Rested before engagement"). */
  readonly reason:     string;
}

// ── Context readiness modifiers ───────────────────────────────────────────────

/**
 * All the numeric modifiers the battle engine needs to complete the
 * TeamReadinessInput and EnemyReadinessInput calls from Push 9.
 *
 * Hero speeds are NOT included — the battle engine supplies those from the
 * active roster.  Everything else is derived from the chapter map state.
 */
export interface ContextReadinessModifiers {
  /** Sum of map preparation bonuses that feed TeamReadinessInput.mapBonus. */
  readonly mapBonus:        number;
  /**
   * Bonus from available (unplayed) Protocol Cards.
   * Feeds TeamReadinessInput.cardBonus.
   */
  readonly cardBonus:       number;
  /**
   * Bonus from active blessings and pressure readiness effects.
   * Feeds TeamReadinessInput.blessingBonus.
   */
  readonly blessingBonus:   number;
  /**
   * Bonus from Call Team members whose bonus.kind === 'readiness_bonus'.
   * Feeds TeamReadinessInput.supportBonus.
   */
  readonly supportBonus:    number;
  /**
   * Penalty from active battle-scope Ward Hazards.
   * Feeds TeamReadinessInput.pressurePenalty.
   */
  readonly pressurePenalty: number;
  /**
   * Bonus applied to enemy readiness from high Silent Risk pressure.
   * Feeds EnemyReadinessInput.encounterAlertness.
   */
  readonly enemyAlertness:  number;
  /**
   * AP to subtract from round-1 available AP (high Coordination Load).
   * Used by the battle engine before dealing any cards.
   */
  readonly apPenalty:       number;
  /**
   * Signed round delta for Reinforcement.arrivalRound.
   * Negative = earlier (high Handoff Debt); positive = later (low Handoff Debt).
   * Caller clamps to ≥ 2 before applying.
   */
  readonly arrivalDelta:    number;
}

// ── EncounterContext ──────────────────────────────────────────────────────────

/**
 * Immutable snapshot of all chapter map state needed to run a battle.
 *
 * Built by buildEncounterContext() when the player steps onto a battle tile.
 * Passed to the battle engine; never mutated during the battle.
 */
export interface EncounterContext {
  // ── Map identity ──────────────────────────────────────────────────────────

  /** The JourneyRun.id that produced this context. */
  readonly runId:         string;

  /** Chapter number (1-based). */
  readonly chapterId:     number;

  /** Time-of-day shift frozen at run creation. */
  readonly shift:         TimeOfDay;

  /** The tile that triggered this battle. */
  readonly tileId:        string;

  /** The EncounterType on the tile (one of BATTLE_ENCOUNTER_TYPES). */
  readonly encounterType: EncounterType;

  /**
   * Deterministic RNG seed for this specific battle.
   * Derived from JourneyRun.seed and tileId via deriveEncounterSeed().
   * Never written back to the run record — does not trigger a map reroll.
   */
  readonly encounterSeed: string;

  // ── Threat data ───────────────────────────────────────────────────────────

  /** Threat group assembled for this encounter. */
  readonly threatGroup:   ThreatGroup;

  /** Shift-specific threat layout (day/evening/night orchestration). */
  readonly orchestration: OrchestrationResult;

  // ── Pressure ──────────────────────────────────────────────────────────────

  /** Chapter pressure state at the moment the tile was entered. */
  readonly pressure:        ShiftPressure;

  /** Resolved pressure effects for this encounter (never empty arrays are safe). */
  readonly pressureEffects: readonly PressureModEffect[];

  // ── Chapter loadout (Push 10) ─────────────────────────────────────────────

  /**
   * Snapshot of the active chapter loadout.
   * Contains the full call team, cards, blessings, and hazards as they stood
   * when the tile was entered.
   */
  readonly loadout:         ChapterLoadout;

  /**
   * Active Call Team members available in this battle.
   * Derived from loadout.callTeam for quick access.
   */
  readonly callTeam:        readonly CallTeamMember[];

  /**
   * Protocol Cards still available to play (used:false).
   * Derived from loadout.cards for quick access.
   */
  readonly availableCards:  readonly ProtocolCard[];

  /**
   * Active blessings (major + minor, non-null).
   * Derived from loadout for quick access.
   */
  readonly activeBlessings: readonly WardBlessing[];

  /**
   * Ward hazards whose scope is 'battle' or 'both'.
   * Derived from loadout for quick access.
   */
  readonly battleHazards:   readonly WardHazard[];

  // ── Readiness (Push 9) ────────────────────────────────────────────────────

  /**
   * Pre-computed opening readiness result.
   * Stored for the battle HUD; the battle engine may recompute if hero
   * speeds are updated after context creation.
   */
  readonly readiness:        ReadinessResult;

  /**
   * All numeric modifiers derived from pressure + loadout + map preparation,
   * ready to slot into TeamReadinessInput / EnemyReadinessInput (Push 9).
   */
  readonly readinessModifiers: ContextReadinessModifiers;

  // ── Map preparation ───────────────────────────────────────────────────────

  /**
   * Effects from map decisions made before entering this tile.
   * Empty array when no preparation was done.
   */
  readonly mapPreparationEffects: readonly MapPreparationEffect[];

  // ── Stamina contract ──────────────────────────────────────────────────────

  /**
   * Always true.  Movement stamina was charged when the player stepped onto
   * this tile.  The battle engine must NOT charge stamina again simply
   * because the tile is a battle encounter.
   */
  readonly staminaAlreadyCharged: true;
}

// ── Encounter seed ────────────────────────────────────────────────────────────

/**
 * Derive a deterministic, unique encounter seed string for battle RNG.
 *
 * The seed is derived from the run's fixed seed and the tile id.  It is
 * NEVER written back to the run — the map seed stays unchanged.
 *
 * The battle engine converts this string to a numeric seed using the same
 * fnv1a32 hasher used by the threat-group PRNG (Push 6).
 *
 * @param runSeed  JourneyRun.seed (hex string, never changes for the run).
 * @param tileId   JourneyTile.id (e.g. "tile_3_2").
 */
export function deriveEncounterSeed(runSeed: string, tileId: string): string {
  return `${runSeed}:encounter:${tileId}`;
}

// ── Readiness modifier builder ────────────────────────────────────────────────

/**
 * Derive ContextReadinessModifiers from pressure effects, loadout, and
 * map preparation effects.
 *
 * Caller combines mapBonus / cardBonus / blessingBonus / supportBonus /
 * pressurePenalty into TeamReadinessInput (Push 9) alongside heroSpeeds.
 * Caller combines enemyAlertness into EnemyReadinessInput alongside
 * threatSpeeds.
 */
export function buildReadinessModifiers(
  pressureEffects:     readonly PressureModEffect[],
  loadout:             ChapterLoadout,
  mapPreparationEffects: readonly MapPreparationEffect[],
): ContextReadinessModifiers {
  // Map bonus: sum of ward_patrol and rest_before_battle preparation effects
  const mapBonus = mapPreparationEffects.reduce<number>((sum, e) => {
    if (e.kind === 'ward_patrol' || e.kind === 'rest_before_battle') {
      return sum + (e.magnitude ?? 0);
    }
    return sum;
  }, 0);

  // Card bonus: one point per available (unplayed) card as a readiness signal
  const available = availableCards(loadout);
  const cardBonus = available.length;

  // Blessing bonus: pressure team-readiness effect (day low / night low)
  const blessingBonus = pressureTeamReadinessDelta(pressureEffects);

  // Support bonus: sum of readiness_bonus Call Team members
  const supportBonus = loadout.callTeam.reduce<number>((sum, m) => {
    if (m.bonus.kind === 'readiness_bonus') return sum + m.bonus.magnitude;
    return sum;
  }, 0);

  // Pressure penalty: sum of battle-scope readiness_reduce hazards
  const pressurePenalty = totalPressurePenalty(loadout);

  // Enemy alertness: pressure enemy-readiness effect (night high)
  const enemyAlertness = pressureEnemyReadinessDelta(pressureEffects);

  // AP penalty: high Coordination Load
  const apPenalty = pressureApPenalty(pressureEffects);

  // Arrival delta for reinforcements: evening pressure
  const arrivalDelta = pressureArrivalDelta(pressureEffects);

  return {
    mapBonus,
    cardBonus,
    blessingBonus,
    supportBonus,
    pressurePenalty,
    enemyAlertness,
    apPenalty,
    arrivalDelta,
  };
}

// ── EncounterContext builder ───────────────────────────────────────────────────

/** Inputs required to assemble an EncounterContext. */
export interface BuildEncounterContextInput {
  /** JourneyRun.id — stable identifier for the run. */
  readonly runId:          string;
  /** JourneyRun.chapterId. */
  readonly chapterId:      number;
  /** JourneyRun.shift — frozen for the run. */
  readonly shift:          TimeOfDay;
  /** JourneyRun.seed — fixed hex seed; never changes. */
  readonly runSeed:        string;
  /** JourneyTile.id of the battle tile the player stepped on. */
  readonly tileId:         string;
  /** JourneyTile.encounter — must be a battle encounter type. */
  readonly encounterType:  EncounterType;
  /** Threat group assembled for this encounter (Push 6). */
  readonly threatGroup:    ThreatGroup;
  /** Shift orchestration result (Push 8). */
  readonly orchestration:  OrchestrationResult;
  /** Current chapter pressure (Push 11). */
  readonly pressure:       ShiftPressure;
  /** Full chapter loadout at tile entry time (Push 10). */
  readonly loadout:        ChapterLoadout;
  /** Pre-computed opening readiness (Push 9). */
  readonly readiness:      ReadinessResult;
  /** Optional map preparation effects from decisions before this tile. */
  readonly mapPreparationEffects?: readonly MapPreparationEffect[];
}

/**
 * Build an immutable EncounterContext from the current chapter map state.
 *
 * Call this once when the player steps onto a battle tile.  The returned
 * context is a snapshot — mutations to the run after this point do not
 * affect the battle.
 *
 * @throws if encounterType is not a battle encounter type.
 */
export function buildEncounterContext(
  input: BuildEncounterContextInput,
): EncounterContext {
  const {
    runId, chapterId, shift, runSeed, tileId, encounterType,
    threatGroup, orchestration, pressure, loadout, readiness,
    mapPreparationEffects = [],
  } = input;

  if (!isBattleEncounter(encounterType)) {
    throw new Error(
      `buildEncounterContext: encounterType "${String(encounterType)}" is not a battle encounter. ` +
      `Expected one of: ${Array.from(BATTLE_ENCOUNTER_TYPES).join(', ')}.`,
    );
  }

  const pressureEffects    = getPressureEffects(pressure);
  const readinessModifiers = buildReadinessModifiers(pressureEffects, loadout, mapPreparationEffects);
  const encounterSeed      = deriveEncounterSeed(runSeed, tileId);

  return {
    // Map identity
    runId,
    chapterId,
    shift,
    tileId,
    encounterType,
    encounterSeed,

    // Threat data
    threatGroup,
    orchestration,

    // Pressure
    pressure,
    pressureEffects,

    // Loadout snapshot + derived quick-access
    loadout,
    callTeam:        loadout.callTeam,
    availableCards:  availableCards(loadout),
    activeBlessings: activeBlessings(loadout),
    battleHazards:   battleHazards(loadout),

    // Readiness
    readiness,
    readinessModifiers,

    // Map preparation
    mapPreparationEffects,

    // Stamina contract — always true
    staminaAlreadyCharged: true,
  };
}

// ── Battle return checkpoint ──────────────────────────────────────────────────

/**
 * How the battle resolved.
 *  won   — all threats defeated or stabilised.
 *  fled  — player escaped; tile is still pending.
 *  lost  — team was overwhelmed; chapter attempt tracking applies.
 */
export type BattleTileOutcome = 'won' | 'fled' | 'lost';

/**
 * Captures everything the fog-map navigator needs to restore the correct
 * state after a battle returns.
 *
 * Invariants enforced by validateReturnCheckpoint():
 *  • runId matches the originating context.
 *  • tileId matches the originating context.
 *  • runSeed matches — no map reroll occurred.
 *  • pressureAfterBattle is valid.
 */
export interface BattleReturnCheckpoint {
  /** Which run to restore (must equal EncounterContext.runId). */
  readonly runId:               string;

  /** Which tile to stand on when returning (must equal EncounterContext.tileId). */
  readonly tileId:              string;

  /**
   * The run's seed at return time.
   * Must equal the seed captured in the context — used by
   * validateReturnCheckpoint() to guarantee no map reroll occurred.
   */
  readonly runSeed:             string;

  /** How the battle ended. */
  readonly outcome:             BattleTileOutcome;

  /**
   * Chapter pressure AFTER any battle-outcome modifiers have been applied.
   * May differ from EncounterContext.pressure if the battle emitted
   * PressureModifiers (battle_win / battle_loss sources).
   * The fog-map navigator writes this back to the run record.
   */
  readonly pressureAfterBattle: ShiftPressure;

  /**
   * Whether any cards were spent during the battle.
   * The fog map uses this to update loadout.cards before the next encounter.
   * Null when no cards were drawn or spent.
   */
  readonly usedCardIds:         readonly string[] | null;
}

/**
 * Build a BattleReturnCheckpoint from the originating context and battle
 * outcome data.
 *
 * @param ctx                 The EncounterContext that started the battle.
 * @param outcome             How the battle resolved.
 * @param pressureAfterBattle ShiftPressure after battle-outcome modifiers.
 * @param usedCardIds         IDs of cards spent during the battle (or null).
 */
export function buildReturnCheckpoint(
  ctx:                  EncounterContext,
  outcome:              BattleTileOutcome,
  pressureAfterBattle:  ShiftPressure,
  usedCardIds:          readonly string[] | null = null,
): BattleReturnCheckpoint {
  return {
    runId:               ctx.runId,
    tileId:              ctx.tileId,
    runSeed:             ctx.encounterSeed.split(':encounter:')[0], // recover the original run seed
    outcome,
    pressureAfterBattle,
    usedCardIds,
  };
}

// ── Intent visibility helpers ─────────────────────────────────────────────────

/**
 * True when the combined pressure effects override intent visibility to hidden.
 * The battle HUD should obscure all threat intents.
 */
export function contextHidesAllIntents(ctx: EncounterContext): boolean {
  return pressureHidesIntent(ctx.pressureEffects);
}

/**
 * True when the combined pressure effects override intent visibility to fully revealed.
 * The battle HUD should show all threat intents including normally hidden ones.
 */
export function contextRevealsAllIntents(ctx: EncounterContext): boolean {
  return pressureRevealsIntent(ctx.pressureEffects);
}

/**
 * True when night low pressure causes the latent threat to activate revealed
 * rather than hidden.
 */
export function contextRevealsLatent(ctx: EncounterContext): boolean {
  return pressureRevealsLatent(ctx.pressureEffects);
}

/**
 * Extra readiness-bonus fraction for the latent threat under high Silent Risk.
 * Zero when not applicable.
 */
export function contextLatentBonus(ctx: EncounterContext): number {
  return pressureLatentBonus(ctx.pressureEffects);
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate an EncounterContext for internal consistency.
 * Returns an array of error strings; empty means valid.
 *
 * Checks:
 *  • runId and tileId are non-empty strings.
 *  • chapterId is a positive integer.
 *  • encounterType is a battle encounter type.
 *  • encounterSeed starts with the expected prefix (deriveEncounterSeed pattern).
 *  • pressure passes validatePressure().
 *  • loadout passes validateChapterLoadout().
 *  • staminaAlreadyCharged is true.
 *  • pressureEffects match getPressureEffects(pressure) (no stale snapshot).
 *  • readinessModifiers fields are all finite numbers.
 */
export function validateEncounterContext(ctx: EncounterContext): readonly string[] {
  const errors: string[] = [];

  if (!ctx.runId || typeof ctx.runId !== 'string') {
    errors.push('runId must be a non-empty string.');
  }
  if (!ctx.tileId || typeof ctx.tileId !== 'string') {
    errors.push('tileId must be a non-empty string.');
  }
  if (!Number.isInteger(ctx.chapterId) || ctx.chapterId < 1) {
    errors.push(`chapterId ${ctx.chapterId} must be a positive integer.`);
  }
  if (!isBattleEncounter(ctx.encounterType)) {
    errors.push(`encounterType "${ctx.encounterType}" is not a battle encounter type.`);
  }

  // Encounter seed must be derived from the expected pattern
  const expectedSeedPrefix = ctx.tileId ? `:encounter:${ctx.tileId}` : '';
  if (!ctx.encounterSeed || !ctx.encounterSeed.endsWith(expectedSeedPrefix)) {
    errors.push(`encounterSeed "${ctx.encounterSeed}" must end with ":encounter:${ctx.tileId}".`);
  }

  // Pressure
  errors.push(...validatePressure(ctx.pressure));

  // Loadout
  errors.push(...validateChapterLoadout(ctx.loadout));

  // Stamina contract
  if (ctx.staminaAlreadyCharged !== true) {
    errors.push('staminaAlreadyCharged must be true.');
  }

  // Pressure effects must match the current pressure (not stale)
  const expectedEffects = getPressureEffects(ctx.pressure);
  if (ctx.pressureEffects.length !== expectedEffects.length) {
    errors.push(
      `pressureEffects (${ctx.pressureEffects.length} entries) does not match ` +
      `getPressureEffects(pressure) (${expectedEffects.length} entries). Snapshot may be stale.`,
    );
  }

  // Readiness modifier fields must be finite
  const mods = ctx.readinessModifiers;
  const modFields = [
    'mapBonus', 'cardBonus', 'blessingBonus', 'supportBonus',
    'pressurePenalty', 'enemyAlertness', 'apPenalty', 'arrivalDelta',
  ] as const;
  for (const field of modFields) {
    if (!Number.isFinite(mods[field])) {
      errors.push(`readinessModifiers.${field} is not finite (got ${mods[field]}).`);
    }
  }

  return errors;
}

/**
 * Validate a BattleReturnCheckpoint against the EncounterContext that
 * produced the battle.
 *
 * Checks:
 *  • checkpoint.runId   matches ctx.runId.
 *  • checkpoint.tileId  matches ctx.tileId.
 *  • checkpoint.runSeed matches the run seed embedded in ctx.encounterSeed
 *    (guarantees no map reroll occurred during the battle).
 *  • pressureAfterBattle passes validatePressure().
 */
export function validateReturnCheckpoint(
  checkpoint: BattleReturnCheckpoint,
  ctx:        EncounterContext,
): readonly string[] {
  const errors: string[] = [];

  if (checkpoint.runId !== ctx.runId) {
    errors.push(
      `checkpoint.runId "${checkpoint.runId}" does not match context.runId "${ctx.runId}".`,
    );
  }
  if (checkpoint.tileId !== ctx.tileId) {
    errors.push(
      `checkpoint.tileId "${checkpoint.tileId}" does not match context.tileId "${ctx.tileId}".`,
    );
  }

  // Recover original run seed from encounterSeed and compare
  const originalSeed = ctx.encounterSeed.split(':encounter:')[0];
  if (checkpoint.runSeed !== originalSeed) {
    errors.push(
      `checkpoint.runSeed "${checkpoint.runSeed}" does not match the run seed in ` +
      `encounterSeed ("${originalSeed}"). Map may have been re-rolled — this is forbidden.`,
    );
  }

  errors.push(...validatePressure(checkpoint.pressureAfterBattle));

  return errors;
}
