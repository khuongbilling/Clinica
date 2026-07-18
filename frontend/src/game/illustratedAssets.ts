/**
 * illustratedAssets.ts — V2 Illustrated Asset Foundation Registry
 *
 * Central require() map for every illustrated/donghua asset slot created in
 * the V2 visual-replacement push. Future V3–V8 screens import from here
 * instead of inlining require() paths — swapping art is a one-line change.
 *
 * ART DIRECTION (all assets): donghua/anime cel-shaded fantasy-medical RPG,
 * clean linework, luminous jade + sky-blue palette, warm gold trim, lotus glow,
 * 2.5D illustrated, bright polished mobile game art, hopeful healing academy.
 *
 * NOT: flat vector, plain circle icon, photorealistic, dark gray UI, horror,
 * western comic style.
 *
 * ── CHAPTER MAP BACKGROUNDS ──────────────────────────────────────────────────
 * 9:16 (768 × 1408) vertical illustrated journey-map backgrounds.
 * Used by ChapterJourneyMap (V3 push will wire these in).
 *
 * ── NODE PICTURE ICONS ───────────────────────────────────────────────────────
 * 1:1 (1024 × 1024) transparent-bg illustrated 2.5D landmark objects.
 * Used by MapNodeShape (V3 push replaces the NODE_MAP require() entries).
 *
 * ── LESSON BANNERS ───────────────────────────────────────────────────────────
 * 16:9 wide illustrated header banners per lesson topic.
 * Used by lotus-lesson detail screens and lesson card headers (V4 push).
 *
 * ── SCHOOL / DEPARTMENT BANNERS ─────────────────────────────────────────────
 * 16:9 wide illustrated banners per academic department/school.
 * Used by schools.tsx and department/[id].tsx (V4 push).
 *
 * ── MAP SPRITE TOKENS ────────────────────────────────────────────────────────
 * 1:1 transparent-bg chibi/pawn-style map traveler figures per class.
 * Used by ChapterJourneyMap player marker (V3 push).
 */

// ── Chapter Map Backgrounds ───────────────────────────────────────────────────

export const CHAPTER_MAP_BG: Record<string, number> = {
  /** Ch1 — Lotus Recall Sanctuary training path (teal, jade, warm gold) */
  ch1_sanctuary: require("../../assets/map-bg/journey_map_ch1_sanctuary.png"),
  /** Ch2 — Clinica University courtyard and ward bridge (sky-blue, jade, gold) */
  ch2_university_courtyard: require("../../assets/map-bg/journey_map_ch2_university_courtyard.png"),
  /** Ch3 — Breathing Garden / Airway Temple path (pale blue, jade mist) */
  ch3_breathing_garden: require("../../assets/map-bg/journey_map_ch3_breathing_garden.png"),
  /** Ch4 — Ward Defense Code Rush Tower path (red-gold urgency) */
  ch4_code_rush_tower: require("../../assets/map-bg/journey_map_ch4_code_rush_tower.png"),
  /** Ch5 — Community Bloom public health district (civic warmth, gold, jade) */
  ch5_community_bloom: require("../../assets/map-bg/journey_map_ch5_community_bloom.png"),
};

/** Resolve chapter map bg by chapter number (1-indexed). Falls back to ch1. */
export function getChapterMapBg(chapterNumber: number): number {
  const key = `ch${chapterNumber}_` as string;
  const match = Object.entries(CHAPTER_MAP_BG).find(([k]) => k.startsWith(key));
  return match ? match[1] : CHAPTER_MAP_BG.ch1_sanctuary;
}

// ── Node Picture Icons ────────────────────────────────────────────────────────

export const NODE_ILLUSTRATED: Record<string, number> = {
  /** Glowing memory lotus shard / crystal — replaces generic node_memory.png */
  memory_lotus_shard: require("../../assets/map-nodes/node_memory_lotus_shard.png"),
  /** Assessment desk with cue cards + magnifier — replaces node_challenge.png */
  rapid_triage_assessment_desk: require("../../assets/map-nodes/node_rapid_triage_assessment_desk.png"),
  /** Shielded ward cot with protective glow — new stabilize/support node */
  stabilize_ward_shield: require("../../assets/map-nodes/node_stabilize_ward_shield.png"),
  /** Healer ward gate archway — replaces node_battle.png / ward shift */
  ward_shift_gate: require("../../assets/map-nodes/node_ward_shift_gate.png"),
  /** Open lotus journal scroll — replaces node_reflection.png */
  reflection_lotus_journal: require("../../assets/map-nodes/node_reflection_lotus_journal.png"),
  /** Corrupted lotus gate with dark seal — replaces node_miniboss.png */
  trial_corrupted_gate: require("../../assets/map-nodes/node_trial_corrupted_gate.png"),
  /** Ornate medical supply chest — replaces node_reward.png */
  reward_medical_chest: require("../../assets/map-nodes/node_reward_medical_chest.png"),
};

/**
 * Mapping from ChapterPart.type → illustrated node picture icon.
 * V3 push: drop this into MapNodeShape's NODE_MAP to replace the old entries.
 */
export const NODE_TYPE_ILLUSTRATED: Record<string, number> = {
  battle:          NODE_ILLUSTRATED.ward_shift_gate,
  mini_boss:       NODE_ILLUSTRATED.trial_corrupted_gate,
  ward_defense:    NODE_ILLUSTRATED.ward_shift_gate,
  memory_fragment: NODE_ILLUSTRATED.memory_lotus_shard,
  challenge:       NODE_ILLUSTRATED.rapid_triage_assessment_desk,
  reflection:      NODE_ILLUSTRATED.reflection_lotus_journal,
  reward:          NODE_ILLUSTRATED.reward_medical_chest,
  lesson:          NODE_ILLUSTRATED.reflection_lotus_journal,
  realm:           NODE_ILLUSTRATED.stabilize_ward_shield,
  chain:           NODE_ILLUSTRATED.rapid_triage_assessment_desk,
  minigame:        NODE_ILLUSTRATED.rapid_triage_assessment_desk,
  mode_preview:    NODE_ILLUSTRATED.ward_shift_gate,
};

// ── Lesson Banners ────────────────────────────────────────────────────────────

export const LESSON_BANNER: Record<string, number> = {
  /** River lotus water glow — hydration / fluid balance lessons */
  hydration: require("../../assets/lesson-banners/lesson_banner_hydration.png"),
  /** Warm clinic lanterns, orange-red warmth — fever / thermoregulation lessons */
  fever: require("../../assets/lesson-banners/lesson_banner_fever.png"),
  /** Mist garden + airway shrine, pale blue — breathing / respiratory lessons */
  breathing: require("../../assets/lesson-banners/lesson_banner_breathing.png"),
  /** Academy desk + scrolls + cue markers — clinical assessment lessons */
  assessment: require("../../assets/lesson-banners/lesson_banner_assessment.png"),
  /** Shielded cot + support cards — patient stabilization lessons */
  stabilization: require("../../assets/lesson-banners/lesson_banner_stabilization.png"),
  /** Garden table + lotus herbs + meal tray — nutrition / wellness lessons */
  nutrition: require("../../assets/lesson-banners/lesson_banner_nutrition.png"),
};

/**
 * Resolve a lesson banner by lesson ID or topic keyword.
 * Returns undefined if no banner matches — callers should fall back to a
 * solid-color header or the generic lesson icon.
 */
export function getLessonBanner(lessonIdOrTopic: string): number | undefined {
  const key = lessonIdOrTopic.toLowerCase();
  if (key.includes("hydrat") || key.includes("fluid") || key.includes("water")) return LESSON_BANNER.hydration;
  if (key.includes("fever") || key.includes("temp") || key.includes("therm")) return LESSON_BANNER.fever;
  if (key.includes("breath") || key.includes("airway") || key.includes("respir") || key.includes("lung")) return LESSON_BANNER.breathing;
  if (key.includes("assess") || key.includes("triage") || key.includes("cue")) return LESSON_BANNER.assessment;
  if (key.includes("stabil") || key.includes("shield") || key.includes("protect")) return LESSON_BANNER.stabilization;
  if (key.includes("nutrit") || key.includes("food") || key.includes("meal") || key.includes("diet")) return LESSON_BANNER.nutrition;
  return undefined;
}

// ── School / Department Banners ───────────────────────────────────────────────

export const SCHOOL_BANNER: Record<string, number> = {
  /** Clinical cue scrolls + magnifier on academy desk */
  assessment:      require("../../assets/school-banners/school_banner_assessment.png"),
  /** Breathing shrine + wind currents + lotus chimes */
  airway:          require("../../assets/school-banners/school_banner_airway.png"),
  /** Botanical garden + healing herbs + lotus meal spread */
  nutrition:       require("../../assets/school-banners/school_banner_nutrition.png"),
  /** Protective ward shield over patient cot */
  stabilization:   require("../../assets/school-banners/school_banner_stabilization.png"),
  /** Alchemist bottles + glowing tinctures on apothecary shelf */
  pharmacology:    require("../../assets/school-banners/school_banner_pharmacology.png"),
  /** Urgent ward gate + emergency lanterns + response equipment */
  emergency:       require("../../assets/school-banners/school_banner_emergency.png"),
  /** Serene meditation garden + lotus + calm blue light */
  mental_wellness: require("../../assets/school-banners/school_banner_mental_wellness.png"),
  /** Long-term care sanctuary garden + recovery path + seasonal banners */
  chronic_disease: require("../../assets/school-banners/school_banner_chronic_disease.png"),
};

/**
 * Resolve a school banner by department/school id or name keyword.
 * Returns undefined if no banner matches — fall back to a solid-color header.
 */
export function getSchoolBanner(deptIdOrName: string): number | undefined {
  const key = deptIdOrName.toLowerCase().replace(/[-_ ]/g, "");
  if (key.includes("assess") || key.includes("triage")) return SCHOOL_BANNER.assessment;
  if (key.includes("airway") || key.includes("breath") || key.includes("respir")) return SCHOOL_BANNER.airway;
  if (key.includes("nutrit") || key.includes("diet")) return SCHOOL_BANNER.nutrition;
  if (key.includes("stabil") || key.includes("support")) return SCHOOL_BANNER.stabilization;
  if (key.includes("pharm") || key.includes("medic") || key.includes("drug")) return SCHOOL_BANNER.pharmacology;
  if (key.includes("emerg") || key.includes("acute") || key.includes("rapid")) return SCHOOL_BANNER.emergency;
  if (key.includes("mental") || key.includes("wellness") || key.includes("psych")) return SCHOOL_BANNER.mental_wellness;
  if (key.includes("chronic") || key.includes("longterm") || key.includes("disease")) return SCHOOL_BANNER.chronic_disease;
  return undefined;
}

// ── Map Sprite Tokens ─────────────────────────────────────────────────────────

export const MAP_SPRITE: Record<string, number> = {
  /** Armored healer — teal + gold shield + healing staff */
  guardian:   require("../../assets/map-sprites/map_sprite_guardian.png"),
  /** Cloaked oracle — pale blue + silver, glowing scroll */
  seer:        require("../../assets/map-sprites/map_sprite_seer.png"),
  /** Nurse healer — jade-green robes, warm lantern */
  caretaker:   require("../../assets/map-sprites/map_sprite_caretaker.png"),
  /** Academic healer — gold + sky-blue, clinical scrolls */
  scholar:     require("../../assets/map-sprites/map_sprite_scholar.png"),
  /** Potion-maker — purple-gold, glowing tincture vials */
  alchemist:   require("../../assets/map-sprites/map_sprite_alchemist.png"),
  /** Field medic — teal + white, healing pack + bandages */
  medic:       require("../../assets/map-sprites/map_sprite_medic.png"),
};

/**
 * Resolve a map sprite by player class_tree_id or class name.
 * Defaults to caretaker (most neutral healer look) if no match.
 */
export function getMapSprite(classIdOrName: string): number {
  const key = classIdOrName.toLowerCase();
  if (key.includes("guardian") || key.includes("tank") || key.includes("protec")) return MAP_SPRITE.guardian;
  if (key.includes("seer") || key.includes("oracle") || key.includes("vision")) return MAP_SPRITE.seer;
  if (key.includes("caretaker") || key.includes("nurse") || key.includes("care")) return MAP_SPRITE.caretaker;
  if (key.includes("scholar") || key.includes("academic") || key.includes("learn")) return MAP_SPRITE.scholar;
  if (key.includes("alchemist") || key.includes("potion") || key.includes("brew")) return MAP_SPRITE.alchemist;
  if (key.includes("medic") || key.includes("field") || key.includes("combat")) return MAP_SPRITE.medic;
  return MAP_SPRITE.caretaker;
}

// ── Preload module arrays (for launch preloader) ──────────────────────────────

/** All V2 chapter map backgrounds — add to tab/battle preloader if needed. */
export const CHAPTER_MAP_BG_MODULES: number[] = Object.values(CHAPTER_MAP_BG);

/** All V2 node picture icons. */
export const NODE_ILLUSTRATED_MODULES: number[] = Object.values(NODE_ILLUSTRATED);

/** All V2 lesson banners. */
export const LESSON_BANNER_MODULES: number[] = Object.values(LESSON_BANNER);

/** All V2 school banners. */
export const SCHOOL_BANNER_MODULES: number[] = Object.values(SCHOOL_BANNER);

/** All V2 map sprite tokens. */
export const MAP_SPRITE_MODULES: number[] = Object.values(MAP_SPRITE);

/** Every V2 illustrated asset — use to warm the full illustrated asset cache. */
export const ALL_ILLUSTRATED_MODULES: number[] = [
  ...CHAPTER_MAP_BG_MODULES,
  ...NODE_ILLUSTRATED_MODULES,
  ...LESSON_BANNER_MODULES,
  ...SCHOOL_BANNER_MODULES,
  ...MAP_SPRITE_MODULES,
];
