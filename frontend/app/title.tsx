import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

import { COLORS } from "@/src/theme/colors";

const SPLASH = require("../assets/images/title_splash.png");

export default function Title() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <ExpoImage source={SPLASH} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />
      <LinearGradient
        colors={["rgba(6,14,20,0.78)", "transparent"]}
        locations={[0, 0.4]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "rgba(6,14,20,0.5)", "rgba(6,14,20,0.97)"]}
        locations={[0.32, 0.68, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Text style={styles.kicker}>THE KINGDOM CALLS FOR A HEALER</Text>
          <Text style={styles.title}>CLINICA</Text>
          <Text style={styles.subtitle}>Kingdom of Healing</Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => router.replace("/preloader" as never)}
            testID="start-game"
          >
            <Text style={styles.buttonText}>START GAME</Text>
          </Pressable>
          <Text style={styles.tagline}>Answer the call. Restore the realm.</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.surface },
  safe: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 28,
    paddingVertical: 20,
  },
  header: { alignItems: "center", gap: 8, marginTop: 12 },
  kicker: {
    color: COLORS.brand,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
  },
  title: {
    color: "#F4F7FB",
    fontSize: 52,
    fontWeight: "300",
    letterSpacing: 12,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  subtitle: {
    color: "#C8CDD8",
    fontSize: 14,
    letterSpacing: 4,
  },
  footer: { alignItems: "center", gap: 16, marginBottom: 8 },
  button: {
    backgroundColor: COLORS.brand,
    paddingVertical: 17,
    paddingHorizontal: 64,
    borderRadius: 999,
    shadowColor: COLORS.brand,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  buttonText: {
    color: COLORS.onBrand,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 3,
  },
  tagline: {
    color: "#C8CDD8",
    fontSize: 13,
    fontStyle: "italic",
    letterSpacing: 0.5,
  },
});
