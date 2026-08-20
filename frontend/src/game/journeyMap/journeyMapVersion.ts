/**
 * journeyMapVersion.ts
 *
 * Single-source constant for the map layout version string.
 * Extracted here to break the circular require between
 * canonicalMapArtifact.ts (which imports backgroundAuthoringManifest)
 * and backgroundAuthoringManifest.ts (which needs this constant).
 *
 * Import ONLY from this file — never re-introduce MAP_LAYOUT_VERSION
 * into a module that backgroundAuthoringManifest.ts already depends on.
 *
 * Bump this string when the HexLaneLayout / topology pipeline changes in a
 * way that invalidates existing blueprint hashes and cached run geometry.
 */
export const MAP_LAYOUT_VERSION = 'v1';

/**
 * Geometry identity is chapter-scoped so an authored correction can invalidate
 * exactly one chapter's runs and background approval without blanking every
 * other chapter's approved Stage 3 raster.
 */
export function getChapterMapLayoutVersion(chapter: number): string {
  return chapter === 1 ? 'v5-campus-obstacle-routes' : MAP_LAYOUT_VERSION;
}
