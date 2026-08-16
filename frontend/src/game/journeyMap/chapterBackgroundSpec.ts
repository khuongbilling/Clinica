/**
 * journeyMap/chapterBackgroundSpec.ts — Push 7: Background Art Specification
 *
 * Synthesises all prior push outputs into a structured per-chapter,
 * per-shift image-generation specification.
 *
 * ── Inputs ──────────────────────────────────────────────────────────────────
 *   ChapterMapDNA       → environment type, theme name, walkable character
 *   HexLaneLayout       → clearing count, aspect ratio, tile budget
 *   SceneryLayout       → scenery zone types, environmental density
 *
 * ── Output ──────────────────────────────────────────────────────────────────
 *   ChapterBackgroundSpec  (one per chapter)
 *     └─ ShiftBackgroundSpec × 3  (day / evening / night)
 *          ├─ aiPrompt            — full AI image-generation prompt
 *          ├─ negativePrompt      — what must NOT appear in the art
 *          ├─ targetAssetPath     — filesystem path for the generated file
 *          ├─ metroRequirePath    — Metro require() string for registration
 *          └─ targetDimensions    — pixel size of the generated image
 *
 * ── RASTER RULE ─────────────────────────────────────────────────────────────
 *   Actual environment art must be a real raster asset.
 *   Never approximate the environment with CSS, SVG, or procedural vector art.
 *
 * ── GEOMETRY INVARIANT ──────────────────────────────────────────────────────
 *   Day / Evening / Night use the SAME lanes, clearings, obstacles, landmarks.
 *   Shift variants change ONLY lighting, atmosphere, and ambient detail.
 *
 * COMMIT TAG: feat(journey): generate raster simulation environment from navigational blueprint
 */

import { getChapterMapDNA }         from './chapterMapDNA';
import { getChapterHexLayout }      from './chapterHexLayout';
import { getChapterSceneryLayout }  from './chapterSceneryLayout';
import type { TimeOfDay }           from './types';
import type {
  ChapterMapDNA,
  ChapterEnvironmentType,
  MapTopologyFamily,
  SceneryZoneType,
  EnvironmentalDensity,
  ChapterBackgroundSpec,
  ShiftBackgroundSpec,
  HexLaneLayout,
  SceneryLayout,
} from './chapterMapTemplate.types';

// ── Target image dimensions ───────────────────────────────────────────────────
//
// All chapter backgrounds are generated at 1024 × 1024 pixels.
// The fog-map renderer uses contentFit="cover" + backgroundScale transform,
// so a square source fills any viewport aspect ratio without distortion.
// Match the existing Ch1 assets (map-platform-background-ch1-day.png).

const TARGET_WIDTH  = 1024;
const TARGET_HEIGHT = 1024;

// ── Environment type mapping ─────────────────────────────────────────────────
//
// Derived from DNA.topologyFamily + themeName.
// Each chapter is assigned the environment type that best matches its
// spatial character AND thematic identity.

const FAMILY_TO_ENV: Record<MapTopologyFamily, ChapterEnvironmentType> = {
  open_plaza:                  'SIMULATION_PLAZA',
  academic_quad:               'ACADEMIC_QUAD',
  simulation_complex:          'CLINICAL_SKILLS_COMPLEX',
  hub_and_spoke:               'EMERGENCY_SIMULATION_CENTER',
  twin_hub:                    'MOCK_WARD_CAMPUS',
  campus_promenade:            'MOCK_WARD_CAMPUS',
  braided_pathways:            'DIAGNOSTIC_CENTER',
  staggered_academic_blocks:   'ANATOMY_GARDEN',
  serpentine_campus_walk:      'CLINICAL_SKILLS_COMPLEX',
  multi_court_campus:          'CAPSTONE_CAMPUS',
  // Procedural fallbacks (Book II families)
  radial_campus:               'ACADEMIC_QUAD',
  linear_corridor:             'CLINICAL_SKILLS_COMPLEX',
};

// ── Walkable path styles per topology family ──────────────────────────────────
//
// Directive §1: walkable regions must be visually obvious.
// Each topology family has a distinct path character that should be painted
// into the background so players can immediately read movement space.

const WALKABLE_PATH_STYLES: Record<MapTopologyFamily, string> = {
  open_plaza:
    'broad circular training plazas connected by wide polished stone corridors, ' +
    'centre of each plaza clearly open and visibly navigable',
  academic_quad:
    'stone quadrangle walkways bordered by column-lined covered passages, ' +
    'paved academic thoroughfares wide enough for group movement',
  simulation_complex:
    'polished clinical simulation court floors with clean antiseptic white tiling, ' +
    'wide marked training lanes connecting clinical bays',
  hub_and_spoke:
    'central atrium hub radiating broad clinical training pathways in each cardinal ' +
    'direction, hub floor visibly open as a gathering space',
  twin_hub:
    'two large interconnected open hub courts linked by wide covered walkways, ' +
    'both hub floors unobstructed and clearly readable as movement space',
  campus_promenade:
    'long campus promenade of jade-paved stone flanked by garden edge plantings, ' +
    'path axis clearly visible from above as the main traversal spine',
  braided_pathways:
    'braided network of academic passages weaving between learning blocks, ' +
    'each passage distinctly paved and wide enough for unambiguous navigation',
  staggered_academic_blocks:
    'staggered arrangement of paved academic training plazas separated by ' +
    'stepped transitional corridors, each plaza visibly distinct',
  serpentine_campus_walk:
    'serpentine jade-stone walkway winding through simulation terrain, ' +
    'path width consistent and floor surface clearly different from surroundings',
  multi_court_campus:
    'multiple interconnected open simulation courts with wide transitional plazas, ' +
    'court floors lighter in tone than surrounding architecture',
  radial_campus:
    'radial stone spoke paths emanating from a large central hub plaza, ' +
    'each spoke clearly paved and distinct',
  linear_corridor:
    'long straight clinical corridors with branching bay openings, ' +
    'corridor floors polished and distinctly lighter than walls',
};

// ── Clearing styles per environment type ──────────────────────────────────────
//
// Directive §2: clearings must read as open space where something could happen.

const CLEARING_STYLES: Record<ChapterEnvironmentType, string> = {
  SIMULATION_PLAZA:
    'open simulation bays and practice pavilion floors — each clearing is a ' +
    'visibly unobstructed activity zone with a bare, clean centre tile',
  ACADEMIC_QUAD:
    'teaching courtyards and assessment plazas — each clearing has an open ' +
    'tiled floor with room for a group to gather, centre left bare',
  CLINICAL_SKILLS_COMPLEX:
    'mock clinical station courts and treatment staging areas — each clearing ' +
    'reads as a distinct practice zone with open floor space at its heart',
  MOCK_WARD_CAMPUS:
    'patient ward open bays and triage staging courts — clearings appear as ' +
    'accessible ward spaces with a clear unobstructed floor at centre',
  DIAGNOSTIC_CENTER:
    'diagnostic imaging courts and laboratory observation floors — each clearing ' +
    'is a circular or rectangular open zone clearly set apart from corridors',
  EMERGENCY_SIMULATION_CENTER:
    'large emergency response courts with broad open staging floors — clearings ' +
    'are generous in scale, unobstructed, and clearly readable as active zones',
  ANATOMY_GARDEN:
    'botanical study clearings and specimen observation plazas — each clearing ' +
    'has an open paved centre surrounded by lower-level garden elements',
  CAPSTONE_CAMPUS:
    'large interconnected capstone assessment courts — each clearing is a ' +
    'prominent open simulation floor, generously scaled and centre-open',
};

// ── Scenery framing styles by density ─────────────────────────────────────────
//
// Directive §3: architecture should border and define pathways, never dominate
// the traversal mask.  §6: some negative space stays visually open.

function buildSceneryFramingStyle(
  envType:  ChapterEnvironmentType,
  density:  EnvironmentalDensity,
  zonTypes: SceneryZoneType[],
): string {
  const densityDesc =
    density === 'LOW'    ? 'sparse environmental accents with generous open negative space' :
    density === 'MEDIUM' ? 'moderate architectural framing with some breathing room' :
                           'dense architectural framing tightly defining the path edges';

  const zoneDesc = zonTypes.length === 0 ? 'subtle border plantings' :
    [...new Set(zonTypes)].slice(0, 3).map(z => {
      switch (z) {
        case 'ARCHITECTURE':       return 'stone academic architecture';
        case 'GARDEN':             return 'manicured medicinal gardens';
        case 'PLANTER':            return 'carved stone planters';
        case 'COLUMN_GROUP':       return 'column clusters';
        case 'BUILDING_WING':      return 'building wings';
        case 'OBSERVATION_DECK':   return 'elevated observation decks';
        case 'SIMULATION_STRUCTURE': return 'simulation structures';
        case 'DECORATIVE_LANDMARK':  return 'decorative landmarks';
        case 'WATER_FEATURE':      return 'water features';
        case 'ACADEMIC_STATUE':    return 'academic statues';
        default: return z.toLowerCase().replace(/_/g, ' ');
      }
    }).join(', ');

  const envDesc =
    envType === 'ACADEMIC_QUAD'             ? 'stone teaching wings and garden parterre' :
    envType === 'SIMULATION_PLAZA'          ? 'observation pavilions and training structures' :
    envType === 'CLINICAL_SKILLS_COMPLEX'   ? 'academy medical architecture and training wings' :
    envType === 'MOCK_WARD_CAMPUS'          ? 'fantasy clinical buildings connected by corridors' :
    envType === 'DIAGNOSTIC_CENTER'         ? 'crystal-and-stone diagnostic laboratories' :
    envType === 'EMERGENCY_SIMULATION_CENTER' ? 'emergency response structures and command wings' :
    envType === 'ANATOMY_GARDEN'            ? 'botanical garden walls and specimen galleries' :
                                              'large interconnected capstone facility wings';

  return (
    `${densityDesc}; primary scenery elements are ${zoneDesc}; ` +
    `${envDesc} border and define the walkable paths without intruding onto them`
  );
}

// ── Art direction per environment type ────────────────────────────────────────
//
// One paragraph per chapter describing its visual identity — painterly,
// fantasy medical university, donghua aesthetic.

const ENV_ART_DIRECTION: Record<ChapterEnvironmentType, string> = {
  SIMULATION_PLAZA:
    'A grand open simulation plaza in a fantasy healing academy — sweeping stone ' +
    'floors, jade-teal architectural accents, and warm gold highlights. ' +
    'The space reads as a welcoming training environment where clinical practice ' +
    'is celebrated through light and space. Painterly donghua aesthetic.',
  ACADEMIC_QUAD:
    'A formal academic quadrangle in a fantasy medical university — symmetrical ' +
    'stone arches, column-lined passages, and ivy-touched teaching wings. ' +
    'The environment conveys scholarly tradition and structured learning. ' +
    'Rich jade and gold palette with warm stone base tones.',
  CLINICAL_SKILLS_COMPLEX:
    'A clinical skills complex in a fantasy simulation academy — clean ' +
    'polished training floors, bright clinical bays, and academic architecture ' +
    'framing the practice space. Antiseptic-white meets jade-teal fantasy. ' +
    'Lighting is deliberate and functional, highlighting the training areas.',
  MOCK_WARD_CAMPUS:
    'A mock ward campus in a fantasy healing institution — fantasy clinical ' +
    'structures connected by broad covered walkways, ward bays lit with ' +
    'warm healing magic. The space balances fantasy and clinical realism. ' +
    'Jade-teal arcades, amber lantern glow, stone-and-crystal materials.',
  DIAGNOSTIC_CENTER:
    'A diagnostic training centre in a fantasy medical academy — crystal ' +
    'and polished stone diagnostic chambers surrounding an open circulation ' +
    'space. Cyan and violet light from magical scanning apparatus frames ' +
    'the walkways. Precise and analytical visual tone.',
  EMERGENCY_SIMULATION_CENTER:
    'An emergency simulation centre in a fantasy academy — larger open ' +
    'response courts with branching practice zones radiating from a command ' +
    'hub. Urgent warm lighting, red-and-gold emergency signage in fantasy ' +
    'script, clear unobstructed staging floors.',
  ANATOMY_GARDEN:
    'An anatomy learning garden in a fantasy healing academy — open educational ' +
    'botanical spaces around clear paved circulation paths. Medicinal plants, ' +
    'specimen gardens, and scholarly statues border the walkways. ' +
    'Green-jade and earth tones with warm scholarly lanterns.',
  CAPSTONE_CAMPUS:
    'A capstone simulation campus — multiple large interconnected simulation ' +
    'courts forming an advanced practice environment. Grand scale, richly ' +
    'detailed architecture, and an atmosphere of accomplished mastery. ' +
    'The space feels like the culmination of a learning journey.',
};

// ── Shift lighting data ────────────────────────────────────────────────────────

interface ShiftLighting {
  lighting:    string;
  atmosphere:  string;
  ambientDetail: string;
}

const SHIFT_LIGHTING: Record<TimeOfDay, ShiftLighting> = {
  day: {
    lighting:
      'warm golden morning sunlight flooding through arched windows and open courts, ' +
      'bright and clear with strong directional shadows',
    atmosphere:
      'pale jade-tinted atmospheric mist, vivid green living plants, clear blue sky ' +
      'visible above open courtyards, jade columns in full warm light',
    ambientDetail:
      'windows bright and unlit (daytime), minimal mist, strong cast shadows, ' +
      'living plants fully green and visible',
  },
  evening: {
    lighting:
      'evening amber lantern glow and last warm diagonal sunlight raking through the arches, ' +
      'long shadows across the floor, teal pillars catching the last evening daylight',
    atmosphere:
      'indigo deepening in the far corners, amber and teal colour contrast, ' +
      'a central jade fountain or landmark glowing in the fading evening warmth',
    ambientDetail:
      'interior lanterns lit and glowing amber, windows beginning to glow warm, ' +
      'mist thickening slightly at corners, evening shadows long and dramatic',
  },
  night: {
    lighting:
      'night scene: teal bioluminescent lantern light and purple magical illumination, ' +
      'deep navy background with glowing magical circuit patterns on the floor',
    atmosphere:
      'deep navy night shadows, mystery in the air, glowing arcane runes on architectural ' +
      'surfaces, jade-teal light from lanterns creating pools of safe warmth',
    ambientDetail:
      'night-time windows fully lit with interior amber glow, floor runes glowing teal, ' +
      'dark negative space outside lit zones, starlight or aurora above open courts',
  },
};

// ── Negative prompt (constant across all chapters and shifts) ──────────────────

const NEGATIVE_PROMPT =
  'characters, people, figures, humanoids, animals, UI elements, text, labels, ' +
  'numbers, grid lines, hex grid overlay, fog of war, progress bars, icons, ' +
  'CSS color rectangles, flat color blocks, procedural vector shapes, SVG geometry, ' +
  'watermarks, signatures, frame borders, anime faces, portrait art, ' +
  'photorealistic photography, 3D render artifacts, low quality, blurry';

// ── Style anchor (constant across all prompts) ─────────────────────────────────

const STYLE_ANCHOR =
  'top-down painterly map environment, donghua Chinese animation aesthetic, ' +
  'fantasy healing university world, intricate architectural detail, ' +
  'no characters, seamless map background, artstation quality, 1024×1024';

// ── Asset path helpers ────────────────────────────────────────────────────────

function targetAssetPath(chapter: number, shift: TimeOfDay): string {
  return `assets/ui/journey/map/map-platform-background-ch${chapter}-${shift}.png`;
}

function metroRequirePath(chapter: number, shift: TimeOfDay): string {
  return `@/assets/ui/journey/map/map-platform-background-ch${chapter}-${shift}.png`;
}

// ── AI prompt builder ─────────────────────────────────────────────────────────

function buildAiPrompt(
  envType:      ChapterEnvironmentType,
  themeName:    string,
  pathStyle:    string,
  clearStyle:   string,
  sceneryStyle: string,
  shift:        TimeOfDay,
): string {
  const lt = SHIFT_LIGHTING[shift];
  return [
    STYLE_ANCHOR,
    `environment: ${ENV_ART_DIRECTION[envType]}`,
    `named "${themeName}"`,
    `floor/ground layer: ${pathStyle} — visually obvious as the traversal space`,
    `open encounter spaces: ${clearStyle}`,
    `surrounding scenery: ${sceneryStyle}`,
    `lighting: ${lt.lighting}`,
    `atmosphere: ${lt.atmosphere}`,
    `ambient detail: ${lt.ambientDetail}`,
    'render all three shift variants with IDENTICAL geometry — same floor layout, ' +
    'same building positions, same clearing locations; shift only light and atmosphere',
  ].join('; ');
}

// ── Geometry invariant note ────────────────────────────────────────────────────

function buildGeometryInvariantNote(
  layout:    HexLaneLayout,
  themeName: string,
): string {
  const nClearings = layout.clearingZones.length;
  const nTiles     = layout.actualTileCount;
  return (
    `"${themeName}" has ${nTiles} walkable tiles and ${nClearings} named clearings. ` +
    `Day, Evening, and Night variants share the SAME floor layout, path positions, ` +
    `clearing placements, obstacle footprints, and landmark locations. ` +
    `Only lighting, atmosphere, window glow, and ambient detail change between shifts. ` +
    `Buildings do NOT move. Paths do NOT move. Clearings do NOT move.`
  );
}

// ── Main builder ───────────────────────────────────────────────────────────────

function buildChapterBackgroundSpec(
  dna:      ChapterMapDNA,
  layout:   HexLaneLayout,
  scenery:  SceneryLayout,
): ChapterBackgroundSpec {
  const chapter    = dna.chapterId;
  const envType    = FAMILY_TO_ENV[dna.topologyFamily] ?? 'SIMULATION_PLAZA';
  const pathStyle  = WALKABLE_PATH_STYLES[dna.topologyFamily] ??
    'broad paved paths clearly readable as traversal space';
  const clearStyle = CLEARING_STYLES[envType];

  // Collect scenery zone types from the layout
  const zoneTypes = scenery.sceneryZones.map(z => z.type);
  const sceneryStyle = buildSceneryFramingStyle(envType, scenery.environmentalDensity, zoneTypes);

  const geoNote   = buildGeometryInvariantNote(layout, dna.themeName);
  const artDir    = ENV_ART_DIRECTION[envType];

  const SHIFTS: TimeOfDay[] = ['day', 'evening', 'night'];
  const shiftSpecs = {} as Record<TimeOfDay, ShiftBackgroundSpec>;

  for (const shift of SHIFTS) {
    const lt = SHIFT_LIGHTING[shift];
    shiftSpecs[shift] = {
      shift,
      lightingDescription:  lt.lighting,
      atmosphereDescription: lt.atmosphere,
      ambientDetail:         lt.ambientDetail,
      aiPrompt: buildAiPrompt(envType, dna.themeName, pathStyle, clearStyle, sceneryStyle, shift),
      negativePrompt: NEGATIVE_PROMPT,
      targetAssetPath:  targetAssetPath(chapter, shift),
      metroRequirePath: metroRequirePath(chapter, shift),
      targetDimensions: { width: TARGET_WIDTH, height: TARGET_HEIGHT },
    };
  }

  return {
    chapterId:            chapter,
    seed:                 dna.seed,
    environmentType:      envType,
    environmentName:      dna.themeName,
    artDirection:         artDir,
    walkablePathStyle:    pathStyle,
    clearingStyle:        clearStyle,
    sceneryFramingStyle:  sceneryStyle,
    geometryInvariantNote: geoNote,
    shifts: shiftSpecs,
  };
}

// ── Cache + public API ────────────────────────────────────────────────────────

const specCache = new Map<number, ChapterBackgroundSpec>();

/**
 * Returns the background art specification for one chapter.
 *
 * Synthesises: ChapterMapDNA + HexLaneLayout + SceneryLayout → ChapterBackgroundSpec
 *
 * The returned spec provides:
 *   • A full AI image-generation prompt per shift
 *   • Negative prompts, target asset paths, and Metro require strings
 *   • Art direction, path/clearing/scenery visual descriptions
 *   • A geometry-invariant note ensuring all three shift variants share the
 *     same spatial layout
 *
 * RASTER RULE: the generated art must be a real raster asset (PNG/WebP).
 * Never approximate the environment with CSS, SVG, or procedural vector art.
 */
export function getChapterBackgroundSpec(chapter: number): ChapterBackgroundSpec {
  const cached = specCache.get(chapter);
  if (cached) return cached;

  const dna     = getChapterMapDNA(chapter);
  const layout  = getChapterHexLayout(chapter);
  const scenery = getChapterSceneryLayout(chapter);

  const result = buildChapterBackgroundSpec(dna, layout, scenery);
  specCache.set(chapter, result);
  return result;
}

/**
 * Returns background art specifications for a range of chapters [from, to] inclusive.
 */
export function getChapterBackgroundSpecRange(from: number, to: number): ChapterBackgroundSpec[] {
  const result: ChapterBackgroundSpec[] = [];
  for (let c = from; c <= to; c++) result.push(getChapterBackgroundSpec(c));
  return result;
}

/**
 * Returns all three shift AI prompts for a chapter, keyed by shift.
 * Convenience accessor for generation scripts.
 */
export function getChapterGenerationPrompts(
  chapter: number,
): Record<TimeOfDay, { aiPrompt: string; negativePrompt: string; targetAssetPath: string }> {
  const spec = getChapterBackgroundSpec(chapter);
  return {
    day:     { aiPrompt: spec.shifts.day.aiPrompt,     negativePrompt: NEGATIVE_PROMPT, targetAssetPath: spec.shifts.day.targetAssetPath },
    evening: { aiPrompt: spec.shifts.evening.aiPrompt, negativePrompt: NEGATIVE_PROMPT, targetAssetPath: spec.shifts.evening.targetAssetPath },
    night:   { aiPrompt: spec.shifts.night.aiPrompt,   negativePrompt: NEGATIVE_PROMPT, targetAssetPath: spec.shifts.night.targetAssetPath },
  };
}
