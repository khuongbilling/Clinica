import { getChapterHexLayout } from '../src/game/journeyMap/chapterHexLayout';
import { computeBlueprintHash } from '../src/game/journeyMap/backgroundAuthoringManifest';
const layout = getChapterHexLayout(1);
const hash = computeBlueprintHash(layout);
console.log('ch1_hash:', hash);
