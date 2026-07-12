import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";

interface BlockBackOptions {
  /** Set false to disable the guard without unmounting the hook. Default true. */
  active?: boolean;
  /** Called whenever a back attempt is swallowed (e.g. show a toast). */
  onBlocked?: () => void;
}

/**
 * Blocks ALL user-initiated back navigation while the screen is focused:
 *   - Android hardware back button (BackHandler)
 *   - iOS swipe-back + in-app router.back() (navigation.beforeRemove, filtered
 *     to back-type actions only so router.replace / router.push forward exits
 *     always pass through)
 *   - Browser back button on web (history sentinel: push a same-URL entry and
 *     re-push it on every popstate so back never leaves the screen)
 *
 * Forward navigation (router.replace / router.push) is never blocked. If a
 * screen has a legitimate router.back() exit (e.g. closing a story scene back
 * to its gallery), call the returned `allowNextBack()` immediately before it.
 */
export function useBlockBack(options?: BlockBackOptions) {
  const active = options?.active ?? true;
  const navigation = useNavigation();

  // Refs so the listeners always see the latest values without re-subscribing.
  const onBlockedRef = useRef(options?.onBlocked);
  onBlockedRef.current = options?.onBlocked;
  const allowRef = useRef(false);

  const allowNextBack = useCallback(() => {
    allowRef.current = true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!active) return;

      // 1) Android hardware back button.
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (allowRef.current) return false;
        onBlockedRef.current?.();
        return true;
      });

      // 2) iOS swipe-back and any in-app back()/pop dispatch. Only back-type
      // actions are prevented — REPLACE / NAVIGATE / PUSH (forward exits such
      // as finishing a battle or a deliberate "Return to hub" replace) always
      // pass through, so this guard can never trap the player on the screen.
      const onBeforeRemove = (e: any) => {
        const type = e?.data?.action?.type;
        if (type !== "GO_BACK" && type !== "POP" && type !== "POP_TO_TOP") return;
        if (allowRef.current) return;
        e.preventDefault();
        onBlockedRef.current?.();
      };
      navigation.addListener("beforeRemove", onBeforeRemove);

      // 3) Browser back button (web). Push a sentinel history entry for the
      // same URL; when the user presses back, the popstate lands on the real
      // entry (same URL, so the router does not navigate) and we immediately
      // re-push the sentinel. A forward router.replace() replaces the sentinel
      // itself, so no stray entry is left behind on legitimate exits.
      let onPop: (() => void) | null = null;
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.history.pushState({ clinicaBlockBack: true }, "", window.location.href);
        onPop = () => {
          if (allowRef.current) return;
          window.history.pushState({ clinicaBlockBack: true }, "", window.location.href);
          onBlockedRef.current?.();
        };
        window.addEventListener("popstate", onPop);
      }

      return () => {
        sub.remove();
        navigation.removeListener("beforeRemove", onBeforeRemove);
        if (onPop) window.removeEventListener("popstate", onPop);
      };
    }, [active, navigation]),
  );

  return { allowNextBack };
}
