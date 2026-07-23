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

const PRODIGY_LARGE          = require("../../assets/images/prodigy_vn_canonical.png");
const MASTER_BAI_TORSO       = require("../../assets/images/master_bai_vn_torso.png");
const MASTER_BAI_BUST        = require("../../assets/images/master_bai_vn_bust.png");
const NIGHTINGALE_LARGE      = require("../../assets/images/nightingale_vn.png");
const NIGHTINGALE_BUST       = require("../../assets/images/nightingale_vn_bust.png");
const FLEMING_LARGE          = require("../../assets/images/fleming_vn.png");
const FLEMING_BUST           = require("../../assets/images/fleming_vn_bust.png");

const NIGHTINGALE_BATTLE = require("../../assets/heroes/battle/prologue_nightingale.png");
const FLEMING_BATTLE     = require("../../assets/heroes/battle/prologue_fleming.png");
const MASTER_BAI_BATTLE  = require("../../assets/images/master_bai_vn.png");
const PRODIGY_BATTLE     = require("../../assets/heroes/battle/the_prodigy.png");

export const PROLOGUE_CHARACTERS = {
  PRODIGY: {
    id:            "prodigy_former_self",
    name:          "The Prodigy",
    color:         "#E8354A",
    barColor:      "rgba(28,5,8,0.93)",
    largePortrait: PRODIGY_LARGE,
    avatar48:      PRODIGY_LARGE,
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
    largePortrait: MASTER_BAI_TORSO,
    avatar48:      MASTER_BAI_BUST,
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
