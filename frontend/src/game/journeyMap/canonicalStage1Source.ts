/**
 * Checked-in Stage 1 authority. This module intentionally has no generator
 * imports: changing a live Stage 2 layout cannot rewrite its approval identity.
 * Regenerate these literals only as an explicit authored-blueprint update.
 */
export interface CanonicalStage1Source {
  readonly blueprintHash: string;
  readonly structureHash: string;
  readonly startKey: string;
  readonly gateKey: string;
  readonly requiredRegionCellKeys: readonly string[];
}

const RAW_SOURCE: Record<number, CanonicalStage1Source> = {"1":{"blueprintHash":"1416efe7","structureHash":"48d87313","startKey":"0,0","gateKey":"11,0","requiredRegionCellKeys":["-1,0","-1,1","-1,2","0,-1","0,0","0,1","0,2","1,-1","1,-2","1,0","1,1","1,2","10,-1","10,0","10,1","11,-1","11,0","2,-1","2,-2","2,0","2,1","2,2","2,3","3,-1","3,-2","3,0","3,1","3,2","3,3","4,-1","4,-2","4,0","4,1","4,2","4,3","5,-1","5,-2","5,-3","5,0","5,1","5,2","5,3","5,4","6,-1","6,-2","6,-3","6,0","6,1","6,2","7,-1","7,-2","7,-3","7,0","7,1","8,-1","8,-2","8,-3","8,0","9,0","9,1"]},"2":{"blueprintHash":"1ee625ac","structureHash":"3d713b24","startKey":"0,0","gateKey":"8,0","requiredRegionCellKeys":["0,-1","0,0","0,1","2,0","2,1","2,3","3,-1","3,-2","3,-3","3,0","3,2","4,-1","4,-2","4,0","4,1","7,-1","7,0","7,1"]},"3":{"blueprintHash":"1624823e","structureHash":"637da792","startKey":"0,0","gateKey":"0,14","requiredRegionCellKeys":["-1,1","-1,13","-1,14","-1,15","-1,7","-1,8","-2,10","-2,11","-2,12","-2,6","-2,7","0,0","0,6","0,7","1,-1","2,4","2,5","2,6"]},"4":{"blueprintHash":"c99b6936","structureHash":"e326cb2d","startKey":"0,0","gateKey":"10,0","requiredRegionCellKeys":["0,-1","0,0","0,1","1,-1","1,-2","1,0","1,1","1,2","1,3","2,-1","2,-2","2,-3","2,0","2,2","2,3","2,4","5,-1","5,0","5,1"]},"5":{"blueprintHash":"df7e58f6","structureHash":"25e02f93","startKey":"0,0","gateKey":"0,10","requiredRegionCellKeys":["-1,3","-1,4","-1,5","-1,6","-2,2","-2,5","-2,7","-2,8","-2,9","-3,2","-3,3","-3,5","0,-1","0,0","0,1","0,2","0,3","0,4","0,5","2,3","2,4","3,2"]},"6":{"blueprintHash":"9241e1c0","structureHash":"bd6a348f","startKey":"0,0","gateKey":"0,11","requiredRegionCellKeys":["-1,11","-1,2","-1,3","-1,6","-1,7","-2,6","-2,7","-2,8","-2,9","-3,6","0,-1","0,0","0,1","0,11","0,5","1,-1","1,11","2,2","2,3","3,1"]},"7":{"blueprintHash":"9a14eb17","structureHash":"ab3981d9","startKey":"0,0","gateKey":"0,14","requiredRegionCellKeys":["-1,10","-1,15","-1,2","-1,3","-1,9","-2,10","-2,11","-2,12","0,-1","0,0","0,1","0,10","0,14","0,2","0,3","0,8","0,9","1,-1","1,14"]},"8":{"blueprintHash":"80bfc313","structureHash":"9cc86d91","startKey":"0,0","gateKey":"10,0","requiredRegionCellKeys":["0,-1","0,0","0,1","1,0","1,1","1,2","1,3","1,5","2,-1","2,-2","2,-3","2,0","2,1","2,2","2,5","3,0","3,1","3,2","3,3","3,5","4,-1","4,-2","4,-3","4,0","4,1","4,2","5,-1","5,-2","5,0","5,1"]},"9":{"blueprintHash":"ef0b2530","structureHash":"c6884b60","startKey":"0,0","gateKey":"0,11","requiredRegionCellKeys":["-1,1","-1,3","-1,4","-1,5","-1,6","-1,7","-1,8","-2,10","-2,5","-2,8","-2,9","-3,5","0,0","0,2","0,3","0,4","0,5","0,6","0,7","1,-1","2,3","2,4","3,2"]},"10":{"blueprintHash":"7f7937f5","structureHash":"f736419a","startKey":"0,0","gateKey":"16,0","requiredRegionCellKeys":["0,0","1,-2","11,-1","11,0","11,1","12,-1","2,0","3,0","4,-1","4,-2","4,0","5,-3","5,0","6,0","6,3","7,0","7,2","8,0","8,1"]}};

/**
 * Chapter 1's campus is deliberately kept separate from historical compact
 * source data above. The authoring pipeline consumes this replacement literal
 * while the old entry remains available only as provenance for prior runs.
 */
const CHAPTER_ONE_CAMPUS_SOURCE: CanonicalStage1Source = {
  blueprintHash: '4fc26ba8',
  structureHash: '49026190',
  startKey: '0,7',
  gateKey: '0,-7',
  requiredRegionCellKeys: [
    '-1,-1','-1,-2','-1,-3','-1,-5','-1,-6','-1,-7','-1,-8','-1,0','-1,1','-1,2','-1,3','-1,4','-1,6','-1,7','-1,8','-1,9',
    '-2,-1','-2,-2','-2,-5','-2,-6','-2,-7','-2,0','-2,1','-2,2','-2,3','-2,4','-2,7','-2,8','-2,9',
    '-3,-1','-3,-2','-3,0','-3,1','-3,2','-3,3','-3,4',
    '-4,-1','-4,-2','-4,0','-4,1','-4,2','-4,3','-4,4',
    '-5,-1','-5,0','-5,1','-5,2','-6,0','-6,1','-6,2',
    '0,-1','0,-2','0,-3','0,-4','0,-5','0,-6','0,-7','0,-8','0,-9','0,0','0,1','0,2','0,3','0,4','0,5','0,6','0,7','0,8','0,9',
    '1,-1','1,-2','1,-3','1,-4','1,-6','1,-7','1,-8','1,-9','1,0','1,1','1,2','1,3','1,5','1,6','1,7','1,8','1,9',
    '2,-1','2,-2','2,-3','2,-4','2,-7','2,-8','2,-9','2,0','2,1','2,2','2,5','2,6','2,7',
    '3,-1','3,-2','3,-3','3,-4','3,0','3,1','3,2',
    '4,-1','4,-2','4,-3','4,-4','4,0','4,1','4,2',
    '5,-1','5,-2','5,0','5,1','6,-1','6,-2','6,0',
  ],
};

const freezeSource = (source: CanonicalStage1Source): CanonicalStage1Source => Object.freeze({
  ...source,
  requiredRegionCellKeys: Object.freeze([...source.requiredRegionCellKeys]),
});

export const CANONICAL_STAGE1_SOURCES: Readonly<Record<number, CanonicalStage1Source>> =
  Object.freeze(Object.fromEntries(
    Object.entries({ ...RAW_SOURCE, 1: CHAPTER_ONE_CAMPUS_SOURCE })
      .map(([chapter, source]) => [chapter, freezeSource(source)]),
  ));

export function getCanonicalStage1Source(chapter: number): CanonicalStage1Source {
  const source = CANONICAL_STAGE1_SOURCES[chapter];
  if (!source) throw new Error(`No checked-in Stage 1 source for Chapter ${chapter}.`);
  return source;
}