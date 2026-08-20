import assert from 'assert';

import {
  CHAPTER_ONE_CAMPUS_LANDMARKS,
  chapterOneCampusLandmarkZ,
} from '../src/game/journeyMap/chapterOneCampusLandmarks';

const BASE_Z = 3000;
const DEPTH_STEP = 10;

const centralFountain = CHAPTER_ONE_CAMPUS_LANDMARKS.find(
  landmark => landmark.id === 'grand-quad-fountain',
);
assert.ok(centralFountain, 'central fountain landmark must exist');

const landmarkZ = chapterOneCampusLandmarkZ(centralFountain.anchor.q, centralFountain.anchor.r);
const northCharacterZ = BASE_Z + Math.round((-1 + 0 / 2) * DEPTH_STEP);
const southCharacterZ = BASE_Z + Math.round((1 + 0 / 2) * DEPTH_STEP);

assert.equal(landmarkZ, BASE_Z, 'central landmark uses the shared axial depth origin');
assert.ok(
  northCharacterZ < landmarkZ,
  'a character north of the landmark must render behind it',
);
assert.ok(
  southCharacterZ > landmarkZ,
  'a character south of the landmark must render in front of it',
);

console.log('campus_landmark_layer: 4 passed, 0 failed');