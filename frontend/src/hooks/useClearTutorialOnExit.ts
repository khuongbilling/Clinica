import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { useTutorial } from "@/src/game/tutorialStore";

/**
 * Clears any in-progress tutorial (overlay, highlight target, blocking scrim,
 * guided-step state) the moment the screen loses focus or unmounts.
 *
 * Use on every screen that starts or hosts a tutorial so a mid-flow exit —
 * back navigation, deep link, tab switch — never leaks a stale overlay onto
 * the next screen. Completion is NOT recorded, so the tutorial auto-restarts
 * the next time its screen mounts.
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
