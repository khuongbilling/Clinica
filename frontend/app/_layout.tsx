import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { useCinematicFonts } from "@/src/hooks/use-cinematic-fonts";
import { DailyPulseToast } from "@/src/components/DailyPulseToast";
import { PlayerProvider } from "@/src/game/store";
import { SettingsProvider } from "@/src/game/settingsStore";
import { preloadTabAssets } from "@/src/game/tabAssets";
import { TutorialProvider } from "@/src/game/tutorialStore";
import { COLORS } from "@/src/theme/colors";
import { validateRealmRoutes } from "@/src/game/routes";
import { REALM_BUILDINGS } from "@/src/game/realm";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

// Validate realm building deep-links at startup so stale route strings
// surface immediately in dev rather than silently breaking building modals.
if (__DEV__) {
  validateRealmRoutes(REALM_BUILDINGS);
}

// ── Font-timeout safety net ──────────────────────────────────────────────────
// expo-font's web loader calls FontFaceObserver.load(null, 6000) and returns
// the raw Promise without a .catch.  On slow mobile connections the font can
// miss the 6-second window and the rejection goes unhandled, crashing the app.
//
// This handler is installed at module load time (before any font loading
// starts) so it is guaranteed to be present when the rejection fires.
// It silences only font-timeout rejections — all other rejections propagate.
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    const msg: string = e?.reason?.message ?? '';
    if (msg.endsWith('ms timeout exceeded')) {
      // Fonts are cosmetic only — the app degrades gracefully without them.
      e.preventDefault();
    }
  });
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();
  // Warm the prologue cinematic fonts at launch.  Return value is explicitly
  // destructured so useFonts' internal error state is consumed — this prevents
  // the async rejection from leaking past the hook's state handler on slow
  // connections where the 6-second fontfaceobserver timeout fires.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_cfLoaded, _cfError] = useCinematicFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    // Warm every bottom-tab image once at launch so tab switches are instant.
    preloadTabAssets();
  }, []);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.surface }}>
      <SafeAreaProvider>
        <PlayerProvider>
          <SettingsProvider>
          <TutorialProvider>
              <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: COLORS.surface },
                  animation: "fade",
                }}
              />
              <DailyPulseToast />
          </TutorialProvider>
          </SettingsProvider>
        </PlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
