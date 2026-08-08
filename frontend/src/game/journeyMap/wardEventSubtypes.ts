/**
 * wardEventSubtypes.ts — Push 3: deterministic shift-based Ward Event engine.
 *
 * Each wardEvent tile is assigned a WardEventSubtype at map-generation time,
 * using a weighted categorical roll seeded from the chapter run's PRNG stream.
 *
 * Subtype tables are shift-specific (Day / Evening / Night).  Weights are
 * integer percentages that sum to exactly 100 per shift.
 *
 * The "interaction" column varies by shift to reflect realistic ward activity:
 *   Day     → Patient / Family / Team interaction
 *   Evening → Handoff / Patient interaction
 *   Night   → Surveillance / Patient monitoring
 *
 * All other five categories appear in every shift at different weights.
 *
 * Persistence contract
 * ────────────────────
 * The subtype is determined once during run creation and stored on the
 * JourneyTile.wardEventSubtype field.  Revisiting a tile MUST NOT reroll;
 * always read the persisted subtype from the saved tile.
 *
 * Dependency:  imports TimeOfDay from canonicalConfig (data-only, no React/UI).
 */

import type { TimeOfDay } from './canonicalConfig';
import type { WardEventSubtype } from './types';

// ── Subtype tables ─────────────────────────────────────────────────────────────

/** One entry: [subtype, weight].  Weights are percentages summing to 100. */
type SubtypeEntry = readonly [WardEventSubtype, number];

/**
 * Canonical weighted tables, one per TimeOfDay.
 *
 *  Day
 *  ───
 *  Support Ally          30 %   — an ally NPC appears and offers help
 *  Protocol Card         15 %   — a clinical protocol card is available
 *  Ward Blessing         10 %   — passive positive ward effect
 *  Patient/Family/Team   25 %   — daytime interaction event
 *  Resource/Service      15 %   — equipment or service encounter
 *  Ward Hazard            5 %   — an environmental or clinical hazard
 *
 *  Evening
 *  ───────
 *  Support Ally          20 %
 *  Protocol Card         20 %
 *  Ward Blessing         10 %
 *  Handoff/Patient       25 %   — shift-change handoff or patient check
 *  Resource/Service      15 %
 *  Ward Hazard           10 %
 *
 *  Night
 *  ─────
 *  Support Ally          15 %
 *  Protocol Card         20 %
 *  Ward Blessing         20 %   — more common at night (quiet healing)
 *  Surveillance/Patient  20 %   — overnight monitoring event
 *  Resource/Service      10 %
 *  Ward Hazard           15 %   — hazards more common at night
 */
export const WARD_EVENT_TABLE: Record<TimeOfDay, ReadonlyArray<SubtypeEntry>> = {
  day: [
    ['support_ally',         30],
    ['protocol_card',        15],
    ['ward_blessing',        10],
    ['patient_family_team',  25],
    ['resource_service',     15],
    ['ward_hazard',           5],
  ],
  evening: [
    ['support_ally',         20],
    ['protocol_card',        20],
    ['ward_blessing',        10],
    ['handoff_patient',      25],
    ['resource_service',     15],
    ['ward_hazard',          10],
  ],
  night: [
    ['support_ally',         15],
    ['protocol_card',        20],
    ['ward_blessing',        20],
    ['surveillance_patient', 20],
    ['resource_service',     10],
    ['ward_hazard',          15],
  ],
};

// ── Shift-specific subtype sets (for validation / tests) ─────────────────────

/** Subtypes that may appear regardless of shift. */
export const SHARED_SUBTYPES: ReadonlySet<WardEventSubtype> = new Set([
  'support_ally',
  'protocol_card',
  'ward_blessing',
  'resource_service',
  'ward_hazard',
]);

/** Subtype exclusive to the Day table. */
export const DAY_EXCLUSIVE_SUBTYPE: WardEventSubtype   = 'patient_family_team';
/** Subtype exclusive to the Evening table. */
export const EVENING_EXCLUSIVE_SUBTYPE: WardEventSubtype = 'handoff_patient';
/** Subtype exclusive to the Night table. */
export const NIGHT_EXCLUSIVE_SUBTYPE: WardEventSubtype  = 'surveillance_patient';

/** All possible WardEventSubtype values (across all shifts). */
export const ALL_WARD_EVENT_SUBTYPES: ReadonlyArray<WardEventSubtype> = [
  'support_ally',
  'protocol_card',
  'ward_blessing',
  'patient_family_team',
  'handoff_patient',
  'surveillance_patient',
  'resource_service',
  'ward_hazard',
];

// ── Roll function ──────────────────────────────────────────────────────────────

/**
 * Perform one seeded weighted roll over the given shift's subtype table.
 *
 * @param timeOfDay  Active shift — determines which table is used.
 * @param rng        Seeded PRNG thunk (consumed in place; do NOT create a new
 *                   stream here — the caller is responsible for stream identity).
 */
export function rollWardEventSubtype(
  timeOfDay: TimeOfDay,
  rng: () => number,
): WardEventSubtype {
  const table = WARD_EVENT_TABLE[timeOfDay];
  const total = table.reduce((s, [, w]) => s + w, 0);
  let x = rng() * total;
  for (const [subtype, weight] of table) {
    x -= weight;
    if (x <= 0) return subtype;
  }
  // Floating-point rounding safety: return the last entry.
  return table[table.length - 1][0];
}

// ── Validation ─────────────────────────────────────────────────────────────────

/**
 * Verifies every table sums to exactly 100 and has no negative or zero weights.
 * Returns an array of error strings; empty means all tables are valid.
 */
export function validateWardEventTables(): string[] {
  const errors: string[] = [];
  const TIME_OF_DAY_VALUES: TimeOfDay[] = ['day', 'evening', 'night'];
  for (const tod of TIME_OF_DAY_VALUES) {
    const table = WARD_EVENT_TABLE[tod];
    let sum = 0;
    for (const [subtype, weight] of table) {
      if (weight <= 0) {
        errors.push(`${tod}: subtype '${subtype}' has non-positive weight (${weight})`);
      }
      sum += weight;
    }
    if (sum !== 100) {
      errors.push(`${tod}: weights sum to ${sum} (expected 100)`);
    }
  }
  return errors;
}
