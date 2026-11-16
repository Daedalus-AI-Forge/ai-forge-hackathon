import { Tabs } from "expo-router";

import { GlassTabBar, Icon } from "@/components/ios";
import { lv } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: lv.tint,
        tabBarInactiveTintColor: lv.fg,
        sceneStyle: { backgroundColor: lv.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Well",
          tabBarButtonTestID: "tab-pool",
          tabBarIcon: ({ color }) => <Icon name="sparkles" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="world"
        options={{
          title: "World",
          tabBarButtonTestID: "tab-world",
          tabBarIcon: ({ color, focused }) => <Icon name={focused ? "worldFill" : "world"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="voyages"
        options={{
          title: "Voyages",
          tabBarButtonTestID: "tab-voyages",
          tabBarIcon: ({ color, focused }) => <Icon name={focused ? "voyagesFill" : "voyages"} size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          tabBarButtonTestID: "tab-me",
          tabBarIcon: ({ color, focused }) => <Icon name={focused ? "meFill" : "me"} size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
