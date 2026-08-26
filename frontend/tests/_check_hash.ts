import { getChapterHexLayout } from '../src/game/journeyMap/chapterHexLayout';
import { getChapterSceneryLayout } from '../src/game/journeyMap/chapterSceneryLayout';
import {
  createLiveStage1CandidateSnapshot,
  getCanonicalStage1Snapshot,
} from '../src/game/journeyMap/canonicalStageIdentity';

const CHAPTER_ID = 1;
const EXPECTED_BLUEPRINT_HASH = '55552867';
const EXPECTED_STRUCTURE_HASH = '8917a91d';

const canonical = getCanonicalStage1Snapshot(CHAPTER_ID);
const live = createLiveStage1CandidateSnapshot(
  getChapterHexLayout(CHAPTER_ID),
  getChapterSceneryLayout(CHAPTER_ID),
);

if (canonical.blueprintHash !== EXPECTED_BLUEPRINT_HASH) {
  throw new Error(
    `Chapter 1 canonical blueprint hash drifted: ${canonical.blueprintHash} !== ${EXPECTED_BLUEPRINT_HASH}`,
  );
}
if (canonical.structureHash !== EXPECTED_STRUCTURE_HASH) {
  throw new Error(
    `Chapter 1 canonical structure hash drifted: ${canonical.structureHash} !== ${EXPECTED_STRUCTURE_HASH}`,
  );
}
if (live.blueprintHash !== canonical.blueprintHash) {
  throw new Error(
    `Chapter 1 live blueprint hash no longer matches canonical identity: ${live.blueprintHash} !== ${canonical.blueprintHash}`,
  );
}
if (live.structureHash !== canonical.structureHash) {
  throw new Error(
    `Chapter 1 live structure hash no longer matches canonical identity: ${live.structureHash} !== ${canonical.structureHash}`,
  );
}

console.log(`ch1_hash: ${canonical.blueprintHash}`);
