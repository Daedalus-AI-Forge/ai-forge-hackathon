import { Tabs, useRouter } from "expo-router";

import { TabGlyph } from "@/components/lv/shell/TabGlyph";
import { shellTabBarStyle, shellTabLabelStyle } from "@/components/lv/shell/tabBarStyle";
import { lv } from "@/theme/tokens";

export default function TabsLayout() {
  const router = useRouter();
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
        options={{ title: "Well", tabBarButtonTestID: "tab-well", tabBarIcon: ({ color, focused }) => <TabGlyph char="≋" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="new"
        options={{ title: "Toss a wish", tabBarButtonTestID: "tab-toss", tabBarIcon: ({ color, focused }) => <TabGlyph char="⊕" color={color} focused={focused} /> }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/toss");
          },
        }}
      />
      <Tabs.Screen
        name="wishes"
        options={{ title: "My wishes", tabBarButtonTestID: "tab-wishes", tabBarIcon: ({ color, focused }) => <TabGlyph char="✦" color={color} focused={focused} /> }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: "Me", tabBarButtonTestID: "tab-me", tabBarIcon: ({ color, focused }) => <TabGlyph char="◯" color={color} focused={focused} /> }}
      />
    </Tabs>
  );
}
