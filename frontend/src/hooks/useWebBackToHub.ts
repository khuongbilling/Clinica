import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { Platform } from "react-native";

/**
 * Web-only: makes the browser's native back button behave exactly like the
 * screen's in-app back arrow (`router.replace(target)`).
 *
 * Hub screens (Shift, mode intros, University, Lotus Journal, World Event) are
 * usually re-entered via `router.replace` from finished battles / mini-games,
 * so the raw browser history below them still contains stale gameplay or
 * result screens. Instead of popping that stack, this hook:
 *
 *   1. Pushes a same-URL sentinel history entry while the hub is focused
 *      (skipped if the current entry is already the sentinel, so refocusing
 *      never stacks extras).
 *   2. On popstate (browser back), the pop lands on the real hub entry — the
 *      URL is identical so the router does not navigate — and we immediately
 *      `router.replace(target)`, the same clean exit as the in-app arrow.
 *
 * "Fresh" back behaviour is preserved because every hub's in-app arrow target
 * IS the page the hub is normally pushed from (tabs → Shift, Shift → mode
 * intro, Events → World Event, …), so browser back still lands where the
 * player expects.
 *
 * Does nothing on native — Android hardware back / iOS gestures are handled
 * by `useBlockBack` on the screens that need it.
 */
export function useWebBackToHub(target: string) {
  const router = useRouter();
  const targetRef = useRef(target);
  targetRef.current = target;

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "web" || typeof window === "undefined") return;

      if (!window.history.state?.clinicaHubBack) {
        window.history.pushState({ clinicaHubBack: true }, "", window.location.href);
      }

      const onPop = () => {
        router.replace(targetRef.current as any);
      };
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    }, [router]),
  );
}
