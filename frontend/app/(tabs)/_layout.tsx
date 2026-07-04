import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "@/src/theme/colors";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const tabH = 50 + bottomPad;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.brand,
        tabBarInactiveTintColor: COLORS.onSurfaceTertiary,
        tabBarStyle: {
          backgroundColor: COLORS.surfaceSecondary,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: tabH,
          paddingTop: 6,
          paddingBottom: bottomPad,
        },
        tabBarLabelStyle: { fontSize: 10, letterSpacing: 1, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="shop"
        options={{
          title: "SHOP",
          tabBarButtonTestID: "tab-shop",
          tabBarIcon: ({ color, size }) => <Ionicons name="storefront" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="heroes"
        options={{
          title: "HEROES",
          tabBarButtonTestID: "tab-heroes",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: "SHIFT",
          tabBarButtonTestID: "tab-shift",
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="kingdom"
        options={{
          title: "REALM",
          tabBarButtonTestID: "tab-kingdom",
          tabBarIcon: ({ color, size }) => <Ionicons name="business" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="faction"
        options={{
          title: "FACTION",
          tabBarButtonTestID: "tab-faction",
          tabBarIcon: ({ color, size }) => <Ionicons name="flag" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          tabBarButtonTestID: "tab-profile",
        }}
      />
      <Tabs.Screen
        name="codex"
        options={{
          href: null,
          tabBarButtonTestID: "tab-codex",
        }}
      />
    </Tabs>
  );
}
