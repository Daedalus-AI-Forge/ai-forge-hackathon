import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";

import { api } from "@/convex/_generated/api";
import { Button, Card, Muted } from "@/components/ui";

/** Me-tab account row. Only rendered when AUTH_ENABLED (needs ConvexAuthProvider). */
export function AccountCard() {
  const account = useQuery(api.users.account, {});
  const { signOut } = useAuthActions();
  const [busy, setBusy] = useState(false);
  if (account === undefined) return null;

  if (account.signedIn && account.hasAccount) {
    return (
      <Card testID="account-card">
        <Muted>Signed in{account.email ? ` as ${account.email}` : account.phone ? ` as ${account.phone}` : " with Apple"}</Muted>
        <Button
          title="Sign out"
          variant="ghost"
          busy={busy}
          testID="sign-out"
          onPress={() => {
            setBusy(true);
            void signOut().finally(() => setBusy(false));
          }}
        />
      </Card>
    );
  }
  return (
    <Card testID="account-card">
      <Muted>You're using Wishwell without an account. Sign in to keep your wishes on any phone.</Muted>
      <Button title="Sign in" variant="secondary" testID="open-sign-in" onPress={() => router.push("/sign-in")} />
    </Card>
  );
}
