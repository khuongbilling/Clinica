import { getEncounterRatesBp } from '../src/game/journeyMap/canonicalConfig';
for (const ch of [1, 5, 10, 20, 25, 35, 40, 50, 100]) {
  const r = getEncounterRatesBp(ch);
  const pct = (v: number) => v / 100;
  console.log(`ch${ch}: none=${pct(r.none)}% battle=${pct(r.battle)}% areaBoss=${pct(r.areaBoss)}% treasure=${pct(r.treasure)}% merchant=${pct(r.merchant)}%`);
}
