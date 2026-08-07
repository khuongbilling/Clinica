import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { RealmLoadingScreen } from "@/src/components/realm/RealmLoadingScreen";
import { usePlayer } from "@/src/game/store";
import { useBlockBack } from "@/src/hooks/useBlockBack";
import { preloadAllGameAssets } from "@/src/game/preloadAll";
import { resolveEntryRoute } from "@/src/game/route";

// Minimum time the preloader stays up even if assets warm instantly — keeps the
// hint from flashing by and gives the illustration a beat to be seen.
const MIN_VISIBLE_MS = 2400;
// Fail-open cap: never let the preloader hang forever if a native prefetch stalls
// (the web path has its own ceiling in prefetchModules; this covers native too).
const MAX_WAIT_MS = 12000;

export default function Preloader() {
  const router = useRouter();
  const { player, loading } = usePlayer();
  const { qa_skip } = useLocalSearchParams<{ qa_skip?: string }>();
  // DEV ONLY: ?qa_skip=1 bypasses asset loading timers for screenshot QA
  const skipForQA = qa_skip === "1";
  const [assetsReady, setAssetsReady] = useState(skipForQA);
  const [minElapsed, setMinElapsed]   = useState(skipForQA);

  // Backing out of the preloader would land on the dead title/index route —
  // block it; the forward replace to the resolved entry route passes through.
  useBlockBack();
  const navigated = useRef(false);

  useEffect(() => {
    if (skipForQA) return; // timers not needed when skipping
    let alive = true;
    const minTimer = setTimeout(() => {
      if (alive) setMinElapsed(true);
    }, MIN_VISIBLE_MS);
    const capTimer = setTimeout(() => {
      if (alive) setAssetsReady(true);
    }, MAX_WAIT_MS);
    preloadAllGameAssets().finally(() => {
      if (alive) setAssetsReady(true);
    });
    return () => {
      alive = false;
      clearTimeout(minTimer);
      clearTimeout(capTimer);
    };
  }, []);

  useEffect(() => {
    if (navigated.current) return;
    if (minElapsed && assetsReady && !loading) {
      navigated.current = true;
      const nav = () => router.replace(resolveEntryRoute(player) as never);
      // In qa_skip mode every condition is true on the first effect flush, before
      // the Root Layout has finished mounting. Defer by one tick to let it settle.
      if (skipForQA) { setTimeout(nav, 50); } else { nav(); }
    }
  }, [minElapsed, assetsReady, loading, player, router, skipForQA]);

  // DEV ONLY: skip visual so screenshot tools wait for the hub to paint
  if (skipForQA) return null;
  return <RealmLoadingScreen />;
}
