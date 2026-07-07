import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/src/theme/colors";

/**
 * Legacy onboarding route — redirects to the current Post-Recall flow.
 * The old 5-question quiz has been replaced by the Prologue → Post-Recall
 * → Reminiscence sequence. This file is kept so the route does not 404,
 * but nothing in the app should navigate here directly.
 */
export default function OnboardingRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/post-recall");
  }, [router]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.surface, alignItems: "center", justifyContent: "center" }}>
      <View>
        <ActivityIndicator color={COLORS.brand} />
      </View>
    </SafeAreaView>
  );
}
