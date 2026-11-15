import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { Platform, StyleSheet, Text } from "react-native";

import { Button, Card, Muted } from "@/components/ui";
import { colors } from "@/lib/theme";

/** After helping: the reason to install is your own wish, routed by the well. */
export function GetTheApp() {
  const router = useRouter();
  const web = Platform.OS === "web";
  return (
    <Card testID="get-the-app">
      <Text style={styles.title}>Now make a wish of your own</Text>
      <Muted>
        You helped one travel, so you start with a wish. Ask for a drum buddy, a local in Tokyo, someone who has been
        where you are going. The well suggests which friend to start with.
      </Muted>
      <Button
        testID="get-the-app-button"
        title={web ? "Get Wishwell and toss a wish" : "Toss a wish"}
        onPress={() => {
          if (!web) return router.push("/toss");
          void Linking.openURL(process.env.EXPO_PUBLIC_APP_URL ?? window.location.origin);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
});
