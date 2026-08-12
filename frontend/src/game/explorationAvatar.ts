/**
 * explorationAvatar.ts — Push 3
 *
 * Progression-aware exploration sprite resolver for the fog-map journey.
 *
 * The resolver answers: "what map sprite does this player show on the
 * fog-map given their current chapter, class, and narrative context?"
 *
 * Resolution priority (highest wins):
 *   1. Class + era variant  — authored when a specific class has a
 *                             dedicated era costume (populated by art pushes).
 *   2. Era default          — the era's generic "student" avatar when no
 *                             class variant exists, or when the player has
 *                             no class yet.
 *   3. Class fallback       — existing getMapSprite() behaviour,
 *                             era-agnostic.  Bridges the gap while era-
 *                             specific class art is still being authored.
 *   4. Universal fallback   — MAP_SPRITE.explorer.
 *
 * ── Adding a new era ────────────────────────────────────────────────────────
 *   1. Add the era string to ExplorationEra.
 *   2. Add its chapter range to chapterToEra().
 *   3. Once the generic era art ships, add an entry to ERA_AVATAR.
 *   4. Once class-specific era art ships, add entries to ERA_CLASS_AVATAR
 *      using the format  canonicalClassName + '_' + era  (see below).
 *
 * ── Adding a class + era override ───────────────────────────────────────────
 *   Use getCanonicalClassKey() to find the canonical key for a class_tree_id,
 *   then add `'${canonicalKey}_${era}': MAP_SPRITE.<key>` to ERA_CLASS_AVATAR.
 *   No other file needs to change.
 */

import { MAP_SPRITE, getMapSprite } from './illustratedAssets';

// ── Era taxonomy ─────────────────────────────────────────────────────────────

/**
 * Narrative era driving the visual theme.
 *
 * Story order:
 *   book_i_university    Ch 1–8   Simulation Era — academy uniform, learning
 *   book_i_field         Ch 9–10  Real Ward Era  — first clinical placement
 *
 * Future (assets not yet authored):
 *   book_ii_professional  Early professional — practical field gear
 *   book_iii_specialist   Specialist — advanced class-specific gear
 *   book_iv_elite         Elite Warden/Prodigy — signature regalia
 */
export type ExplorationEra =
  | 'book_i_university'
  | 'book_i_field'
  | 'book_ii_professional'
  | 'book_iii_specialist'
  | 'book_iv_elite';

/**
 * Map a chapter number to the narrative era that governs its visual theme.
 * Null / undefined chapter defaults to book_i_university (safe minimum).
 */
export function chapterToEra(chapterNumber: number | null | undefined): ExplorationEra {
  if (chapterNumber == null) return 'book_i_university';
  if (chapterNumber <= 8)   return 'book_i_university';
  if (chapterNumber <= 10)  return 'book_i_field';
  // Book II+ — thresholds added when new books ship.
  // Until then fall back to the last authored era safely.
  return 'book_i_university';
}

// ── Era → generic avatar ──────────────────────────────────────────────────────

/**
 * Generic (no-class / no-class-variant) sprite for each era.
 *
 * Only add an entry once the art asset is committed to the repo.
 * book_i_field deliberately mirrors book_i_university until a distinct
 * "first placement" skin ships — this avoids null gaps in the fallback chain.
 */
const ERA_AVATAR: Partial<Record<ExplorationEra, number>> = {
  // Push 2: university-era student clinician chibi.
  book_i_university: MAP_SPRITE.explorer,
  // Placeholder until a dedicated field-placement skin ships.
  book_i_field:      MAP_SPRITE.explorer,

  // Future — uncomment when art lands:
  // book_ii_professional: MAP_SPRITE.explorer_professional,
  // book_iii_specialist:  MAP_SPRITE.explorer_specialist,
  // book_iv_elite:        MAP_SPRITE.explorer_elite,
};

// ── Class + era → class-specific era variant ──────────────────────────────────

/**
 * Class-and-era overrides.  Key = canonicalClassKey + '_' + ExplorationEra.
 *
 * Use getCanonicalClassKey() to derive canonicalClassKey from class_tree_id.
 * Canonical keys match MAP_SPRITE's top-level property names:
 *   'guardian' | 'seer' | 'caretaker' | 'scholar' | 'alchemist' | 'medic'
 *
 * This map is intentionally empty in Push 3.
 * Task #715 (update class sprites to Book I university aesthetic) will
 * populate it once per-class university-era art is committed.
 *
 * Example entry format (uncomment when Task #715 art ships):
 *   'guardian_book_i_university':  MAP_SPRITE.guardian,
 *   'medic_book_i_university':     MAP_SPRITE.medic,
 *   'scholar_book_i_university':   MAP_SPRITE.scholar,
 *   'caretaker_book_i_university': MAP_SPRITE.caretaker,
 *   'alchemist_book_i_university': MAP_SPRITE.alchemist,
 *   'seer_book_i_university':      MAP_SPRITE.seer,
 */
const ERA_CLASS_AVATAR: Record<string, number> = {
  // Populated by art pushes — see Task #715.
};

// ── Input contract ────────────────────────────────────────────────────────────

export interface ExplorationAvatarInput {
  /** Player's class_tree_id.  Undefined / null = pre-class or no class selected. */
  classTreeId?: string | null;
  /** Current chapter number (1-based).  Undefined = loading / unknown. */
  chapterNumber?: number | null;
}

// ── Resolver ──────────────────────────────────────────────────────────────────

/**
 * Return the Metro asset token (require() number) for the player's
 * exploration sprite given their current narrative context.
 *
 * Always returns a valid asset — never null or undefined.
 *
 * Resolution order (see file header for full description):
 *   ① Class + era variant  (most specific)
 *   ② Era default          (generic era avatar)
 *   ③ Class fallback       (era-agnostic getMapSprite)
 *   ④ Universal fallback   (MAP_SPRITE.explorer)
 */
export function getExplorationAvatar(input: ExplorationAvatarInput): number {
  const era = chapterToEra(input.chapterNumber);

  // ① Class + era variant
  if (input.classTreeId) {
    const canonical = getCanonicalClassKey(input.classTreeId);
    if (canonical !== null) {
      const key     = `${canonical}_${era}`;
      const variant = ERA_CLASS_AVATAR[key];
      if (variant != null) return variant;
    }
  }

  // ② Era default
  const eraDefault = ERA_AVATAR[era];
  if (eraDefault != null) return eraDefault;

  // ③ Class fallback — preserves existing behaviour while era art is pending
  if (input.classTreeId) {
    return getMapSprite(input.classTreeId);
  }

  // ④ Universal fallback
  return MAP_SPRITE.explorer;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Derive the canonical MAP_SPRITE key from a class_tree_id.
 *
 * Uses the same keyword matching as getMapSprite() so that any
 * class_tree_id that resolves to a class sprite in the existing system
 * also resolves correctly here.  Returns null when no class matches.
 *
 * Canonical keys: 'guardian' | 'seer' | 'caretaker' | 'scholar' | 'alchemist' | 'medic'
 */
function getCanonicalClassKey(classTreeId: string): string | null {
  const key = classTreeId.toLowerCase();
  if (key.includes('guardian') || key.includes('tank') || key.includes('protec')) return 'guardian';
  if (key.includes('seer')     || key.includes('oracle') || key.includes('vision')) return 'seer';
  if (key.includes('caretaker') || key.includes('nurse') || key.includes('care'))   return 'caretaker';
  if (key.includes('scholar')  || key.includes('academic') || key.includes('learn')) return 'scholar';
  if (key.includes('alchemist') || key.includes('potion') || key.includes('brew'))  return 'alchemist';
  if (key.includes('medic')    || key.includes('field') || key.includes('combat'))  return 'medic';
  return null;
}
