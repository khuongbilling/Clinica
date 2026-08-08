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
    crypto.getRandomValues(buf);
  } else {
    // Node.js < 19 / older test environments.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto') as { randomBytes(n: number): { [i: number]: number } };
    const bytes = nodeCrypto.randomBytes(16);
    for (let i = 0; i < 16; i++) buf[i] = bytes[i];
  }

  return Array.from(buf)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
