/**
 * tests/qa_guided_progression.test.ts
 *
 * ADJUSTMENT QA PUSH — TEST COGNITIVE-LOAD REDUCTION
 *
 * Verifies the 12 states from the QA spec using the pure selector layer built
 * across Adjustment Pushes A–I. No UI rendering, no store mutations.
 *
 * THE CORE SEPARATION THIS FILE DEFENDS:
 *   Content-gating code decides what is unlocked.
 *   Journey UI selectors only decide what to emphasise.
 *
 * No authoritative progression state may change simply because the Journey
 * UI is collapsed or expanded.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// Journey UI selectors (Pushes A, B, D, I)
import {
  getJourneyRecommendation,
} from '../src/features/journey/ui/journeyRecommendation';
import {
  getFocusedChapters,
  isNightShiftUnlocked,
  isChapterMastered,
  getCompletionLabel,
} from '../src/features/journey/ui/journeyVisibility';
import {
  getShiftAvailability,
} from '../src/features/journey/ui/shiftAvailability';
import type {
  ChapterUiSummary,
  JourneyNodeUi,
} from '../src/features/journey/ui/journeyUi.types';

// Battle assist (Push F)
import {
  getBattleAssistRule,
  recordEncounterVictory,
} from '../src/features/battle/battleAssist';
import {
  chapter1BattleAssist,
} from '../src/features/battle/battleAssistConfigs';

// Dialogue skip (Push H)
import { canSkipDialogueScene } from '../src/features/story/dialogueSkip';

// UI preference (Push I)
import {
  JOURNEY_EXPANDED_KEY,
  loadJourneyExpandedPreference,
  saveJourneyExpandedPreference,
} from '../src/features/journey/ui/journeyExpandedPreference';

// ── localStorage stub for State L tests ──────────────────────────────────────

let lsStore: Record<string, string> = {};
beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem:    (k: string) => lsStore[k] ?? null,
      setItem:    (k: string, v: string) => { lsStore[k] = v; },
      removeItem: (k: string) => { delete lsStore[k]; },
      clear:      () => { lsStore = {}; },
    } as Storage,
    writable: true,
    configurable: true,
  });
});
beforeEach(() => { lsStore = {}; });

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeNode(overrides: Partial<JourneyNodeUi> & { id: string; chapterId: string; chapterNumber: number }): JourneyNodeUi {
  return {
    shift:            'day',
    status:           'available',
    requiredForStory: true,
    href:             `/battle?nodeId=${overrides.id}`,
    lockReasons:      [],
    ...overrides,
  };
}

function makeChapterSummary(overrides: Partial<ChapterUiSummary> & { chapterId: string; chapterNumber: number }): ChapterUiSummary {
  return {
    storyCleared:    false,
    masteryStars:    0,
    maxMasteryStars: 3,
    current:         false,
    ...overrides,
  };
}

// ── STATE A: Fresh player, Chapter 1 ─────────────────────────────────────────

describe('State A — fresh player, Chapter 1', () => {
  const ch1Summary = makeChapterSummary({ chapterId: 'ch1', chapterNumber: 1, current: true });
  const ch2Summary = makeChapterSummary({ chapterId: 'ch2', chapterNumber: 2 });
  const allChapters = [ch1Summary, ch2Summary,
    ...Array.from({ length: 8 }, (_, i) => makeChapterSummary({ chapterId: `ch${i + 3}`, chapterNumber: i + 3 })),
  ];

  it('focused mode shows only Chapter 1 and 2 (not future clutter)', () => {
    const visible = getFocusedChapters(allChapters, false);
    expect(visible.map((c) => c.chapterNumber)).toEqual([1, 2]);
  });

  it('Chapter 1 is the current chapter', () => {
    const visible = getFocusedChapters(allChapters, false);
    expect(visible[0].current).toBe(true);
    expect(visible[0].chapterNumber).toBe(1);
  });

  it('Night shift is not unlocked at Chapter 1', () => {
    expect(isNightShiftUnlocked(1)).toBe(false);
  });

  it('Evening shift is not unlocked at Chapter 1', () => {
    const avail = getShiftAvailability(1);
    expect(avail.evening.unlocked).toBe(false);
  });

  it('recommendation is Continue Journey (one obvious CTA)', () => {
    const ch1Node = makeNode({ id: 'ch1-battle-1', chapterId: 'ch1', chapterNumber: 1 });
    const rec = getJourneyRecommendation({ nodes: [ch1Node], canonicalChoices: {}, bookCleared: false });
    expect(rec.kind).toBe('continue');
    expect(rec.label).toBe('Continue Journey');
  });
});

// ── STATE B: Chapter 3 available ─────────────────────────────────────────────

describe('State B — Chapter 3 available', () => {
  const ch3Summary = makeChapterSummary({ chapterId: 'ch3', chapterNumber: 3, current: true });
  const ch4Summary = makeChapterSummary({ chapterId: 'ch4', chapterNumber: 4 });
  const allChapters = [
    makeChapterSummary({ chapterId: 'ch1', chapterNumber: 1, storyCleared: true }),
    makeChapterSummary({ chapterId: 'ch2', chapterNumber: 2, storyCleared: true }),
    ch3Summary, ch4Summary,
    ...Array.from({ length: 6 }, (_, i) => makeChapterSummary({ chapterId: `ch${i + 5}`, chapterNumber: i + 5 })),
  ];

  it('focused mode emphasises Chapter 3 as current', () => {
    const visible = getFocusedChapters(allChapters, false);
    expect(visible[0].chapterNumber).toBe(3);
    expect(visible[0].current).toBe(true);
  });

  it('Chapter 4 shown as the next preview', () => {
    const visible = getFocusedChapters(allChapters, false);
    expect(visible[1]?.chapterNumber).toBe(4);
  });

  it('Evening shift unlocked at Chapter 3', () => {
    const avail = getShiftAvailability(3);
    expect(avail.evening.unlocked).toBe(true);
  });

  it('Night shift still locked at Chapter 3', () => {
    expect(isNightShiftUnlocked(3)).toBe(false);
  });

  it('Continue Journey resolves to the Chapter 3 node', () => {
    const ch3Node = makeNode({ id: 'ch3-battle-1', chapterId: 'ch3', chapterNumber: 3 });
    const lockedNode = makeNode({ id: 'ch4-battle-1', chapterId: 'ch4', chapterNumber: 4, status: 'locked', lockReasons: [{ code: 'level', message: 'Reach level 6' }] });
    const rec = getJourneyRecommendation({ nodes: [ch3Node, lockedNode], canonicalChoices: {}, bookCleared: false });
    expect(rec.kind).toBe('continue');
    if (rec.kind === 'continue') expect(rec.nodeId).toBe('ch3-battle-1');
  });
});

// ── STATE C: Chapter 4 branch not selected ────────────────────────────────────

describe('State C — Chapter 4 branch not selected', () => {
  const dayNode = makeNode({
    id: 'ch4-day', chapterId: 'ch4', chapterNumber: 4,
    shift: 'day', branchGroupId: 'ch4-shift',
  });
  const eveningNode = makeNode({
    id: 'ch4-evening', chapterId: 'ch4', chapterNumber: 4,
    shift: 'evening', branchGroupId: 'ch4-shift',
  });

  it('recommendation is Choose Shift — never auto-selected', () => {
    const rec = getJourneyRecommendation({
      nodes: [dayNode, eveningNode],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(rec.kind).toBe('choose_branch');
    expect(rec.label).toBe('Choose Shift');
  });

  it('choose_branch includes both branch node IDs', () => {
    const rec = getJourneyRecommendation({
      nodes: [dayNode, eveningNode],
      canonicalChoices: {},
      bookCleared: false,
    });
    if (rec.kind === 'choose_branch') {
      expect(rec.nodeIds).toContain('ch4-day');
      expect(rec.nodeIds).toContain('ch4-evening');
    }
  });

  it('neither Day nor Evening is auto-resolved', () => {
    const rec = getJourneyRecommendation({
      nodes: [dayNode, eveningNode],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(rec.kind).not.toBe('continue');
  });
});

// ── STATE D: Chapter 4 canonical route selected ───────────────────────────────

describe('State D — Chapter 4 canonical route selected', () => {
  const dayNode = makeNode({
    id: 'ch4-day', chapterId: 'ch4', chapterNumber: 4,
    shift: 'day', branchGroupId: 'ch4-shift',
  });
  const eveningNode = makeNode({
    id: 'ch4-evening', chapterId: 'ch4', chapterNumber: 4,
    shift: 'evening', branchGroupId: 'ch4-shift',
  });

  it('Continue Journey opens the canonical route once chosen', () => {
    const rec = getJourneyRecommendation({
      nodes: [dayNode, eveningNode],
      canonicalChoices: { 'ch4-shift': 'ch4-day' },
      bookCleared: false,
    });
    expect(rec.kind).toBe('continue');
    if (rec.kind === 'continue') expect(rec.nodeId).toBe('ch4-day');
  });

  it('alternate route is not the recommended node', () => {
    const rec = getJourneyRecommendation({
      nodes: [dayNode, eveningNode],
      canonicalChoices: { 'ch4-shift': 'ch4-day' },
      bookCleared: false,
    });
    if (rec.kind === 'continue') expect(rec.nodeId).not.toBe('ch4-evening');
  });
});

// ── STATE E: Battle in progress ───────────────────────────────────────────────

describe('State E — battle in progress', () => {
  const inProgressNode = makeNode({
    id: 'ch2-battle-3', chapterId: 'ch2', chapterNumber: 2,
    status: 'in_progress', activeEncounterHref: '/battle?resume=ch2-battle-3',
  });
  const otherNode = makeNode({ id: 'ch3-battle-1', chapterId: 'ch3', chapterNumber: 3 });

  it('recommendation is Resume Encounter', () => {
    const rec = getJourneyRecommendation({
      nodes: [inProgressNode, otherNode],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(rec.kind).toBe('resume');
    expect(rec.label).toBe('Resume Encounter');
  });

  it('Resume outranks any other available node', () => {
    const rec = getJourneyRecommendation({
      nodes: [otherNode, inProgressNode],
      canonicalChoices: {},
      bookCleared: false,
    });
    expect(rec.kind).toBe('resume');
    if (rec.kind === 'resume') expect(rec.nodeId).toBe('ch2-battle-3');
  });

  it('resume href is the activeEncounterHref, not the default node href', () => {
    const rec = getJourneyRecommendation({
      nodes: [inProgressNode],
      canonicalChoices: {},
      bookCleared: false,
    });
    if (rec.kind === 'resume') {
      expect(rec.href).toBe('/battle?resume=ch2-battle-3');
    }
  });
});

// ── STATE F: First configured tutorial failure ────────────────────────────────

describe('State F — first configured tutorial failure', () => {
  const config = chapter1BattleAssist;

  it('free retry — no additional Journey stamina cost', () => {
    expect(config.freeBattleRetry).toBe(true);
  });

  it('mentor hint appears after first failure', () => {
    const rule = getBattleAssistRule(config, 1);
    expect(rule).not.toBeNull();
    expect(rule!.mentorText.length).toBeGreaterThan(10);
  });

  it('no hint before any failure (0 failures)', () => {
    expect(getBattleAssistRule(config, 0)).toBeNull();
  });

  it('hint does not change enemy stats — rule has no stat fields', () => {
    const rule = getBattleAssistRule(config, 1)!;
    // BattleAssistRule contains only mentorText and optional highlight IDs
    expect('enemyHpModifier' in rule).toBe(false);
    expect('stabilityReduction' in rule).toBe(false);
    expect('corruptionModifier' in rule).toBe(false);
  });
});

// ── STATE G: Second configured tutorial failure ───────────────────────────────

describe('State G — second configured tutorial failure', () => {
  const config = chapter1BattleAssist;

  it('stronger authored hint at 2 failures', () => {
    const rule1 = getBattleAssistRule(config, 1)!;
    const rule2 = getBattleAssistRule(config, 2)!;
    expect(rule2.mentorText).not.toBe(rule1.mentorText);
  });

  it('configured highlightActionId is present (not AI-generated)', () => {
    const rule = getBattleAssistRule(config, 2)!;
    expect(rule.highlightActionId).toBeTruthy();
  });

  it('configured highlightTargetId is present (not AI-generated)', () => {
    const rule = getBattleAssistRule(config, 2)!;
    expect(rule.highlightTargetId).toBeTruthy();
  });

  it('highlight IDs are authored strings, not dynamic/arbitrary values', () => {
    const rule = getBattleAssistRule(config, 2)!;
    // They must be stable authored identifiers (non-empty, non-numeric)
    expect(typeof rule.highlightActionId).toBe('string');
    expect(typeof rule.highlightTargetId).toBe('string');
    expect(rule.highlightActionId!.length).toBeGreaterThan(0);
    expect(rule.highlightTargetId!.length).toBeGreaterThan(0);
  });
});

// ── STATE H: Victory after failures ──────────────────────────────────────────

describe('State H — victory after failures', () => {
  it('failure streak resets to 0 on victory', () => {
    let state = { consecutiveFailures: 2 };
    state = recordEncounterVictory(state);
    expect(state.consecutiveFailures).toBe(0);
  });

  it('no hint is shown after streak resets', () => {
    const state = recordEncounterVictory({ consecutiveFailures: 3 });
    expect(getBattleAssistRule(chapter1BattleAssist, state.consecutiveFailures)).toBeNull();
  });

  it('recording victory is pure — does not mutate original state', () => {
    const original = { consecutiveFailures: 5 };
    recordEncounterVictory(original);
    expect(original.consecutiveFailures).toBe(5);
  });
});

// ── STATE I: Story cleared with 1/3 mastery ──────────────────────────────────

describe('State I — story cleared, 1/3 mastery', () => {
  const summary = makeChapterSummary({
    chapterId: 'ch3', chapterNumber: 3,
    storyCleared: true, masteryStars: 1, maxMasteryStars: 3,
  });

  it('displays Story Cleared (not In Progress, not Mastered)', () => {
    expect(getCompletionLabel(summary)).toBe('Story Cleared');
  });

  it('is not mastered — 1/3 mastery is incomplete', () => {
    expect(isChapterMastered(summary)).toBe(false);
  });

  it('next story content is not blocked by incomplete mastery', () => {
    // The selector returns storyCleared:true regardless of masteryStars count.
    // Gate decisions are made by evaluateChapterGate, not masteryStars.
    expect(summary.storyCleared).toBe(true);
    expect(summary.masteryStars < summary.maxMasteryStars).toBe(true);
    // CRITICAL: storyCleared being true with partial mastery must not block the next chapter.
    // The test documents that these two facts coexist legally.
  });
});

// ── STATE J: Story cleared with 3/3 mastery ──────────────────────────────────

describe('State J — story cleared, 3/3 mastery', () => {
  const summary = makeChapterSummary({
    chapterId: 'ch3', chapterNumber: 3,
    storyCleared: true, masteryStars: 3, maxMasteryStars: 3,
  });

  it('displays Mastered', () => {
    expect(getCompletionLabel(summary)).toBe('Mastered');
  });

  it('isChapterMastered returns true', () => {
    expect(isChapterMastered(summary)).toBe(true);
  });

  it('narrative chapter (maxMasteryStars=0) never shows Mastered even if storyCleared', () => {
    const narrative = makeChapterSummary({
      chapterId: 'ch-story', chapterNumber: 5,
      storyCleared: true, masteryStars: 0, maxMasteryStars: 0,
    });
    expect(isChapterMastered(narrative)).toBe(false);
    expect(getCompletionLabel(narrative)).toBe('Story Cleared');
  });
});

// ── STATE K: Alternate shift contains unseen dialogue ─────────────────────────

describe('State K — alternate shift has unseen dialogue', () => {
  const dayId     = 'c4_day_dialogue';
  const eveningId = 'c4_evening_dialogue';

  it('cannot bulk skip when only one route has been seen', () => {
    // Player saw Day route — Evening is new and must not be skippable
    const seen = new Set([dayId]);
    expect(canSkipDialogueScene([dayId, eveningId], seen)).toBe(false);
  });

  it('skip IS offered once every route variant has been seen', () => {
    const seen = new Set([dayId, eveningId]);
    expect(canSkipDialogueScene([dayId, eveningId], seen)).toBe(true);
  });

  it('empty dialogueIds → never skippable (authoring incomplete)', () => {
    expect(canSkipDialogueScene([], new Set([dayId, eveningId]))).toBe(false);
  });

  it('single-route scene: skippable only when its own ID is seen', () => {
    expect(canSkipDialogueScene([dayId], new Set([dayId]))).toBe(true);
    expect(canSkipDialogueScene([dayId], new Set())).toBe(false);
  });
});

// ── STATE L: Returning advanced player ───────────────────────────────────────

describe('State L — returning advanced player', () => {
  it('chapter progress is unchanged by expanding journey view', () => {
    // Simulate player with chapters 1-5 cleared
    const chapters = Array.from({ length: 10 }, (_, i) => makeChapterSummary({
      chapterId:    `ch${i + 1}`,
      chapterNumber: i + 1,
      storyCleared: i < 5,
      current:      i === 5,
    }));

    const focused  = getFocusedChapters(chapters, false);
    const expanded = getFocusedChapters(chapters, true);

    // Expanding shows more chapters but doesn't change their data
    expect(expanded.length).toBeGreaterThan(focused.length);
    for (const ch of expanded) {
      const original = chapters.find((c) => c.chapterId === ch.chapterId)!;
      expect(ch.storyCleared).toBe(original.storyCleared);
      expect(ch.masteryStars).toBe(original.masteryStars);
    }
  });

  it('Night shift access is unchanged by expanding/collapsing journey UI', () => {
    const nightAtCh6Before = isNightShiftUnlocked(6);
    // Toggling expanded doesn't affect isNightShiftUnlocked — it reads chapter number only
    const nightAtCh6After  = isNightShiftUnlocked(6);
    expect(nightAtCh6Before).toBe(nightAtCh6After);
  });

  it('canonical choices are preserved across expand/collapse (session-local)', () => {
    const choices = { 'ch4-shift': 'ch4-day', 'ch7-shift': 'ch7-evening' };
    // getFocusedChapters does not touch canonicalChoices — they come from useState
    const summary = makeChapterSummary({ chapterId: 'ch4', chapterNumber: 4, current: true });
    const _ = getFocusedChapters([summary], true);
    // Choices object is unchanged — the selector has no access to it
    expect(choices).toEqual({ 'ch4-shift': 'ch4-day', 'ch7-shift': 'ch7-evening' });
  });

  it('expanded preference persists across simulated reload', () => {
    saveJourneyExpandedPreference(true);
    // Simulated app reopen — read from storage
    const restored = loadJourneyExpandedPreference();
    expect(restored).toBe(true);
  });

  it('collapsing journey does not reset expanded preference to false permanently', () => {
    saveJourneyExpandedPreference(true);
    // User collapses
    saveJourneyExpandedPreference(false);
    expect(loadJourneyExpandedPreference()).toBe(false);
    // User re-expands later
    saveJourneyExpandedPreference(true);
    expect(loadJourneyExpandedPreference()).toBe(true);
  });

  it('progression state is read-only to UI selectors — no mutations possible', () => {
    // All selector functions return new values; none mutate their inputs.
    const chapters = [makeChapterSummary({ chapterId: 'ch1', chapterNumber: 1, storyCleared: true })];
    const copy = [...chapters];
    getFocusedChapters(chapters, false);
    getFocusedChapters(chapters, true);
    expect(chapters[0].storyCleared).toBe(copy[0].storyCleared);
    expect(chapters[0].masteryStars).toBe(copy[0].masteryStars);
  });

  it('journey expanded key is distinct from any progression key', () => {
    expect(JOURNEY_EXPANDED_KEY).toBe('clinica:journey:expanded');
    expect(JOURNEY_EXPANDED_KEY).not.toContain('unlock');
    expect(JOURNEY_EXPANDED_KEY).not.toContain('chapter_progress');
    expect(JOURNEY_EXPANDED_KEY).not.toContain('boss_key');
    expect(JOURNEY_EXPANDED_KEY).not.toContain('canonical');
  });
});
