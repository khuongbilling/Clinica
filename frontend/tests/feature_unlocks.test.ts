import { describe, expect, it } from "vitest";

import {
  getFeatureUnlockLevel,
  isFeatureUnlocked,
} from "../src/game/progression";

describe("canonical Age 1 feature unlocks", () => {
  it("keeps World Events locked through Level 6 and opens them at Level 7", () => {
    expect(getFeatureUnlockLevel("world_event")).toBe(7);
    expect(isFeatureUnlocked("world_event", 6)).toBe(false);
    expect(isFeatureUnlocked("world_event", 7)).toBe(true);
  });

  it("keeps Boss Encounters locked through Level 8 and opens them at Level 9", () => {
    expect(getFeatureUnlockLevel("boss")).toBe(9);
    expect(isFeatureUnlocked("boss", 8)).toBe(false);
    expect(isFeatureUnlocked("boss", 9)).toBe(true);
  });

  it("treats unknown feature ids as ungated for forward-compatible callers", () => {
    expect(getFeatureUnlockLevel("future_feature")).toBe(1);
    expect(isFeatureUnlocked("future_feature", 1)).toBe(true);
  });
});