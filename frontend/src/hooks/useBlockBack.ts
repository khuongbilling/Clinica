import { useEffect } from "react";
import { BackHandler, Platform } from "react-native";

interface BlockBackOptions {
  active?: boolean;
  message?: string;
}

/**
 * Blocks all back-navigation for the lifetime of the calling screen's mount.
 *
 * - Native (Android): registers a BackHandler that consumes the hardware back
 *   press (returns true = handled → system ignores it).
 * - Web: pushes a sentinel history entry on mount so browser-back fires a
 *   popstate instead of leaving; the handler immediately re-pushes the
 *   sentinel to keep the player on the same URL.
 * - iOS swipe-back / expo-router "beforeRemove" must be handled per-screen
 *   via `useNavigation().addListener("beforeRemove", …)` if needed (battle.tsx
 *   already does this for the prologue boss; mini-game screens don't use
 *   the native swipe-back gesture).
 *
 * @param options.active  When false the hook is a no-op. Defaults to true so
 *                        callers can pass a reactive condition (e.g. only block
 *                        while the game is in progress).
 * @param options.message Optional short toast-style message shown on web when
 *                        back is attempted (not yet wired to UI — placeholder
 *                        for future toast integration).
 */
export function useBlockBack({ active = true }: BlockBackOptions = {}) {
  useEffect(() => {
    if (!active) return;

    if (Platform.OS !== "web") {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }

    if (typeof window === "undefined") return;

    window.history.pushState({ clinicaBlock: true }, "");

    const onPopState = () => {
      window.history.pushState({ clinicaBlock: true }, "");
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [active]);
}
