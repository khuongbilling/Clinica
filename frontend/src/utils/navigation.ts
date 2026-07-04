import type { Router } from "expo-router";

// Push 5.5 consistency pass: many screens are reachable via a direct URL /
// deep link (no history to pop), which used to leave a bare `router.back()`
// stuck on-screen with a dead button. Always fall back to a sensible parent
// route when there's nothing to pop back to.
export function goBack(router: Router, fallback: Parameters<Router["replace"]>[0]) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
