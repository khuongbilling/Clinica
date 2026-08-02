import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { useTutorial } from "@/src/game/tutorialStore";

/**
 * Clears any in-progress tutorial overlay / highlight / blocking-scrim the
 * moment the screen loses focus or unmounts, so a mid-flow exit never leaks a
 * stale overlay onto the next screen.
 *
 * Behaviour on exit (post-fix):
 *   • The tutorial is marked **dismissed** — the overlay will NOT auto-restart
 *     on the next visit, preventing the "tutorial pops up on every tab switch"
 *     regression.
 *   • The tutorial is NOT marked **completed** — it remains available in
 *     Profile → Tutorial Replay Center / Tutorial Encyclopedia so the player
 *     can pick it up again when ready.
 *   • replayTutorial() clears the dismissed flag and restarts from step 1.
 *
 * Completion (marking as fully done) only happens via:
 *   1. The player advances past the final step (doAdvance → markDone).
 *   2. The player explicitly taps "Skip" (skipTutorial → markDone).
 *
 * The one exception is prologueBattle, which is always started through
 * replayTutorial() (not startTutorial), so replayTutorial will clear both
 * dismissed and completed flags each time the prologue battle screen loads
 * regardless of this hook.
 */
export function useClearTutorialOnExit() {
  const { clearActiveTutorial } = useTutorial();

  useFocusEffect(
    useCallback(() => {
      return () => {
        clearActiveTutorial();
      };
    }, [clearActiveTutorial]),
  );
}
