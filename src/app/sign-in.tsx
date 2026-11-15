import { useAuthActions } from "@convex-dev/auth/react";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import { Redirect, router } from "expo-router";
import { openAuthSessionAsync } from "expo-web-browser";
import { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { PhoneSignIn } from "@/components/PhoneSignIn";
import { Button, ErrorText, Muted, errorMessage } from "@/components/ui";
import { AUTH_ENABLED } from "@/lib/authFlag";
import { colors, radius } from "@/lib/theme";
import { formScrollProps } from "@/components/keyboard";

/** Native returns to the app scheme; web returns to the current origin (must match SITE_URL). */
function redirectTarget() {
  return Platform.OS === "web" ? Linking.createURL("/") : "wishwell://";
}

function isCancel(e: unknown) {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ERR_REQUEST_CANCELED";
}

function SignInScreen() {
  const { signIn } = useAuthActions();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<"apple" | "google" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  const done = () => (router.canGoBack() ? router.back() : router.replace("/"));

  async function withApple() {
    setError(null);
    setBusy("apple");
    try {
      // Apple embeds SHA-256(nonce) in the token; the server checks it against the raw nonce.
      const nonce = Crypto.randomUUID() + Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashed,
      });
      if (!credential.identityToken) throw new Error("Apple didn't return an identity token");
      const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ");
      await signIn("apple", { idToken: credential.identityToken, nonce, ...(name ? { name } : {}) });
      done();
    } catch (e) {
      if (!isCancel(e)) setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function withGoogle() {
    setError(null);
    setBusy("google");
    try {
      const redirectTo = redirectTarget();
      const { redirect } = await signIn("google", { redirectTo });
      // Web: Convex Auth navigates the page and finishes on return.
      if (Platform.OS === "web" || !redirect) return;
      const result = await openAuthSessionAsync(redirect.toString(), redirectTo);
      if (result.type !== "success") return; // cancelled or dismissed
      const code = new URL(result.url).searchParams.get("code");
      if (!code) throw new Error("Google sign-in didn't complete");
      await signIn("google", { code });
      done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView testID="sign-in-screen" style={styles.page} contentContainerStyle={styles.container} {...formScrollProps}>
      <View style={styles.hero}>
        <Text style={styles.title}>Keep your wishes</Text>
        <Muted style={styles.center}>
          Sign in so your wishes, vouches and stars follow you to any phone. Everything you've done so far comes with you.
        </Muted>
      </View>

      <View style={styles.actions}>
        {appleAvailable ? (
          <View pointerEvents={busy ? "none" : "auto"} style={busy ? styles.dim : undefined}>
            <AppleAuthentication.AppleAuthenticationButton
              testID="sign-in-apple"
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.pill}
              style={styles.apple}
              onPress={() => void withApple()}
            />
          </View>
        ) : null}
        <Button
          title={busy === "google" ? "Opening Google…" : "Continue with Google"}
          variant="secondary"
          busy={busy === "google"}
          disabled={busy !== null}
          onPress={() => void withGoogle()}
          testID="sign-in-google"
        />
        <PhoneSignIn onDone={done} disabled={busy !== null} />
        <ErrorText error={error} />
        <Button title="Not now" variant="ghost" onPress={done} testID="sign-in-skip" />
      </View>
    </ScrollView>
  );
}

export default function SignIn() {
  if (!AUTH_ENABLED) return <Redirect href="/" />;
  return <SignInScreen />;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.cream },
  container: { flexGrow: 1, padding: 24, gap: 32, justifyContent: "center", backgroundColor: colors.cream, maxWidth: 430, width: "100%", alignSelf: "center" },
  hero: { alignItems: "center", gap: 10 },
  title: { fontSize: 28, fontWeight: "800", color: colors.ink },
  center: { textAlign: "center" },
  actions: { gap: 12 },
  apple: { height: 50, width: "100%" },
  dim: { opacity: 0.5 },
});
