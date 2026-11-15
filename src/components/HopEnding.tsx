import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GrantedCard } from "@/components/GrantedCard";
import { PhotoPanel } from "@/components/PhotoPanel";
import { Button, Card, ErrorText, Field, Muted, errorMessage } from "@/components/ui";
import { colors } from "@/lib/theme";

/** The ending as one link holder sees it: their verdict, the locked "waiting" state, or the reveal. */
export function HopEnding({ hopId }: { hopId: Id<"hops"> }) {
  const data = useQuery(api.endings.forHop, { hopId });
  const setMatchContact = useMutation(api.endings.setMatchContact);
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (!data) return null;

  if (data.ending) return <GrantedCard wishId={data.wishId} ending={data.ending} />;

  if (data.role === "pending") {
    return (
      <Card testID="ending-pending">
        <Text style={styles.title}>Sent to {data.wisherName}</Text>
        <Muted>They'll see your intro and the vouches above you. Fingers crossed!</Muted>
      </Card>
    );
  }

  if (data.role === "rejected" && data.status === "traveling") {
    return (
      <Card testID="ending-not-quite">
        <Text style={styles.title}>Not quite this time</Text>
        <Muted>{data.wisherName} is still looking, and the wish keeps traveling. Thanks for raising your hand!</Muted>
      </Card>
    );
  }

  if (data.status === "faded") {
    return (
      <Card testID="ending-faded">
        <Text style={styles.title}>This wish has faded</Text>
        <Muted>Thanks for being part of the ripple.</Muted>
      </Card>
    );
  }

  if (data.status !== "found") return null;

  if (data.meetMissed) {
    return (
      <Card testID="ending-missed">
        <Text style={styles.title}>The ending stays locked</Text>
        <Muted>They didn't add a photo within 7 days. Thanks for being part of the ripple.</Muted>
      </Card>
    );
  }

  if (data.role !== "match") {
    return (
      <Card testID="ending-locked">
        <Text style={styles.title}>Found! Waiting for them to meet…</Text>
        <Muted>The ending unlocks for everyone on the wish once they add a photo together.</Muted>
      </Card>
    );
  }

  return (
    <>
      <Card testID="ending-match">
        <Text style={styles.title}>{data.wisherName} said yes, it's you! 🎉</Text>
        {data.wisherContact ? (
          <Text testID="ending-wisher-contact" style={styles.contact} selectable>
            Reach {data.wisherName}: {data.wisherContact}
          </Text>
        ) : null}
        {data.hasOwnContact ? (
          <Muted>{data.wisherName} has your contact too.</Muted>
        ) : (
          <>
            <Field
              label={`Leave one contact for ${data.wisherName}`}
              value={contact}
              onChangeText={setContact}
              placeholder="Phone, WeChat or Instagram"
              testID="ending-match-contact"
            />
            <ErrorText error={error} />
            <Button
              testID="ending-match-contact-save"
              title="Share my contact"
              disabled={!contact.trim()}
              onPress={() => setMatchContact({ hopId, contact }).catch((e) => setError(errorMessage(e)))}
            />
          </>
        )}
      </Card>
      <PhotoPanel
        wishId={data.wishId}
        party={{ hopId }}
        me="match"
        otherName={data.wisherName}
        photo={data.photo}
        meetDeadline={data.meetDeadline}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  contact: { fontSize: 16, fontWeight: "700", color: colors.red },
});
