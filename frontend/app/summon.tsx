/**
 * /summon — gated entry point for the Recruitment Hall.
 *
 * Navigates deep links, legacy bookmarks, and in-app buttons here first so
 * the hall_of_heroes feature gate is always evaluated before the player
 * reaches /university/recruit.
 *
 * Gate: hall_of_heroes (Level 2).
 *   Unlocked  → replace with /university/recruit
 *   Locked    → replace with /university (the hub that shows the lock notice)
 *
 * We use router.replace so the redirect itself never sits in the back stack.
 */

import { useEffect } from "react";
import { useRouter } from "expo-router";

import { usePlayer } from "@/src/game/store";
import { useFeatureGate } from "@/src/components/FeatureGate";
import { ROUTES } from "@/src/game/routes";

export default function SummonScreen() {
  const router = useRouter();
  const { player } = usePlayer();
  const gate = useFeatureGate("hall_of_heroes");

  useEffect(() => {
    // Wait until the player has loaded so the gate reflects real data.
    if (player === null) return;

    if (gate.unlocked) {
      router.replace(ROUTES.UNI_RECRUIT);
    } else {
      // Bounce back to the University hub; it will show the lock notice.
      router.replace(ROUTES.UNIVERSITY);
    }
  }, [player, gate.unlocked]);

  // Return null — this screen is purely a redirect and never renders UI.
  return null;
}
