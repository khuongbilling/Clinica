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
