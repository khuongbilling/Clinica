/**
 * game/chapterLoadout.ts — Push 10: Ward Event rewards → chapter combat loadout.
 *
 * Defines the enriched, battle-facing representations of all four chapter-scoped
 * resource classes that Ward Event tiles grant during a fog-map run.  The
 * JourneyRun (persistence layer) stores only minimal IDs; this module carries
 * the full effect data used by the battle engine.
 *
 * Four resource classes
 * ─────────────────────
 *   CallTeamMember  — Support NPC found on map; persists for the chapter attempt.
 *                     Capacity 2 (designed to upgrade to 3 later).
 *   ProtocolCard    — One-use battle resource; hand limit 5.
 *   WardBlessing    — Passive bonus; 1 Major slot + 2 Minor slots.
 *   WardHazard      — Penalty that applies map or battle disadvantages (uncapped).
 *
 * Capacity-full choices (Call Team and Blessings)
 * ─────────────────────────────────────────────────
 *   replace   — swap an existing member/slot for the new one.
 *   upgrade   — merge a duplicate (same role / same tier) for a stronger version.
 *   convert   — discard the incoming reward for an immediate Favor currency gain.
 *
 * Chapter-end rule
 * ─────────────────
 *   ALL chapter-limited resources (call team, cards, blessings, hazards) disappear
 *   when the chapter attempt ends.  Use clearChapterLoadout() to enforce this.
 *
 * Ward Event tile generation is UNCAPPED — the fog map may produce any number of
 *   ward_event tiles; the resource slots are the player-side constraint.
 *
 * This module is pure domain logic — no React, no BattleState writes.
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Starting Call Team capacity.  Designed to upgrade to MAX_CALL_TEAM_CAPACITY. */
export const INITIAL_CALL_TEAM_CAPACITY = 2;

/** Maximum Call Team capacity after upgrades. */
export const MAX_CALL_TEAM_CAPACITY = 3;

/** Maximum Protocol Cards in hand. */
export const CARD_HAND_LIMIT = 5;

/** Number of Major Blessing slots. */
export const MAJOR_BLESSING_SLOTS = 1;

/** Number of Minor Blessing slots. */
export const MINOR_BLESSING_SLOTS = 2;

/** Favor gained when converting a Call Team member (over capacity). */
export const CONVERT_CALL_TEAM_FAVOR = 15;

/** Favor gained when converting a Blessing (slot full). */
export const CONVERT_BLESSING_FAVOR = 10;

/** Favor gained when converting a Protocol Card (hand full). */
export const CONVERT_CARD_FAVOR = 5;

// ── Call Team ─────────────────────────────────────────────────────────────────

/**
 * Role of a Support NPC on the Call Team.
 * Drives the kind of bonus they provide in battle.
 */
export type CallTeamRole =
  | 'doctor'         // stability restore or corruption reduction
  | 'specialist'     // threat-specific expertise bonus
  | 'consultant'     // AP bonus or card draw
  | 'charge_nurse'   // team readiness and coordination
  | 'pharmacist'     // protocol card effectiveness
  | 'supervisor';    // pressure reduction / hazard mitigation

/** What the Support NPC contributes to the battle. */
export type CallTeamBonusKind =
  | 'stability_restore'   // restores N stability at start of each turn
  | 'ap_bonus'            // +N AP in round 1 (stacks with First Response)
  | 'corruption_reduce'   // reduces active threat corruption by N per turn
  | 'shield'              // grants N shield before the enemy turn
  | 'intent_reveal'       // reveals hidden threat intents each round
  | 'readiness_bonus'     // adds N to TeamReadinessInput.supportBonus
  | 'hazard_reduce';      // reduces the magnitude of one active WardHazard penalty

export interface CallTeamBonus {
  readonly kind:      CallTeamBonusKind;
  readonly magnitude: number;
}

/** A Support NPC collected from a 'support_ally' Ward Event tile. */
export interface CallTeamMember {
  /** Unique id (e.g. "npc:charge_nurse:tile_3_2"). */
  readonly id:    string;
  readonly name:  string;
  readonly role:  CallTeamRole;
  readonly bonus: CallTeamBonus;
  /**
   * True when two members of the same role have been combined via 'upgrade'.
   * An upgraded member has a higher bonus.magnitude than the base.
   */
  readonly upgraded: boolean;
}

// ── Protocol Cards ────────────────────────────────────────────────────────────

/** What a Protocol Card does when played. */
export type CardEffectKind =
  | 'stabilize'        // restore N stability immediately
  | 'strike_all'       // reduce all active threat corruptions by N
  | 'shield'           // grant N shield for this turn
  | 'reveal_threats'   // reveal all hidden/latent threats immediately
  | 'readiness_boost'  // add N to team readiness for the opening calculation
  | 'ap_refund'        // return N spent AP immediately
  | 'corruption_cap';  // cap corruption gain this turn to N

export interface CardEffect {
  readonly kind:      CardEffectKind;
  readonly magnitude: number;
}

/**
 * A Protocol Card collected from a 'protocol_card' Ward Event tile.
 * One-use: mark as used when played; remove from hand at chapter end.
 */
export interface ProtocolCard {
  /** Unique id (e.g. "card:stabilize:tile_5_1"). */
  readonly id:         string;
  readonly name:       string;
  readonly effect:     CardEffect;
  /** Which tile sourced this card (for display / dedup). */
  readonly sourceTileId: string;
  /** Whether this card has been played.  One-use: true = spent. */
  used:                boolean;
}

// ── Ward Blessings ────────────────────────────────────────────────────────────

/**
 * Tier determines which slot the blessing occupies.
 *  major — 1 slot; stronger passive effect.
 *  minor — 2 slots; weaker individual effect.
 */
export type BlessingTier = 'major' | 'minor';

/** When the blessing effect triggers. */
export type BlessingTrigger =
  | 'passive'        // always active
  | 'on_round_start' // applies at the start of each player turn
  | 'on_resolve'     // triggers when a threat is resolved
  | 'on_damage';     // triggers when the team takes stability damage

export type BlessingEffectKind =
  | 'stability_floor'    // stability cannot drop below N this chapter
  | 'opening_readiness'  // adds N to TeamReadinessInput.blessingBonus
  | 'corruption_cap'     // caps the corruption gain a single threat deals per round
  | 'threat_weaken'      // weakens all threats on entry (−N corruptionCurrent)
  | 'ap_per_round'       // passive +N AP each round
  | 'intent_clarity';    // improves intent visibility (partial→full or hidden→partial)

export interface BlessingEffect {
  readonly kind:      BlessingEffectKind;
  readonly magnitude: number;
  readonly trigger:   BlessingTrigger;
}

/** A Ward Blessing active during this chapter attempt. */
export interface WardBlessing {
  /** Unique id (e.g. "blessing:major:stability_floor:tile_2_4"). */
  readonly id:           string;
  readonly name:         string;
  readonly tier:         BlessingTier;
  readonly effect:       BlessingEffect;
  readonly sourceTileId: string;
}

// ── Ward Hazards ──────────────────────────────────────────────────────────────

/**
 * Where the hazard's penalty applies.
 *  map    — affects fog-map navigation (movement, visibility).
 *  battle — affects the battle engine directly.
 *  both   — applies in both contexts.
 */
export type HazardScope = 'map' | 'battle' | 'both';

export type HazardPenaltyKind =
  | 'readiness_reduce'    // reduces TeamReadinessInput.pressurePenalty (increases penalty)
  | 'stability_drain'     // extra stability loss per enemy turn
  | 'corruption_boost'    // increases threat corruption by N per round
  | 'ap_reduce'           // reduces available AP by N
  | 'card_limit_reduce'   // reduces effective hand limit by N
  | 'intent_obscure';     // degrades intent visibility for one threat per round

export interface HazardPenalty {
  readonly kind:      HazardPenaltyKind;
  readonly magnitude: number;
}

/** A Ward Hazard applying map or battle penalties for the chapter attempt. */
export interface WardHazard {
  /** Unique id (e.g. "hazard:stability_drain:tile_4_0"). */
  readonly id:           string;
  readonly name:         string;
  readonly scope:        HazardScope;
  readonly penalty:      HazardPenalty;
  readonly sourceTileId: string;
}

// ── Over-capacity choices ─────────────────────────────────────────────────────

/**
 * When a resource slot is full the player chooses one of three actions.
 *  replace  — discard an existing member (by index) and take the new one.
 *  upgrade  — merge a duplicate (same role/tier) for a stronger version.
 *  convert  — discard the incoming reward for an immediate Favor gain.
 */
export type OverCapacityAction = 'replace' | 'upgrade' | 'convert';

/**
 * Outcome of a convert action: how much Favor the player receives.
 */
export interface ConvertResult {
  readonly favorGained: number;
}

// ── ChapterLoadout ────────────────────────────────────────────────────────────

/**
 * All chapter-limited resources the player carries into each battle.
 *
 * Lifecycle: created (or hydrated) at the start of a chapter attempt;
 * wiped by clearChapterLoadout() when the attempt ends.
 */
export interface ChapterLoadout {
  // ── Call Team ──────────────────────────────────────────────────────────────

  /** Active Support NPCs.  Length ≤ callTeamCapacity. */
  readonly callTeam:         readonly CallTeamMember[];
  /**
   * Current maximum Call Team size.  Starts at INITIAL_CALL_TEAM_CAPACITY (2).
   * May be upgraded toward MAX_CALL_TEAM_CAPACITY (3) by specific events.
   */
  readonly callTeamCapacity: number;

  // ── Protocol Cards ─────────────────────────────────────────────────────────

  /** Cards in hand (used + unplayed).  Length ≤ cardHandLimit. */
  readonly cards:            readonly ProtocolCard[];
  /** Current hand limit.  Starts at CARD_HAND_LIMIT (5); hazards may reduce it. */
  readonly cardHandLimit:    number;

  // ── Ward Blessings ─────────────────────────────────────────────────────────

  /** The single Major Blessing slot.  null if empty. */
  readonly majorBlessing:    WardBlessing | null;
  /**
   * The two Minor Blessing slots.  Each element is a blessing or null.
   * Length is always exactly MINOR_BLESSING_SLOTS (2).
   */
  readonly minorBlessings:   readonly (WardBlessing | null)[];

  // ── Ward Hazards ───────────────────────────────────────────────────────────

  /**
   * Active hazards.  No capacity cap — Ward Event tiles may generate as many
   * hazard tiles as the chapter map calls for.
   */
  readonly hazards:          readonly WardHazard[];
}

// ── Factory ───────────────────────────────────────────────────────────────────

/** Create a fully empty ChapterLoadout at the start of a new chapter attempt. */
export function createEmptyLoadout(): ChapterLoadout {
  return {
    callTeam:         [],
    callTeamCapacity: INITIAL_CALL_TEAM_CAPACITY,
    cards:            [],
    cardHandLimit:    CARD_HAND_LIMIT,
    majorBlessing:    null,
    minorBlessings:   [null, null],
    hazards:          [],
  };
}

// ── Call Team helpers ─────────────────────────────────────────────────────────

/** True when the Call Team has room for another member. */
export function isCallTeamFull(loadout: ChapterLoadout): boolean {
  return loadout.callTeam.length >= loadout.callTeamCapacity;
}

/**
 * True when the incoming member is a duplicate of an existing one.
 * Duplicates share the same role — eligible for the 'upgrade' choice.
 */
export function isCallTeamDuplicate(
  loadout:  ChapterLoadout,
  incoming: CallTeamMember,
): boolean {
  return loadout.callTeam.some(m => m.role === incoming.role);
}

/** Index of the first duplicate member by role, or -1 if none. */
export function findCallTeamDuplicateIndex(
  loadout:  ChapterLoadout,
  incoming: CallTeamMember,
): number {
  return loadout.callTeam.findIndex(m => m.role === incoming.role);
}

/**
 * Add a Call Team member when the team is NOT full.
 * Throws if the team is already at capacity — check isCallTeamFull() first.
 */
export function addCallTeamMember(
  loadout: ChapterLoadout,
  member:  CallTeamMember,
): ChapterLoadout {
  if (isCallTeamFull(loadout)) {
    throw new Error(
      `addCallTeamMember: team is at capacity (${loadout.callTeam.length}/${loadout.callTeamCapacity}). Use replaceCallTeamMember, upgradeCallTeamMember, or convertCallTeamMember.`,
    );
  }
  return { ...loadout, callTeam: [...loadout.callTeam, member] };
}

/**
 * Replace the Call Team member at `index` with `member`.
 * The previous member is discarded.
 */
export function replaceCallTeamMember(
  loadout: ChapterLoadout,
  index:   number,
  member:  CallTeamMember,
): ChapterLoadout {
  if (index < 0 || index >= loadout.callTeam.length) {
    throw new Error(`replaceCallTeamMember: index ${index} out of bounds.`);
  }
  const next = [...loadout.callTeam];
  next[index] = member;
  return { ...loadout, callTeam: next };
}

/**
 * Upgrade the Call Team member at `index` by merging it with the incoming
 * `member` (same role).  The resulting member has the incoming member's data
 * but is marked `upgraded: true`.  The caller is responsible for pre-computing
 * the upgraded bonus magnitude.
 */
export function upgradeCallTeamMember(
  loadout:  ChapterLoadout,
  index:    number,
  upgraded: CallTeamMember,
): ChapterLoadout {
  if (index < 0 || index >= loadout.callTeam.length) {
    throw new Error(`upgradeCallTeamMember: index ${index} out of bounds.`);
  }
  const next = [...loadout.callTeam];
  next[index] = { ...upgraded, upgraded: true };
  return { ...loadout, callTeam: next };
}

/**
 * Convert an over-capacity incoming Call Team member to immediate Favor.
 * The loadout is unchanged; the caller credits the player with the Favor.
 */
export function convertCallTeamMember(
  loadout: ChapterLoadout,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _member: CallTeamMember,
): { loadout: ChapterLoadout; convert: ConvertResult } {
  return { loadout, convert: { favorGained: CONVERT_CALL_TEAM_FAVOR } };
}

/**
 * Upgrade the Call Team capacity by 1 (toward MAX_CALL_TEAM_CAPACITY).
 * Has no effect if already at max.
 */
export function upgradeCallTeamCapacity(loadout: ChapterLoadout): ChapterLoadout {
  return {
    ...loadout,
    callTeamCapacity: Math.min(loadout.callTeamCapacity + 1, MAX_CALL_TEAM_CAPACITY),
  };
}

// ── Protocol Card helpers ─────────────────────────────────────────────────────

/** True when the hand has room for another card. */
export function canDrawCard(loadout: ChapterLoadout): boolean {
  return loadout.cards.length < loadout.cardHandLimit;
}

/** True when the hand is at the limit. */
export function isHandFull(loadout: ChapterLoadout): boolean {
  return loadout.cards.length >= loadout.cardHandLimit;
}

/**
 * Add a card to the hand when there is room.
 * Throws if the hand is full — check canDrawCard() first.
 */
export function addCard(
  loadout: ChapterLoadout,
  card:    ProtocolCard,
): ChapterLoadout {
  if (isHandFull(loadout)) {
    throw new Error(
      `addCard: hand is full (${loadout.cards.length}/${loadout.cardHandLimit}). Use replaceCard or convertCard.`,
    );
  }
  return { ...loadout, cards: [...loadout.cards, card] };
}

/**
 * Mark a card as used (one-use: played in battle).
 * Does not remove it from the hand — used cards remain visible until chapter end.
 */
export function useCard(
  loadout: ChapterLoadout,
  cardId:  string,
): ChapterLoadout {
  const cards = loadout.cards.map(c =>
    c.id === cardId ? { ...c, used: true } : c,
  );
  return { ...loadout, cards };
}

/**
 * Replace the card at `index` with a new `card`.
 * Used when the hand is full and the player chooses 'replace'.
 */
export function replaceCard(
  loadout: ChapterLoadout,
  index:   number,
  card:    ProtocolCard,
): ChapterLoadout {
  if (index < 0 || index >= loadout.cards.length) {
    throw new Error(`replaceCard: index ${index} out of bounds.`);
  }
  const next = [...loadout.cards];
  next[index] = card;
  return { ...loadout, cards: next };
}

/**
 * Convert an over-limit card to immediate Favor.
 * Loadout unchanged; caller credits the Favor.
 */
export function convertCard(
  loadout: ChapterLoadout,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _card:   ProtocolCard,
): { loadout: ChapterLoadout; convert: ConvertResult } {
  return { loadout, convert: { favorGained: CONVERT_CARD_FAVOR } };
}

// ── Ward Blessing helpers ─────────────────────────────────────────────────────

/** True if the Major Blessing slot is occupied. */
export function isMajorBlessingFull(loadout: ChapterLoadout): boolean {
  return loadout.majorBlessing !== null;
}

/** Number of occupied Minor Blessing slots. */
export function minorBlessingCount(loadout: ChapterLoadout): number {
  return loadout.minorBlessings.filter(b => b !== null).length;
}

/** True if all Minor Blessing slots are occupied. */
export function isMinorBlessingFull(loadout: ChapterLoadout): boolean {
  return minorBlessingCount(loadout) >= MINOR_BLESSING_SLOTS;
}

/**
 * True if the incoming blessing's tier slot is already full.
 * major → isMajorBlessingFull, minor → isMinorBlessingFull.
 */
export function isBlessingSlotFull(
  loadout:  ChapterLoadout,
  tier:     BlessingTier,
): boolean {
  return tier === 'major'
    ? isMajorBlessingFull(loadout)
    : isMinorBlessingFull(loadout);
}

/**
 * Set the Major Blessing slot.  Replaces any existing blessing.
 */
export function setMajorBlessing(
  loadout:  ChapterLoadout,
  blessing: WardBlessing,
): ChapterLoadout {
  return { ...loadout, majorBlessing: blessing };
}

/** Clear the Major Blessing slot. */
export function clearMajorBlessing(loadout: ChapterLoadout): ChapterLoadout {
  return { ...loadout, majorBlessing: null };
}

/**
 * Set a Minor Blessing slot at `slotIndex` (0 or 1).
 * Replaces any existing blessing in that slot.
 */
export function setMinorBlessing(
  loadout:   ChapterLoadout,
  slotIndex: number,
  blessing:  WardBlessing,
): ChapterLoadout {
  if (slotIndex < 0 || slotIndex >= MINOR_BLESSING_SLOTS) {
    throw new Error(`setMinorBlessing: slotIndex ${slotIndex} out of [0, ${MINOR_BLESSING_SLOTS - 1}].`);
  }
  const next = [...loadout.minorBlessings] as (WardBlessing | null)[];
  next[slotIndex] = blessing;
  return { ...loadout, minorBlessings: next };
}

/** Clear one Minor Blessing slot by index. */
export function clearMinorBlessing(
  loadout:   ChapterLoadout,
  slotIndex: number,
): ChapterLoadout {
  if (slotIndex < 0 || slotIndex >= MINOR_BLESSING_SLOTS) {
    throw new Error(`clearMinorBlessing: slotIndex ${slotIndex} out of range.`);
  }
  const next = [...loadout.minorBlessings] as (WardBlessing | null)[];
  next[slotIndex] = null;
  return { ...loadout, minorBlessings: next };
}

/**
 * Add a blessing to the first available slot for its tier.
 * Throws if all slots for that tier are full — check isBlessingSlotFull() first.
 */
export function addBlessing(
  loadout:  ChapterLoadout,
  blessing: WardBlessing,
): ChapterLoadout {
  if (blessing.tier === 'major') {
    if (isMajorBlessingFull(loadout)) {
      throw new Error('addBlessing: major slot is full. Use setMajorBlessing to replace, or convertBlessing.');
    }
    return setMajorBlessing(loadout, blessing);
  }
  // minor
  const emptyIdx = loadout.minorBlessings.findIndex(b => b === null);
  if (emptyIdx === -1) {
    throw new Error('addBlessing: all minor slots are full. Use setMinorBlessing to replace, or convertBlessing.');
  }
  return setMinorBlessing(loadout, emptyIdx, blessing);
}

/**
 * Convert an over-capacity blessing to immediate Favor.
 * Loadout unchanged; caller credits the Favor.
 */
export function convertBlessing(
  loadout:   ChapterLoadout,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _blessing: WardBlessing,
): { loadout: ChapterLoadout; convert: ConvertResult } {
  return { loadout, convert: { favorGained: CONVERT_BLESSING_FAVOR } };
}

// ── Ward Hazard helpers ───────────────────────────────────────────────────────

/**
 * Add a Ward Hazard to the loadout.  No capacity cap — uncapped by design.
 * Multiple hazards stack their penalties.
 */
export function addHazard(
  loadout: ChapterLoadout,
  hazard:  WardHazard,
): ChapterLoadout {
  return { ...loadout, hazards: [...loadout.hazards, hazard] };
}

/**
 * Remove a Ward Hazard by id (e.g. after a player action resolves it).
 * No-op if the hazard id is not found.
 */
export function removeHazard(
  loadout:  ChapterLoadout,
  hazardId: string,
): ChapterLoadout {
  return { ...loadout, hazards: loadout.hazards.filter(h => h.id !== hazardId) };
}

// ── Chapter-end cleanup ───────────────────────────────────────────────────────

/**
 * Wipe all chapter-limited resources when the chapter attempt ends
 * (success, failure, or abandon).
 *
 * Resets to the same state as createEmptyLoadout() but preserves
 * callTeamCapacity upgrades (they survive chapter ends, not run ends).
 */
export function clearChapterLoadout(loadout: ChapterLoadout): ChapterLoadout {
  return {
    ...createEmptyLoadout(),
    callTeamCapacity: loadout.callTeamCapacity, // capacity upgrade persists
  };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** All Protocol Cards that have NOT yet been used. */
export function availableCards(loadout: ChapterLoadout): readonly ProtocolCard[] {
  return loadout.cards.filter(c => !c.used);
}

/** All Protocol Cards that have been played this chapter. */
export function usedCards(loadout: ChapterLoadout): readonly ProtocolCard[] {
  return loadout.cards.filter(c => c.used);
}

/** All active Blessings (major + minor, non-null). */
export function activeBlessings(loadout: ChapterLoadout): readonly WardBlessing[] {
  const minors = loadout.minorBlessings.filter((b): b is WardBlessing => b !== null);
  return loadout.majorBlessing
    ? [loadout.majorBlessing, ...minors]
    : minors;
}

/** All battle-scope hazards (scope 'battle' or 'both'). */
export function battleHazards(loadout: ChapterLoadout): readonly WardHazard[] {
  return loadout.hazards.filter(h => h.scope === 'battle' || h.scope === 'both');
}

/** All map-scope hazards (scope 'map' or 'both'). */
export function mapHazards(loadout: ChapterLoadout): readonly WardHazard[] {
  return loadout.hazards.filter(h => h.scope === 'map' || h.scope === 'both');
}

/**
 * Sum of all pressure penalties contributed by active battle hazards.
 * Feeds directly into TeamReadinessInput.pressurePenalty.
 */
export function totalPressurePenalty(loadout: ChapterLoadout): number {
  return battleHazards(loadout)
    .filter(h => h.penalty.kind === 'readiness_reduce')
    .reduce((sum, h) => sum + h.penalty.magnitude, 0);
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate a ChapterLoadout.  Returns an array of error strings.
 * An empty array means the loadout is consistent.
 *
 * Checks:
 *  • callTeam.length ≤ callTeamCapacity.
 *  • callTeamCapacity in [INITIAL, MAX].
 *  • No duplicate Call Team ids.
 *  • cards.length ≤ cardHandLimit.
 *  • cardHandLimit ≤ CARD_HAND_LIMIT (hazards may reduce but not raise it).
 *  • No duplicate Card ids.
 *  • majorBlessing.tier === 'major' if set.
 *  • minorBlessings has exactly MINOR_BLESSING_SLOTS entries.
 *  • Each non-null minor blessing has tier === 'minor'.
 *  • No duplicate Blessing ids across all slots.
 *  • No duplicate Hazard ids.
 */
export function validateChapterLoadout(loadout: ChapterLoadout): readonly string[] {
  const errors: string[] = [];
  const { callTeam, callTeamCapacity, cards, cardHandLimit,
          majorBlessing, minorBlessings, hazards } = loadout;

  // Call Team
  if (callTeam.length > callTeamCapacity) {
    errors.push(`callTeam.length (${callTeam.length}) exceeds callTeamCapacity (${callTeamCapacity}).`);
  }
  if (callTeamCapacity < INITIAL_CALL_TEAM_CAPACITY || callTeamCapacity > MAX_CALL_TEAM_CAPACITY) {
    errors.push(`callTeamCapacity ${callTeamCapacity} must be in [${INITIAL_CALL_TEAM_CAPACITY}, ${MAX_CALL_TEAM_CAPACITY}].`);
  }
  {
    const ids = new Set<string>();
    for (const m of callTeam) {
      if (ids.has(m.id)) errors.push(`Duplicate Call Team member id "${m.id}".`);
      ids.add(m.id);
    }
  }

  // Cards
  if (cards.length > cardHandLimit) {
    errors.push(`cards.length (${cards.length}) exceeds cardHandLimit (${cardHandLimit}).`);
  }
  if (cardHandLimit > CARD_HAND_LIMIT) {
    errors.push(`cardHandLimit (${cardHandLimit}) exceeds CARD_HAND_LIMIT (${CARD_HAND_LIMIT}).`);
  }
  {
    const ids = new Set<string>();
    for (const c of cards) {
      if (ids.has(c.id)) errors.push(`Duplicate ProtocolCard id "${c.id}".`);
      ids.add(c.id);
    }
  }

  // Blessings
  if (majorBlessing && majorBlessing.tier !== 'major') {
    errors.push(`majorBlessing tier must be 'major', got '${majorBlessing.tier}'.`);
  }
  if (minorBlessings.length !== MINOR_BLESSING_SLOTS) {
    errors.push(`minorBlessings must have exactly ${MINOR_BLESSING_SLOTS} entries, got ${minorBlessings.length}.`);
  }
  for (const b of minorBlessings) {
    if (b && b.tier !== 'minor') {
      errors.push(`Minor blessing slot contains blessing with tier '${b.tier}' — must be 'minor'.`);
    }
  }
  {
    const ids = new Set<string>();
    if (majorBlessing) {
      ids.add(majorBlessing.id);
    }
    for (const b of minorBlessings) {
      if (!b) continue;
      if (ids.has(b.id)) errors.push(`Duplicate Blessing id "${b.id}".`);
      ids.add(b.id);
    }
  }

  // Hazards
  {
    const ids = new Set<string>();
    for (const h of hazards) {
      if (ids.has(h.id)) errors.push(`Duplicate WardHazard id "${h.id}".`);
      ids.add(h.id);
    }
  }

  return errors;
}
