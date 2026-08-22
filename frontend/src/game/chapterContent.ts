/**
 * Age 1 chapter encounter package.
 *
 * This is intentionally data-only: Journey, Ward Shift, sprite registration and
 * diagnostics all read this table rather than maintaining parallel chapter
 * fallbacks.  Reuse art is explicit through `artSourceId`; it is never a UI
 * fallback.
 */

export const AGE1_CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type Age1ChapterId = typeof AGE1_CHAPTERS[number];

export interface ChapterEnemyRef {
  id: string;
  name: string;
  /** Existing sprite family used for this named/recoloured variant. */
  artSourceId: string;
}

export interface ChapterContentPackage {
  chapter: Age1ChapterId;
  normal: readonly [ChapterEnemyRef, ChapterEnemyRef, ChapterEnemyRef, ChapterEnemyRef];
  elite: ChapterEnemyRef;
  areaBoss: ChapterEnemyRef;
  chapterBoss: ChapterEnemyRef;
}

const ref = (id: string, name: string, artSourceId: string): ChapterEnemyRef =>
  ({ id, name, artSourceId });

export const AGE1_CHAPTER_CONTENT: Record<Age1ChapterId, ChapterContentPackage> = {
  1: {
    chapter: 1,
    normal: [
      ref('dehydration_wisp', 'Dehydration Wisp', 'dehydration_wisp'),
      ref('air_sprite', 'Airway Sprite', 'air_sprite'),
      ref('river_sludge', 'River Sludge', 'river_sludge'),
      ref('energy_lock', 'Energy Lock', 'energy_lock'),
    ],
    elite: ref('ch1_dehydration_harbinger', 'Dehydration Harbinger', 'fluid_phantom'),
    areaBoss: ref('fluid_phantom', 'Fluid Phantom', 'fluid_phantom'),
    chapterBoss: ref('lord_imbalance', 'Lord Imbalance', 'lord_imbalance'),
  },
  2: {
    chapter: 2,
    normal: [
      ref('ch2_pyrexia_imp', 'Pyrexia Imp', 'fire_imp'),
      ref('ch2_ember_wisp', 'Ember Wisp', 'fever_shade'),
      ref('ch2_heatbound_lock', 'Heatbound Lock', 'energy_lock'),
      ref('ch2_ashen_sprite', 'Ashen Sprite', 'air_sprite'),
    ],
    elite: ref('ch2_sepsis_harbinger', 'Sepsis Harbinger', 'fever_shade'),
    areaBoss: ref('ch2_fever_archon', 'Fever Archon', 'fever_shade'),
    chapterBoss: ref('ch2_inflammation_crown', 'Crown of Inflammation', 'fever_shade'),
  },
  3: {
    chapter: 3,
    normal: [
      ref('ch3_gale_wisp', 'Gale Wisp', 'gale_spirit'),
      ref('ch3_bronchial_imp', 'Bronchial Imp', 'fire_imp'),
      ref('ch3_airway_sludge', 'Airway Sludge', 'river_sludge'),
      ref('ch3_breathless_lock', 'Breathless Lock', 'energy_lock'),
    ],
    elite: ref('ch3_hypoxia_harbinger', 'Hypoxia Harbinger', 'gale_spirit'),
    areaBoss: ref('ch3_gale_matron', 'Gale Matron', 'gale_spirit'),
    chapterBoss: ref('ch3_storm_lung', 'Storm Lung', 'gale_spirit'),
  },
  4: {
    chapter: 4,
    normal: [
      ref('ch4_cardion_echo', 'Cardion Echo', 'cardion_echo'),
      ref('ch4_storm_sprite', 'Storm Sprite', 'air_sprite'),
      ref('ch4_pulse_lock', 'Pulse Lock', 'energy_lock'),
      ref('ch4_surge_wisp', 'Surge Wisp', 'electrox_flicker'),
    ],
    elite: ref('ch4_arrhythmia_harbinger', 'Arrhythmia Harbinger', 'cardion_echo'),
    areaBoss: ref('ch4_pulse_warden', 'Pulse Warden', 'cardion_echo'),
    chapterBoss: ref('ch4_thunder_heart', 'Thunder Heart', 'cardion_echo'),
  },
  5: {
    chapter: 5,
    normal: [
      ref('ch5_septara_seed', 'Septara Seed', 'septara_seed'),
      ref('ch5_spore_wisp', 'Spore Wisp', 'pulmora_wisp'),
      ref('ch5_contagion_imp', 'Contagion Imp', 'fire_imp'),
      ref('ch5_isolation_lock', 'Isolation Lock', 'energy_lock'),
    ],
    elite: ref('ch5_contagion_harbinger', 'Contagion Harbinger', 'contagion_wraith'),
    areaBoss: ref('ch5_spore_matriarch', 'Spore Matriarch', 'septara_seed'),
    chapterBoss: ref('ch5_ward_cascade_boss', 'Ward Cascade', 'ward_cascade'),
  },
  6: {
    chapter: 6,
    normal: [
      ref('ch6_glycora_spark', 'Glycora Spark', 'glycora_spark'),
      ref('ch6_energy_wisp', 'Energy Wisp', 'electrox_flicker'),
      ref('ch6_glucose_lock', 'Glucose Lock', 'energy_lock'),
      ref('ch6_metabolic_imp', 'Metabolic Imp', 'fire_imp'),
    ],
    elite: ref('ch6_metabolic_harbinger', 'Metabolic Harbinger', 'glycora_spark'),
    areaBoss: ref('ch6_glucose_colossus', 'Glucose Colossus', 'glycora_spark'),
    chapterBoss: ref('ch6_imbalance_core_boss', 'Imbalance Core', 'imbalance_core'),
  },
  7: {
    chapter: 7,
    normal: [
      ref('ch7_mind_fog', 'Mind Fog', 'mind_fog'),
      ref('ch7_neural_wisp', 'Neural Wisp', 'dehydration_specter'),
      ref('ch7_delirium_lock', 'Delirium Lock', 'energy_lock'),
      ref('ch7_panic_sprite', 'Panic Sprite', 'air_sprite'),
    ],
    elite: ref('ch7_delirium_harbinger', 'Delirium Harbinger', 'mind_fog'),
    areaBoss: ref('ch7_mind_maze', 'Mind Maze', 'mind_fog'),
    chapterBoss: ref('ch7_cognitive_eclipse', 'Cognitive Eclipse', 'mind_fog'),
  },
  8: {
    chapter: 8,
    normal: [
      ref('ch8_renal_sludge', 'Renal Sludge', 'river_sludge'),
      ref('ch8_electro_wisp', 'Electro Wisp', 'electrox_flicker'),
      ref('ch8_filtration_lock', 'Filtration Lock', 'energy_lock'),
      ref('ch8_fluid_sprite', 'Fluid Sprite', 'air_sprite'),
    ],
    elite: ref('ch8_renal_harbinger', 'Renal Harbinger', 'river_sludge'),
    areaBoss: ref('ch8_filtration_titan', 'Filtration Titan', 'imbalance_core'),
    chapterBoss: ref('ch8_crisis_convergence_boss', 'Crisis Convergence', 'crisis_convergence'),
  },
  9: {
    chapter: 9,
    normal: [
      ref('ch9_dehydration_specter', 'Dehydration Specter', 'dehydration_specter'),
      ref('ch9_airway_rupture', 'Airway Rupture', 'gale_spirit'),
      ref('ch9_ward_fire', 'Ward Fire', 'fire_imp'),
      ref('ch9_cardiac_echo', 'Cardiac Echo', 'cardion_echo'),
    ],
    elite: ref('ch9_acute_harbinger', 'Acute Harbinger', 'dehydration_specter'),
    areaBoss: ref('dehydration_specter', 'Dehydration Specter', 'dehydration_specter'),
    chapterBoss: ref('ch9_critical_convergence', 'Critical Convergence', 'crisis_convergence'),
  },
  10: {
    chapter: 10,
    normal: [
      ref('ch10_cascade_wisp', 'Cascade Wisp', 'ward_cascade'),
      ref('ch10_core_shade', 'Core Shade', 'imbalance_core'),
      ref('ch10_contagion_spirit', 'Contagion Spirit', 'contagion_wraith'),
      ref('ch10_crisis_lock', 'Crisis Lock', 'energy_lock'),
    ],
    elite: ref('ch10_final_harbinger', 'Final Harbinger', 'crisis_convergence'),
    areaBoss: ref('ch10_cascade_overseer', 'Cascade Overseer', 'ward_cascade'),
    chapterBoss: ref('ch10_age_one_rupture', 'Age One Rupture', 'crisis_convergence'),
  },
};

export const CHAPTER_ELITE_RATE_BP = 1_000; // 10% of battle tiles, not of all tiles.

export function getChapterContent(chapter: number): ChapterContentPackage {
  const content = AGE1_CHAPTER_CONTENT[chapter as Age1ChapterId];
  if (!content) throw new Error(`[chapterContent] missing Age 1 content for chapter ${chapter}`);
  return content;
}

export function allChapterEnemyRefs(): ChapterEnemyRef[] {
  return AGE1_CHAPTERS.flatMap(chapter => {
    const entry = AGE1_CHAPTER_CONTENT[chapter];
    return [...entry.normal, entry.elite, entry.areaBoss, entry.chapterBoss];
  });
}

export function isAge1Chapter(chapter: number): chapter is Age1ChapterId {
  return AGE1_CHAPTERS.includes(chapter as Age1ChapterId);
}