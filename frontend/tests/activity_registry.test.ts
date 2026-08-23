import { describe, expect, it } from "vitest";

import {
  ACTIVITY_REGISTRY,
  getDailyEligibleFeatureIds,
  resolveActivityAccess,
} from "../src/game/activityRegistry";

const introducedUniversityPlayer = {
  player_level: 8,
  seen_university_intro: true,
  lessons_completed: ["lesson-1"],
  uni_cue_lab_count: 1,
  uni_triage_count: 1,
  uni_stack_count: 1,
};

describe("Living Clinica activity registry", () => {
  it("provides a single typed category and home for every listed activity", () => {
    expect(ACTIVITY_REGISTRY.length).toBeGreaterThan(8);
    expect(ACTIVITY_REGISTRY.every((activity) => !!activity.category && !!activity.homeArea)).toBe(true);
    expect(new Set(ACTIVITY_REGISTRY.map((activity) => activity.id)).size).toBe(ACTIVITY_REGISTRY.length);
  });

  it("safely denies unknown activities and hides disabled future placeholders", () => {
    expect(resolveActivityAccess("not-real", introducedUniversityPlayer).allowed).toBe(false);
    expect(resolveActivityAccess("not-real", introducedUniversityPlayer).reasonCode).toBe("unknown_activity");
    expect(resolveActivityAccess("apothecary-lab", introducedUniversityPlayer).state).toBe("hidden");
  });

  it("delegates core unlocks to the existing feature ladder", () => {
    expect(resolveActivityAccess("ward-defense", { player_level: 3 }).state).toBe("locked");
    expect(resolveActivityAccess("ward-defense", { player_level: 4 }).allowed).toBe(true);
  });

  it("does not expose Daily modes before their current introduction evidence exists", () => {
    expect(getDailyEligibleFeatureIds({ player_level: 10, lessons_completed: ["lesson-1"] }))
      .not.toContain("university");
    expect(getDailyEligibleFeatureIds(introducedUniversityPlayer)).toContain("university");
  });

  it("restores the exact legacy feature-only Daily pool when 5A is disabled", () => {
    expect(getDailyEligibleFeatureIds({ player_level: 4 }, { activityRegistry: false }))
      .toEqual(["university", "ward_defense", "lotus_journal", "hall_of_heroes"]);
    expect(getDailyEligibleFeatureIds({ player_level: 4 }, { activityRegistry: true }))
      .not.toContain("university");
  });

  it("maps every Daily-eligible registry activity to an existing Daily mode", () => {
    expect(ACTIVITY_REGISTRY
      .filter((activity) => activity.dailyEligible)
      .every((activity) => typeof activity.dailyMode === "string")).toBe(true);
  });

  it("blocks reviewed University modes until the existing foundation practices are complete", () => {
    expect(resolveActivityAccess("clinical-simulation", {
      player_level: 10,
      lessons_completed: ["lesson-1"],
    }).reasonCode).toBe("intro_incomplete");
    expect(resolveActivityAccess("clinical-simulation", introducedUniversityPlayer).allowed).toBe(true);
  });
});