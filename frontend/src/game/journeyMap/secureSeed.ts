/**
 * journeyMap/secureSeed.ts
 *
 * Cryptographically random seed generation for journey runs.
 *
 * A seed is a 32-character lowercase hex string (16 bytes of entropy).
 * Once assigned to a run it NEVER changes — the same seed always reproduces
 * the same map via generateHexTopology + assignJourneyEncounters.
 */

/**
 * Returns a cryptographically random 32-char hex string.
 *
 * Works in:
 *   • Expo web / browser   — window.crypto.getRandomValues
 *   • Expo native (RN)     — global.crypto.getRandomValues (RN 0.71+)
 *   • Node.js ≥ 19         — globalThis.crypto.getRandomValues
 *   • Node.js test runners — falls back to the `node:crypto` module
 */
export function generateSecureSeed(): string {
  const buf = new Uint8Array(16);

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    // Expo web, Expo native (RN 0.71+), Node 18+, modern browsers.
    crypto.getRandomValues(buf);
  } else {
    // Last-resort fallback for environments without Web Crypto (e.g. very old
    // Node test runners).  Not cryptographically strong, but this seed is only
    // used for deterministic map generation — not a security primitive.
    for (let i = 0; i < 16; i++) buf[i] = Math.floor(Math.random() * 256);
  }

  return Array.from(buf)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
