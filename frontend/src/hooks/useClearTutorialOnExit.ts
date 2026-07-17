import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { useTutorial } from "@/src/game/tutorialStore";

/**
 * Marks any in-progress tutorial as done and clears the overlay/highlight/
 * blocking-scrim the moment the screen loses focus or unmounts.
 *
 * Use on every screen that starts or hosts a tutorial so a mid-flow exit —
 * back navigation, deep link, tab switch — never leaks a stale overlay onto
 * the next screen.
 *
 * P19 behaviour change: completion IS now recorded on exit (via markDone
 * inside clearActiveTutorial). The player has "seen" the tutorial — it will
 * not auto-restart on the next visit. Manual replay is available from
 * Profile → Tutorial Replay Center / Tutorial Encyclopedia.
 *
 * The one exception is prologueBattle, which is always started through
 * replayTutorial() (not startTutorial), so replayTutorial will un-complete
 * it each time the prologue battle screen loads regardless of this hook.
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
