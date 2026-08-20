/**
 * Shared reveal geometry. Environment art must always extend just beyond the
 * fog erasure boundary, using the same non-linear FOV scale as fog masks.
 */

export const EXPLORED_ENVIRONMENT_REVEAL_FACTOR = 1.25;
export const VISIBLE_ENVIRONMENT_REVEAL_FACTOR = 1.50;

export function getFogFovScale(effectiveFieldOfVision = 1): number {
  return 1 + (Math.max(1, effectiveFieldOfVision) - 1) * 0.55;
}

export function getEnvironmentRevealRadius(
  tileSize: number,
  state: 'explored' | 'visible',
  effectiveFieldOfVision = 1,
): number {
  return state === 'visible'
    ? tileSize * VISIBLE_ENVIRONMENT_REVEAL_FACTOR * getFogFovScale(effectiveFieldOfVision)
    : tileSize * EXPLORED_ENVIRONMENT_REVEAL_FACTOR;
}
