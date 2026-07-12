import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useTutorial } from "@/src/game/tutorialStore";

/**
 * Clears any active tutorial overlay when the calling screen loses navigation
 * focus (i.e. the player navigates away from that screen).
 *
 * This prevents stale tutorial state — scrim, forced-target highlight, and
 * input-blocking — from bleeding into unrelated screens.
 *
 * The tutorial is NOT marked as completed, so if the player re-enters the
 * section, `startTutorial` will restart it from step 0 as per the existing
 * progression rules.
 *
 * Usage — add one line inside any screen component that runs a tutorial:
 *   useClearTutorialOnExit();
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
