/**
 * WardRestorationMap — coming-soon stub renderer for mapMode: 'ward_restoration'.
 *
 * Push 9: placeholder only. The full ward-restoration build map renderer
 * will be implemented in a future push.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { UI, SPACING } from "@/src/theme/ui";

export function WardRestorationMap() {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Ionicons name="construct" size={40} color={UI.jade} />
        <Text style={styles.title}>Ward Restoration Map</Text>
        <Text style={styles.sub}>
          A restoration and rebuild ward map is coming in a future update.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: UI.sanctuaryBg,
    alignItems:      'center',
    justifyContent:  'center',
    padding:         SPACING.xl,
  },
  card: {
    backgroundColor: UI.sanctuaryPanel,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     UI.border,
    padding:         SPACING.xl,
    alignItems:      'center',
    gap:             SPACING.md,
    maxWidth:        320,
  },
  title: {
    fontSize:   18,
    fontWeight: '700',
    color:      UI.text,
    textAlign:  'center',
  },
  sub: {
    fontSize:   14,
    color:      UI.textDim,
    textAlign:  'center',
    lineHeight: 22,
  },
});
