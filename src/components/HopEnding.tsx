import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { GrantedCard } from "@/components/GrantedCard";
import { PhotoPanel } from "@/components/PhotoPanel";
import { errorMessage } from "@/components/ui";
import { DButton, DCard, DError, DField, Sub } from "@/components/lv/passon/kit";
import { lv } from "@/theme/tokens";

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
      <DCard testID="ending-pending">
        <Text style={styles.title}>Sent to {data.wisherName}</Text>
        <Sub>They'll see your intro and the vouches above you. Fingers crossed!</Sub>
      </DCard>
    );
  }

  if (data.role === "rejected" && data.status === "traveling") {
    return (
      <DCard testID="ending-not-quite">
        <Text style={styles.title}>Not quite this time</Text>
        <Sub>{data.wisherName} is still looking, and the wish keeps traveling. Thanks for raising your hand!</Sub>
      </DCard>
    );
  }

  if (data.status === "faded") {
    return (
      <DCard testID="ending-faded">
        <Text style={styles.title}>This wish has faded</Text>
        <Sub>Thanks for being part of the ripple.</Sub>
      </DCard>
    );
  }

  if (data.status !== "found") return null;

  if (data.meetMissed) {
    return (
      <DCard testID="ending-missed">
        <Text style={styles.title}>The ending stays locked</Text>
        <Sub>They didn't add a photo within 7 days. Thanks for being part of the ripple.</Sub>
      </DCard>
    );
  }

  if (data.role !== "match") {
    return (
      <DCard testID="ending-locked">
        <Text style={styles.title}>Found! Waiting for them to meet…</Text>
        <Sub>The ending unlocks for everyone on the wish once they add a photo together.</Sub>
      </DCard>
    );
  }

  return (
    <>
      <DCard testID="ending-match">
        <Text style={styles.title}>{data.wisherName} said yes, it's you! 🎉</Text>
        {data.wisherContact ? (
          <Text testID="ending-wisher-contact" style={styles.contact} selectable>
            Reach {data.wisherName}: {data.wisherContact}
          </Text>
        ) : null}
        {data.hasOwnContact ? (
          <Sub>{data.wisherName} has your contact too.</Sub>
        ) : (
          <>
            <DField
              label={`Leave one contact for ${data.wisherName}`}
              value={contact}
              onChangeText={setContact}
              placeholder="Phone, WeChat or Instagram"
              testID="ending-match-contact"
            />
            <DError error={error} />
            <DButton
              testID="ending-match-contact-save"
              title="Share my contact"
              disabled={!contact.trim()}
              onPress={() => setMatchContact({ hopId, contact }).catch((e) => setError(errorMessage(e)))}
            />
          </>
        )}
      </DCard>
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
  title: { fontSize: 18, fontWeight: "800", color: lv.fg },
  contact: { fontSize: 16, fontWeight: "700", color: lv.thread },
});
