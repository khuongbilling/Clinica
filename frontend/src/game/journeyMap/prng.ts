/**
 * journeyMap/prng.ts
 *
 * Shared deterministic PRNG primitives used by topology.ts and encounters.ts.
 * No React, Expo, or UI imports belong here.
 *
 * Both modules seed their RNG via fnv1a32(namespaced string) so their streams
 * are always independent even when the caller supplies the same base seed:
 *   topology  → fnv1a32("ch${chapter}:${seed}")
 *   encounters → fnv1a32("${seed}:encounters")
 */

/**
 * Mulberry32 — compact 32-bit seeded PRNG with good statistical properties.
 * Returns a thunk that yields floats uniformly in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (s + 0x6D2B79F5) >>> 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * FNV-1a 32-bit — deterministically maps any string to a uint32.
 * Used to convert arbitrary string/number seeds (and domain prefixes) into a
 * numeric value suitable for Mulberry32 initialisation.
 */
export function fnv1a32(str: string): number {
  let h = 0x811C9DC5; // offset basis
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 0x01000193); // FNV prime
    h >>>= 0;
  }
  return h;
}
