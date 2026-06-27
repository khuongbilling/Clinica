import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { PlayerProvider } from "@/src/game/store";
import { TutorialProvider } from "@/src/game/tutorialStore";
import { TestSessionProvider } from "@/src/game/testSession";
import { TestPanel } from "@/src/components/TestPanel";
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
              <TestPanel />
            </TestSessionProvider>
          </TutorialProvider>
        </PlayerProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
