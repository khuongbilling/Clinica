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
        name="index"
        options={{
          title: "RUN",
          tabBarButtonTestID: "tab-run",
          tabBarIcon: ({ color, size }) => <Ionicons name="flame" size={size} color={color} />,
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
        name="codex"
        options={{
          title: "CODEX",
          tabBarButtonTestID: "tab-codex",
          tabBarIcon: ({ color, size }) => <Ionicons name="book" size={size} color={color} />,
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
        name="profile"
        options={{
          title: "PROFILE",
          tabBarButtonTestID: "tab-profile",
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
