import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text } from "react-native";

import { api } from "@/convex/_generated/api";
import { CenterScreen } from "@/components/ios";
import { errorMessage } from "@/components/ui";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { useDeviceId } from "@/lib/device";
import { checkBypass } from "@/lib/revylBypass";
import { lv, type } from "@/theme/tokens";

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
    <CenterScreen testID="revyl-auth-screen">
      {error ? (
        <Text testID="revyl-auth-error" style={styles.error}>
          {error}
        </Text>
      ) : (
        <ActivityIndicator color={lv.tint} />
      )}
    </CenterScreen>
  );
}

const styles = StyleSheet.create({
  error: { ...type.callout, color: lv.destructive, textAlign: "center" },
});
