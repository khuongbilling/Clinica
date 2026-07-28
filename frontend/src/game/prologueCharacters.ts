/**
 * prologueCharacters.ts — single source of truth for all prologue character art.
 *
 * Every dialogue scene, battle tutorial, and scripted battle should pull character
 * images exclusively from this resolver — never from raw hardcoded paths.
 *
 * Fallback rule: if a portrait is missing, use the silhouette fallback that
 * matches the character's palette. Do NOT use unrelated art.
 */

export interface PrologueCharacter {
  id:           string;
  name:         string;
  color:        string;
  barColor:     string;
  largePortrait: any;
  avatar48:      any;
  battleSprite:  any;
  palette:       string;
  role:          string;
  temporary:     boolean;
}

const PRODIGY_PORTRAIT       = require("../../assets/images/the_prodigy_portrait.png");
const MASTER_BAI_ART         = require("../../assets/images/master_bai_vn.png");
const NIGHTINGALE_LARGE      = require("../../assets/images/nightingale_vn_extended.png");
const NIGHTINGALE_BUST       = require("../../assets/images/nightingale_vn_bust.png");
const FLEMING_LARGE          = require("../../assets/images/fleming_vn.png");
const FLEMING_BUST           = require("../../assets/images/fleming_vn_bust.png");

const NIGHTINGALE_BATTLE = require("../../assets/images/nightingale_battle_sprite.png");
const FLEMING_BATTLE     = require("../../assets/images/fleming_battle_sprite.png");
const MASTER_BAI_BATTLE  = require("../../assets/images/master_bai_vn.png");
const PRODIGY_BATTLE     = require("../../assets/images/prodigy_battle_sprite.png");

// Scene backgrounds used across prologue cinematic and dialogue scenes
const WARD_CORRIDOR_BG   = require("../../assets/images/ward_corridor_battle.png");
const TACTICAL_BG        = require("../../assets/images/tactical_battlefield.png");
const SI_NOBG            = require("../../assets/images/silent_infarction_nobg.png");
const PRODIGY_CANONICAL  = require("../../assets/images/prodigy_vn_canonical.png");

// Opening Memory Cinematic art panels (8 beats)
const OPENING_ORIGIN      = require("../../assets/images/opening_prodigy_origin.png");
const OPENING_FAME        = require("../../assets/images/opening_prodigy_fame.png");
const OPENING_VICTORY     = require("../../assets/images/opening_prodigy_victory.png");
const OPENING_CAUTION     = require("../../assets/images/opening_prodigy_caution.png");
const OPENING_INFALLIBLE  = require("../../assets/images/opening_prodigy_infallible.png");
const OPENING_OBSERVATION = require("../../assets/images/opening_prodigy_observation.png");
const OPENING_JUDGMENT    = require("../../assets/images/opening_prodigy_judgment.png");
const OPENING_WARNING     = require("../../assets/images/opening_prodigy_warning.png");

/** All prologue art — included in the preloader so opening scenes never wait on a cold fetch. */
export const PROLOGUE_IMAGE_MODULES: readonly number[] = [
  // Character VN art + battle sprites
  PRODIGY_PORTRAIT,
  MASTER_BAI_ART,
  NIGHTINGALE_LARGE,
  NIGHTINGALE_BUST,
  FLEMING_LARGE,
  FLEMING_BUST,
  NIGHTINGALE_BATTLE,
  FLEMING_BATTLE,
  MASTER_BAI_BATTLE,
  PRODIGY_BATTLE,
  PRODIGY_CANONICAL,
  // Scene backgrounds
  WARD_CORRIDOR_BG,
  TACTICAL_BG,
  SI_NOBG,
  // Opening Memory Cinematic panels
  OPENING_ORIGIN,
  OPENING_FAME,
  OPENING_VICTORY,
  OPENING_CAUTION,
  OPENING_INFALLIBLE,
  OPENING_OBSERVATION,
  OPENING_JUDGMENT,
  OPENING_WARNING,
];

export const PROLOGUE_CHARACTERS = {
  PRODIGY: {
    id:            "prodigy_former_self",
    name:          "The Prodigy",
    color:         "#E8354A",
    barColor:      "rgba(28,5,8,0.93)",
    largePortrait: PRODIGY_PORTRAIT,
    avatar48:      PRODIGY_PORTRAIT,
    battleSprite:  PRODIGY_BATTLE,
    palette:       "white, gold, jade, crimson",
    role:          "Legendary Clinician Prodigy — Pre-Recall",
    temporary:     true,
  } satisfies PrologueCharacter,

  MASTER_BAI: {
    id:            "master_bai",
    name:          "Master Bai",
    color:         "#D9A441",
    barColor:      "rgba(30,20,5,0.93)",
    largePortrait: MASTER_BAI_ART,
    avatar48:      MASTER_BAI_ART,
    battleSprite:  MASTER_BAI_BATTLE,
    palette:       "jade, white, gold",
    role:          "Mentor — Legendary Physician Scholar",
    temporary:     false,
  } satisfies PrologueCharacter,

  NIGHTINGALE: {
    id:            "nightingale_legendary_temp",
    name:          "Florence Nightingale",
    color:         "#4FD8C4",
    barColor:      "rgba(5,22,20,0.93)",
    largePortrait: NIGHTINGALE_LARGE,
    avatar48:      NIGHTINGALE_BUST,
    battleSprite:  NIGHTINGALE_BATTLE,
    palette:       "gold, ivory, jade",
    role:          "Legendary Healer — Temporary Prologue Ally",
    temporary:     true,
  } satisfies PrologueCharacter,

  FLEMING: {
    id:            "fleming_legendary_temp",
    name:          "Alexander Fleming",
    color:         "#78B8F0",
    barColor:      "rgba(5,15,28,0.93)",
    largePortrait: FLEMING_LARGE,
    avatar48:      FLEMING_BUST,
    battleSprite:  FLEMING_BATTLE,
    palette:       "blue, teal, silver",
    role:          "Legendary Scholar — Temporary Prologue Ally",
    temporary:     true,
  } satisfies PrologueCharacter,
} as const;

export type PrologueSpeakerId = keyof typeof PROLOGUE_CHARACTERS;
