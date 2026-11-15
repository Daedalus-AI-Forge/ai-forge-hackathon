import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/convex/_generated/api";
import { Avatar, Button, Card, Field, Muted, Title } from "@/components/ui";
import { AccountCard } from "@/components/AccountCard";
import { NetworkMap } from "@/components/NetworkMap";
import { StarsCard } from "@/components/StarsCard";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { useMe } from "@/lib/device";
import { colors } from "@/lib/theme";

export default function Me() {
  const { deviceId, user } = useMe();
  const updateProfile = useMutation(api.users.updateProfile);
  const claimDemo = useMutation(api.users.claimDemo);
  const demoEnabled = useQuery(api.users.demoEnabled);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  useEffect(() => {
    if (user) {
      setName(user.name);
      setCity(user.city);
    }
  }, [user?._id]);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView testID="me-screen" contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Avatar name={user?.name || "?"} color={user?.avatar ?? colors.red} size={56} />
          <Title>{user?.name || "You"}</Title>
        </View>
        <StarsCard />
        <Card>
          <Field label="Your name" value={name} onChangeText={setName} testID="me-name" />
          <Field label="Your city" value={city} onChangeText={setCity} testID="me-city" />
          <Button title="Save" onPress={() => deviceId && void updateProfile({ deviceId, name, city })} testID="me-save" />
        </Card>
        {AUTH_ENABLED ? <AccountCard /> : null}
        {deviceId ? <NetworkMap deviceId={deviceId} /> : null}
        <Muted>Badges, reputation and "How friends see you" are coming next.</Muted>
        {demoEnabled ? (
          <Button
            title="Use demo profile (Mia, SF)"
            variant="ghost"
            testID="use-demo-profile-me"
            onPress={() => deviceId && void claimDemo({ deviceId })}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 430, width: "100%", alignSelf: "center" },
  header: { alignItems: "center", gap: 8 },
});
