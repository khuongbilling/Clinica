import { defineConfig } from 'vitest/config';

/**
 * This project keeps two intentionally separate test runners:
 * - Vitest for assertion suites that import from `vitest`.
 * - Sucrase/Node for executable game-contract scripts.
 *
 * The standalone scripts share the historical `.test.ts` suffix, so discovery
 * must be explicit instead of treating every such file as a Vitest suite.
 */
export default defineConfig({
  test: {
    include: [
      'tests/activity_registry.test.ts',
      'tests/battle_assist.test.ts',
      'tests/chapter_completion.test.ts',
      'tests/chapter_completion_badge.test.ts',
      'tests/chapter_completion_render.test.ts',
      'tests/chapter_tab_badge_render.test.ts',
      'tests/dialogue_skip.test.ts',
      'tests/feature_unlocks.test.ts',
      'tests/gate_evaluation.test.ts',
      'tests/journey_expanded_preference.test.ts',
      'tests/journey_ui_selectors.test.ts',
      'tests/qa_guided_progression.test.ts',
      'tests/shift_selector.test.ts',
    ],
  },
});