import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { DailyPulseToast } from "@/src/components/DailyPulseToast";
import { PlayerProvider } from "@/src/game/store";
import { preloadTabAssets } from "@/src/game/tabAssets";
import { TutorialProvider } from "@/src/game/tutorialStore";
import { TestSessionProvider } from "@/src/game/testSession";
import { COLORS } from "@/src/theme/colors";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

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
          <TutorialProvider>
            <TestSessionProvider>
              <StatusBar barStyle="light-content" backgroundColor={COLORS.surface} />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: COLORS.surface },
                  animation: "fade",
                }}
              />
              <DailyPulseToast />
            </TestSessionProvider>
          </TutorialProvider>
        </PlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
