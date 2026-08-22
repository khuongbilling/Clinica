import { assertAge1ContentComplete } from '../src/game/chapterContentDiagnostics';
import { generateMerchantInventory, NIGHT_MARKET_TICKET } from '../src/game/journeyMap/merchant';
import { getBattleEncounter } from '../src/game/journeyMap/encounterResolution';

assertAge1ContentComplete();
for (let chapter = 1; chapter <= 10; chapter++) {
  const battle = getBattleEncounter('content-test', `tile-${chapter}`, chapter);
  if (!battle.enemyId || !battle.label) throw new Error(`chapter ${chapter} battle resolution failed`);
}
const first = generateMerchantInventory('stable', 'tile', 5);
const second = generateMerchantInventory('stable', 'tile', 5);
if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('merchant inventory rerolled');
const duplicate = generateMerchantInventory('stable', 'tile', 5, true);
if (duplicate.some(item => item.name === NIGHT_MARKET_TICKET)) throw new Error('duplicate Night Market ticket was not replaced');
console.log('age1_content_package: PASS');