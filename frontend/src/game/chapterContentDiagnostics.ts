/**
 * Fail-loud completeness checks for the Age 1 chapter content package.
 * Kept dependency-light so it can run in CI and focused tests.
 */
import { ENEMIES } from './content';
import { allChapterEnemyRefs, AGE1_CHAPTERS, getChapterContent } from './chapterContent';
import { hasEnemySprite, getEnemySpriteArtSource } from '../components/EnemySprites';
import {
  CHAPTER_AREA_BOSS, CHAPTER_BATTLE_POOL, CHAPTER_BOSS,
  getBossCacheReward, getTreasureReward,
} from './journeyMap/encounterResolution';
import { generateMerchantInventory, MERCHANT_SLOT_COUNT, assembleCovenantScroll } from './journeyMap/merchant';

export function getAge1ContentCompletenessErrors(): string[] {
  const errors: string[] = [];
  const enemyIds = new Set(ENEMIES.map(enemy => enemy.id));
  for (const chapter of AGE1_CHAPTERS) {
    const entry = getChapterContent(chapter);
    if (entry.normal.length !== 4) errors.push(`chapter ${chapter}: expected 4 normal enemies`);
    if (CHAPTER_BATTLE_POOL[chapter]?.length !== 4) errors.push(`chapter ${chapter}: Journey pool misaligned`);
    if (CHAPTER_AREA_BOSS[chapter] !== entry.areaBoss.id) errors.push(`chapter ${chapter}: area boss mapping misaligned`);
    if (CHAPTER_BOSS[chapter] !== entry.chapterBoss.id) errors.push(`chapter ${chapter}: chapter boss mapping misaligned`);
    for (const ref of [...entry.normal, entry.elite, entry.areaBoss, entry.chapterBoss]) {
      // Lord Imbalance is the legacy named boss singleton resolved in battle.tsx.
      if (ref.id !== 'lord_imbalance' && !enemyIds.has(ref.id)) errors.push(`chapter ${chapter}: missing enemy '${ref.id}'`);
      if (!hasEnemySprite(ref.id)) errors.push(`chapter ${chapter}: missing registered art '${ref.id}'`);
      if (getEnemySpriteArtSource(ref.id) !== ref.artSourceId) errors.push(`chapter ${chapter}: unapproved art mapping '${ref.id}'`);
    }
    for (const tier of ['bronze', 'silver', 'gold'] as const) {
      if (getTreasureReward(tier, chapter).xp !== 0) errors.push(`chapter ${chapter}: random ${tier} chest grants XP`);
    }
    if (getBossCacheReward(chapter, 'areaBoss', false).xp !== 0 || getBossCacheReward(chapter, 'chapterBoss', false).xp !== 0) {
      errors.push(`chapter ${chapter}: rechallenge cache grants XP`);
    }
    if (chapter >= 5 && generateMerchantInventory('diagnostic', `tile-${chapter}`, chapter).length !== MERCHANT_SLOT_COUNT) {
      errors.push(`chapter ${chapter}: merchant does not have six slots`);
    }
  }
  if (allChapterEnemyRefs().length !== 70) errors.push('Age 1 content package has an unexpected enemy reference count');
  const assembly = assembleCovenantScroll({ 'Covenant Skill Fragment': 3 });
  if (!assembly.ok || assembly.inventory['Blank Covenant Scroll'] !== 1) errors.push('Covenant assembly is broken');
  return errors;
}

export function assertAge1ContentComplete(): void {
  const errors = getAge1ContentCompletenessErrors();
  if (errors.length) throw new Error(`[Age1Content] completeness failure:\n${errors.join('\n')}`);
}