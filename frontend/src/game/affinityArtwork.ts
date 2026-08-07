/**
 * affinityArtwork.ts
 *
 * Maps ElementSystem values → their painted affinity medallion PNG.
 * Elements that don't yet have custom medallions fall back to the
 * River medallion (same coin language, wrong scene — acceptable until
 * a dedicated generation pass covers all 10 elements).
 *
 * Usage:
 *   import { getAffinityMedallion, TREASURE_CHEST } from "@/src/game/affinityArtwork";
 *   <Image source={getAffinityMedallion(hero.element)} ... />
 */
import type { ElementSystem } from "@/src/game/types";

const RIVER  = require("../../assets/ui-icons/hub/affinity-river.png");
const AIR    = require("../../assets/ui-icons/hub/affinity-air.png");
const FIRE   = require("../../assets/ui-icons/hub/affinity-fire.png");
const MIND   = require("../../assets/ui-icons/hub/affinity-mind.png");

/** Painted medallion for each element.  Falls back to River for ungened elements. */
const MEDALLION_MAP: Partial<Record<ElementSystem, ReturnType<typeof require>>> = {
  River:      RIVER,
  Air:        AIR,
  Fire:       FIRE,
  Mind:       MIND,
  // Energy / Storm / Filter / Forge / Protection / Growth → fallback below
};

export function getAffinityMedallion(element: ElementSystem) {
  return MEDALLION_MAP[element] ?? RIVER;
}

/** Painted treasure chest used as the next-reward icon. */
export const TREASURE_CHEST = require("../../assets/ui-icons/hub/treasure-chest.png");
