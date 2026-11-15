import { Tabs } from "expo-router";

import { TabGlyph } from "@/components/lv/shell/TabGlyph";
import { shellTabBarStyle, shellTabLabelStyle } from "@/components/lv/shell/tabBarStyle";
import { lv } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: lv.fg,
        tabBarInactiveTintColor: lv.mutedFg,
        tabBarStyle: shellTabBarStyle,
        tabBarLabelStyle: shellTabLabelStyle,
        tabBarItemStyle: { borderRadius: 999 },
        sceneStyle: { backgroundColor: lv.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Pool", tabBarButtonTestID: "tab-pool", tabBarIcon: ({ color, focused }) => <TabGlyph char="≋" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="voyages"
        options={{ title: "Voyages", tabBarButtonTestID: "tab-voyages", tabBarIcon: ({ color, focused }) => <TabGlyph char="⛵︎" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: "Me", tabBarButtonTestID: "tab-me", tabBarIcon: ({ color, focused }) => <TabGlyph char="◯" color={color} focused={focused} /> }}
      />
    </Tabs>
  );
}