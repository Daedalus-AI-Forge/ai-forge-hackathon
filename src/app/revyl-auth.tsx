import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/components/ui";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { useDeviceId } from "@/lib/device";
import { checkBypass } from "@/lib/revylBypass";
import { colors } from "@/lib/theme";

type SignIn = (deviceId: string) => Promise<unknown>;

function useAnonymousSignIn(): SignIn {
  const { signIn } = useAuthActions();
  return (deviceId) => signIn("anonymous", { deviceId });
}

function useDeviceSignIn(): SignIn {
  const ensure = useMutation(api.users.ensure);
  return (deviceId) => ensure({ deviceId });
}

const useTestSignIn = AUTH_ENABLED ? useAnonymousSignIn : useDeviceSignIn;

export default function RevylAuth() {
  const params = useLocalSearchParams<{ token?: string; redirect?: string; role?: string }>();
  const router = useRouter();
  const deviceId = useDeviceId();
  const signIn = useTestSignIn();
  const claimDemo = useMutation(api.users.claimDemo);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) return;
    const request = checkBypass(params);
    if (typeof request === "string") {
      console.warn("Revyl auth bypass rejected:", request);
      setError(request);
      return;
    }
    (async () => {
      await signIn(deviceId);
      if (request.role === "demo") await claimDemo({ deviceId });
      await AsyncStorage.setItem("wishwell.onboarded", "1");
      router.replace(request.route);
    })().catch((e: unknown) => setError(errorMessage(e)));
  }, [deviceId]);

  return (
    <View testID="revyl-auth-screen" style={styles.container}>
      {error ? (
        <Text testID="revyl-auth-error" style={styles.error}>
          {error}
        </Text>
      ) : (
        <ActivityIndicator color={colors.red} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colors.cream },
  error: { fontSize: 16, color: colors.red, textAlign: "center" },
});
