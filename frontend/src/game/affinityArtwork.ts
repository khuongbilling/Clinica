/**
 * affinityArtwork.ts
 *
 * Maps ElementSystem values → their painted affinity medallion PNG.
 * All 10 ElementSystem values have explicit entries — no fallback needed.
 *
 * Usage:
 *   import { getAffinityMedallion, TREASURE_CHEST } from "@/src/game/affinityArtwork";
 *   <Image source={getAffinityMedallion(hero.element)} ... />
 */
import type { ImageSourcePropType } from "react-native";
import type { ElementSystem } from "@/src/game/types";

const RIVER      = require("../../assets/ui-icons/hub/affinity-river.png");
const AIR        = require("../../assets/ui-icons/hub/affinity-air.png");
const FIRE       = require("../../assets/ui-icons/hub/affinity-fire.png");
const MIND       = require("../../assets/ui-icons/hub/affinity-mind.png");
const ENERGY     = require("../../assets/ui-icons/hub/affinity-energy.png");
const STORM      = require("../../assets/ui-icons/hub/affinity-storm.png");
const FILTER     = require("../../assets/ui-icons/hub/affinity-filter.png");
const FORGE      = require("../../assets/ui-icons/hub/affinity-forge.png");
const PROTECTION = require("../../assets/ui-icons/hub/affinity-protection.png");
const GROWTH     = require("../../assets/ui-icons/hub/affinity-growth.png");

/** Painted medallion for each element — all 10 ElementSystem values covered. */
const MEDALLION_MAP: Record<ElementSystem, ImageSourcePropType> = {
  River:      RIVER,
  Air:        AIR,
  Fire:       FIRE,
  Mind:       MIND,
  Energy:     ENERGY,
  Storm:      STORM,
  Filter:     FILTER,
  Forge:      FORGE,
  Protection: PROTECTION,
  Growth:     GROWTH,
};

export function getAffinityMedallion(element: ElementSystem): ImageSourcePropType {
  return MEDALLION_MAP[element];
}

/** Painted treasure chest used as the next-reward icon. */
export const TREASURE_CHEST = require("../../assets/ui-icons/hub/treasure-chest.png");
