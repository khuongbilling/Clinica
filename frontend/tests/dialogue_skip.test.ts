/**
 * tests/dialogue_skip.test.ts
 *
 * Tests for canSkipDialogueScene.
 *
 * CRITICAL INVARIANTS:
 *   1. Empty dialogueIds → never skippable (authoring incomplete).
 *   2. Single-route scene: skippable only when its own ID is seen.
 *   3. Alternate-route scene: ALL route IDs must be seen — not just the one
 *      currently open.  Prevents skipping unseen route content.
 *   4. One unseen ID in a multi-ID scene blocks skip entirely.
 */

import { describe, it, expect } from 'vitest';
import { canSkipDialogueScene } from '../src/features/story/dialogueSkip';

// ── Empty dialogueIds ─────────────────────────────────────────────────────────

describe('empty sceneDialogueIds', () => {
  it('returns false — authoring incomplete, never offer skip', () => {
    expect(canSkipDialogueScene([], new Set(['a', 'b', 'c']))).toBe(false);
  });

  it('returns false even with an empty seen set', () => {
    expect(canSkipDialogueScene([], new Set())).toBe(false);
  });
});

// ── Single-route scenes (dialogueIds = [scene.id]) ────────────────────────────

describe('single-route scene', () => {
  it('is skippable when the scene ID has been seen', () => {
    expect(
      canSkipDialogueScene(['c1_opening'], new Set(['c1_opening', 'other_scene'])),
    ).toBe(true);
  });

  it('is not skippable when the scene ID has not been seen', () => {
    expect(
      canSkipDialogueScene(['c1_opening'], new Set(['other_scene'])),
    ).toBe(false);
  });

  it('is not skippable against an empty seen set', () => {
    expect(canSkipDialogueScene(['c1_opening'], new Set())).toBe(false);
  });
});

// ── Alternate-route scenes (Day / Evening / Night variants) ───────────────────

describe('alternate-route scenes', () => {
  const dayId     = 'c4_day_route';
  const eveningId = 'c4_evening_route';
  const nightId   = 'c4_night_route';
  const allRoutes = [dayId, eveningId, nightId];

  it('CRITICAL: not skippable when only the current route has been seen', () => {
    // Player completed Day route, now viewing Evening — must NOT skip
    expect(
      canSkipDialogueScene(allRoutes, new Set([dayId])),
    ).toBe(false);
  });

  it('not skippable when two of three routes have been seen', () => {
    expect(
      canSkipDialogueScene(allRoutes, new Set([dayId, eveningId])),
    ).toBe(false);
  });

  it('skippable only when ALL route IDs have been seen', () => {
    expect(
      canSkipDialogueScene(allRoutes, new Set([dayId, eveningId, nightId])),
    ).toBe(true);
  });

  it('one missing ID in a large seen set still blocks skip', () => {
    const seenEverythingExceptNight = new Set([
      dayId, eveningId,
      'c1_opening', 'c2_opening', 'c3_opening', 'c5_opening',
    ]);
    expect(
      canSkipDialogueScene(allRoutes, seenEverythingExceptNight),
    ).toBe(false);
  });

  it('skippable with extra unrelated IDs in the seen set', () => {
    const seen = new Set([dayId, eveningId, nightId, 'unrelated_scene_1', 'unrelated_scene_2']);
    expect(canSkipDialogueScene(allRoutes, seen)).toBe(true);
  });
});

// ── Two-route variant (Day + Evening only) ────────────────────────────────────

describe('two-route variant', () => {
  const ids = ['c7_day_dialogue', 'c7_evening_dialogue'];

  it('not skippable with only Day seen', () => {
    expect(canSkipDialogueScene(ids, new Set(['c7_day_dialogue']))).toBe(false);
  });

  it('skippable when both are seen', () => {
    expect(canSkipDialogueScene(ids, new Set(['c7_day_dialogue', 'c7_evening_dialogue']))).toBe(true);
  });
});

// ── Default fallback pattern (scene.dialogueIds ?? [scene.id]) ───────────────

describe('default fallback pattern', () => {
  it('behaves like single-route when dialogueIds defaults to [scene.id]', () => {
    const sceneId = 'c3_memory';
    const dialogueIds = [sceneId]; // scene.dialogueIds ?? [scene.id]

    expect(canSkipDialogueScene(dialogueIds, new Set([sceneId]))).toBe(true);
    expect(canSkipDialogueScene(dialogueIds, new Set())).toBe(false);
  });
});
