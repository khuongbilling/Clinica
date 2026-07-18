/**
 * RPGTabBar — Shared fantasy-academy tab bar.
 *
 * Donghua / jade-academy style:
 *   Active  : warm gold fill + dark text, subtle top-line accent
 *   Inactive: dark parchment, muted gold text
 *   Locked  : dimmed + lock icon, not tappable
 *   Badge   : small dot for unread counts
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { RADIUS, SPACING } from "@/src/theme/colors";
import { UI } from "@/src/theme/ui";

export interface RPGTab {
  key: string;
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  locked?: boolean;
  badge?: number;
}

interface Props {
  tabs: RPGTab[];
  activeTab: string;
  onTabPress: (key: string) => void;
}

export function RPGTabBar({ tabs, activeTab, onTabPress }: Props) {
  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          const isLocked = !!tab.locked;

          return (
            <Pressable
              key={tab.key}
              style={[
                styles.tab,
                isActive && styles.tabActive,
                isLocked && styles.tabLocked,
              ]}
              onPress={() => {
                if (!isLocked) onTabPress(tab.key);
              }}
              hitSlop={4}
            >
              {/* Active top accent line */}
              {isActive && <View style={styles.topAccent} />}

              <View style={styles.tabInner}>
                {tab.icon && (
                  <Ionicons
                    name={isLocked ? "lock-closed" : tab.icon}
                    size={13}
                    color={
                      isLocked
                        ? UI.textDim
                        : isActive
                        ? UI.onGold
                        : UI.gold
                    }
                  />
                )}
                {isLocked && !tab.icon && (
                  <Ionicons name="lock-closed" size={11} color={UI.textDim} />
                )}
                <Text
                  style={[
                    styles.tabTxt,
                    isActive && styles.tabTxtActive,
                    isLocked && styles.tabTxtLocked,
                  ]}
                  numberOfLines={1}
                >
                  {tab.label}
                </Text>

                {/* Badge dot */}
                {!!tab.badge && tab.badge > 0 && !isLocked && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeTxt}>
                      {tab.badge > 9 ? "9+" : tab.badge}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Gold divider line */}
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: UI.bgBase,
    borderBottomWidth: 1,
    borderBottomColor: UI.border,
  },
  row: {
    flexDirection: "row",
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    gap: 4,
  },
  tab: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "transparent",
    minWidth: 72,
    alignItems: "center",
    position: "relative",
    marginBottom: 4,
  },
  tabActive: {
    backgroundColor: UI.gold,
    borderColor: UI.goldDeep,
    shadowColor: UI.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  tabLocked: {
    opacity: 0.45,
    borderColor: "transparent",
  },
  tabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  tabTxt: {
    fontSize: 12,
    fontWeight: "700",
    color: UI.gold,
    letterSpacing: 0.3,
  },
  tabTxtActive: {
    color: UI.onGold,
  },
  tabTxtLocked: {
    color: UI.textDim,
  },
  topAccent: {
    position: "absolute",
    top: 0,
    left: "20%",
    right: "20%",
    height: 2.5,
    borderRadius: 2,
    backgroundColor: UI.goldSoft,
  },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  divider: {
    height: 1,
    backgroundColor: UI.border,
    marginHorizontal: SPACING.md,
  },
});
