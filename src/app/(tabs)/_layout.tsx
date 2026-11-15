import { Tabs, useRouter } from "expo-router";
import { Text, type ColorValue } from "react-native";

import { colors } from "@/lib/theme";

function Glyph({ char, color }: { char: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color, fontWeight: "800" }}>{char}</Text>;
}

export default function TabsLayout() {
  const router = useRouter();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.cream, borderTopColor: colors.line },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "The well", tabBarButtonTestID: "tab-well", tabBarIcon: ({ color }) => <Glyph char="◎" color={color} /> }}
      />
      <Tabs.Screen
        name="new"
        options={{ title: "Toss", tabBarButtonTestID: "tab-toss", tabBarIcon: ({ color }) => <Glyph char="+" color={color} /> }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push("/toss");
          },
        }}
      />
      <Tabs.Screen
        name="wishes"
        options={{ title: "My wishes", tabBarButtonTestID: "tab-wishes", tabBarIcon: ({ color }) => <Glyph char="✦" color={color} /> }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: "Me", tabBarButtonTestID: "tab-me", tabBarIcon: ({ color }) => <Glyph char="☺" color={color} /> }}
      />
    </Tabs>
  );
}
