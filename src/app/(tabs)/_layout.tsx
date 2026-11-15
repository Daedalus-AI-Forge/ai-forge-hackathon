import { Tabs } from "expo-router";

import { GlassTabBar, Icon } from "@/components/ios";
import { lv } from "@/theme/tokens";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: lv.thread,
        tabBarInactiveTintColor: lv.fg,
        sceneStyle: { backgroundColor: lv.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Pool",
          tabBarButtonTestID: "tab-pool",
          tabBarIcon: ({ color, focused }) => <Icon name={focused ? "poolFill" : "pool"} size={22} color={color} />,
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
