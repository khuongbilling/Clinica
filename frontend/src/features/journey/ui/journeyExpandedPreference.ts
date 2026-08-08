/**
 * journeyExpandedPreference.ts — Push I: UI-only preference for the journey
 * chapter list view mode (focused vs. full).
 *
 * STORAGE RULE:
 *   This preference lives in localStorage because it is DISPLAY state only —
 *   it affects which chapter tabs are visible, nothing else.
 *
 *   Do NOT store any of the following in localStorage:
 *     • unlocks or progression gates
 *     • canonical route / shift choices
 *     • boss keys
 *     • chapter completion state
 *   Those already have authoritative backend persistence and must not be
 *   duplicated here — localStorage is not a progression source of truth.
 *
 * FAIL-OPEN:
 *   Any read/write failure (SSR, private-browsing restriction, quota) is
 *   silently swallowed and defaults to focused (expanded: false).
 *   A UI preference failure must never interrupt Journey progression.
 */

export const JOURNEY_EXPANDED_KEY = "clinica:journey:expanded";

/**
 * Returns the saved expanded preference.
 * Defaults to false (focused mode) on any error or missing value.
 */
export function loadJourneyExpandedPreference(): boolean {
  try {
    return localStorage.getItem(JOURNEY_EXPANDED_KEY) === "true";
  } catch {
    // SSR, private browsing, quota exceeded — fall back silently.
    return false;
  }
}

/**
 * Persists the expanded preference.
 * Failures are silently swallowed — a display preference is never critical.
 */
export function saveJourneyExpandedPreference(expanded: boolean): void {
  try {
    localStorage.setItem(JOURNEY_EXPANDED_KEY, String(expanded));
  } catch {
    // UI preference failure should never break Journey progression.
  }
}
