/**
 * tests/journey_expanded_preference.test.ts
 *
 * Tests for journey expanded preference persistence.
 * Runs in the default node environment — localStorage is mocked on globalThis.
 *
 * INVARIANTS:
 *   1. Default is false (focused mode) — not expanded.
 *   2. save(true) → load() === true; save(false) → load() === false.
 *   3. Errors in localStorage are swallowed — load returns false, save is no-op.
 *   4. The key is 'clinica:journey:expanded'.
 *   5. The module never touches any other key.
 */

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  JOURNEY_EXPANDED_KEY,
  loadJourneyExpandedPreference,
  saveJourneyExpandedPreference,
} from '../src/features/journey/ui/journeyExpandedPreference';

// ── localStorage stub (node-safe) ─────────────────────────────────────────────

let store: Record<string, string> = {};

const makeStorage = (overrides?: Partial<Storage>): Storage =>
  ({
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear:      () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key:        (i: number) => Object.keys(store)[i] ?? null,
    ...overrides,
  } as Storage);

beforeAll(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: makeStorage(),
    writable: true,
    configurable: true,
  });
});

beforeEach(() => {
  store = {};
});

// ── Key contract ──────────────────────────────────────────────────────────────

describe('JOURNEY_EXPANDED_KEY', () => {
  it('is the canonical key string', () => {
    expect(JOURNEY_EXPANDED_KEY).toBe('clinica:journey:expanded');
  });
});

// ── loadJourneyExpandedPreference ─────────────────────────────────────────────

describe('loadJourneyExpandedPreference', () => {
  it('defaults to false when nothing is stored', () => {
    expect(loadJourneyExpandedPreference()).toBe(false);
  });

  it('returns true after "true" is stored', () => {
    store[JOURNEY_EXPANDED_KEY] = 'true';
    expect(loadJourneyExpandedPreference()).toBe(true);
  });

  it('returns false after "false" is stored', () => {
    store[JOURNEY_EXPANDED_KEY] = 'false';
    expect(loadJourneyExpandedPreference()).toBe(false);
  });

  it('returns false for any non-"true" value (garbage resilience)', () => {
    for (const bad of ['True', 'TRUE', '1', 'yes', '', 'null', 'undefined']) {
      store[JOURNEY_EXPANDED_KEY] = bad;
      expect(loadJourneyExpandedPreference()).toBe(false);
    }
  });

  it('returns false when localStorage.getItem throws', () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      makeStorage({ getItem: () => { throw new Error('quota exceeded'); } });
    expect(loadJourneyExpandedPreference()).toBe(false);
    // Restore
    (globalThis as unknown as { localStorage: Storage }).localStorage = makeStorage();
  });
});

// ── saveJourneyExpandedPreference ─────────────────────────────────────────────

describe('saveJourneyExpandedPreference', () => {
  it('saves true as the string "true"', () => {
    saveJourneyExpandedPreference(true);
    expect(store[JOURNEY_EXPANDED_KEY]).toBe('true');
  });

  it('saves false as the string "false"', () => {
    saveJourneyExpandedPreference(false);
    expect(store[JOURNEY_EXPANDED_KEY]).toBe('false');
  });

  it('overwrites a previous value', () => {
    saveJourneyExpandedPreference(true);
    saveJourneyExpandedPreference(false);
    expect(store[JOURNEY_EXPANDED_KEY]).toBe('false');
  });

  it('does not throw when localStorage.setItem throws', () => {
    (globalThis as unknown as { localStorage: Storage }).localStorage =
      makeStorage({ setItem: () => { throw new Error('quota exceeded'); } });
    expect(() => saveJourneyExpandedPreference(true)).not.toThrow();
    // Restore
    (globalThis as unknown as { localStorage: Storage }).localStorage = makeStorage();
  });
});

// ── Round-trip ────────────────────────────────────────────────────────────────

describe('round-trip', () => {
  it('save(true) → load() === true', () => {
    saveJourneyExpandedPreference(true);
    expect(loadJourneyExpandedPreference()).toBe(true);
  });

  it('save(false) → load() === false', () => {
    saveJourneyExpandedPreference(false);
    expect(loadJourneyExpandedPreference()).toBe(false);
  });

  it('toggle cycle: true → false → true', () => {
    saveJourneyExpandedPreference(true);
    expect(loadJourneyExpandedPreference()).toBe(true);
    saveJourneyExpandedPreference(false);
    expect(loadJourneyExpandedPreference()).toBe(false);
    saveJourneyExpandedPreference(true);
    expect(loadJourneyExpandedPreference()).toBe(true);
  });
});

// ── Key isolation ─────────────────────────────────────────────────────────────

describe('key isolation', () => {
  it('save does not write to any other key', () => {
    saveJourneyExpandedPreference(true);
    expect(Object.keys(store)).toEqual([JOURNEY_EXPANDED_KEY]);
  });

  it('load does not read from a different clinica: key', () => {
    store['clinica:other:key'] = 'true';
    // JOURNEY_EXPANDED_KEY absent → false
    expect(loadJourneyExpandedPreference()).toBe(false);
  });
});
