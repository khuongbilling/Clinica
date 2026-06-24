import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { usePlayer } from "@/src/game/store";
import { COLORS, SPACING } from "@/src/theme/colors";

export default function Boot() {
  const { player, loading } = usePlayer();

  if (loading) {
    return (
      <View style={styles.container} testID="boot-loading">
        <ActivityIndicator color={COLORS.brand} size="large" />
        <Text style={styles.title}>CLINICA</Text>
        <Text style={styles.subtitle}>Kingdom of Healing</Text>
      </View>
    );
  }

  if (!player) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  title: {
    color: COLORS.brand,
    fontSize: 36,
    letterSpacing: 6,
    fontWeight: "300",
    marginTop: SPACING.lg,
  },
  subtitle: {
    color: COLORS.onSurfaceTertiary,
    fontSize: 14,
    letterSpacing: 2,
  },
});
