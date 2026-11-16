// "Meet up" card for a found wish, shown to both participants (wisher in Voyages, the claimer in
// Voyages or on the link page). Flow, all on `meetings.*` (PR #43):
//   upload:  uploadUrl → POST the image → submitPhoto   (testID meet-upload)
//   review:  the other side confirms → confirmPhoto → GRANTED   (testID meet-confirm)
// Once granted, the card swaps to the GrantedCard reveal from `link.ending`.
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Image, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cleanError } from "@/components/link/claim/errors";
import { DButton, DCard, DError, DField, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { useNow } from "@/lib/time";
import { lv, type } from "@/theme/tokens";

import { GrantedCard, type GrantedEnding } from "./GrantedCard";
import { meetCopy, otherName } from "./meetLogic";
import { CAN_PICK_PHOTO, NATIVE_PICK_NOTE, pickPhoto } from "./pickPhoto";

export type MeetingView = NonNullable<FunctionReturnType<typeof api.meetings.get>>;

export function MeetCard({ meeting, deviceId, showEndingLink = true }: { meeting: MeetingView; deviceId: string; showEndingLink?: boolean }) {
  if (meeting.stage === "granted") return <GrantedFromEnding wishId={meeting.wishId} showEndingLink={showEndingLink} />;
  return <MeetUp meeting={meeting} deviceId={deviceId} />;
}

function GrantedFromEnding({ wishId, showEndingLink }: { wishId: Id<"wishes">; showEndingLink: boolean }) {
  const ending = useQuery(api.link.ending, { wishId }) as GrantedEnding | null | undefined;
  const router = useRouter();
  if (!ending) return null;
  return (
    <View style={styles.granted}>
      <GrantedCard ending={ending} testID="granted-card" />
      {showEndingLink ? (
        <DButton
          title="Open the ending"
          variant="ghost"
          size="sm"
          onPress={() => router.push({ pathname: "/e/[wishId]", params: { wishId } })}
          testID={`granted-open-${wishId}`}
        />
      ) : null}
    </View>
  );
}

function MeetUp({ meeting, deviceId }: { meeting: MeetingView; deviceId: string }) {
  const uploadUrl = useMutation(api.meetings.uploadUrl);
  const submitPhoto = useMutation(api.meetings.submitPhoto);
  const confirmPhoto = useMutation(api.meetings.confirmPhoto);
  const rejectPhoto = useMutation(api.meetings.rejectPhoto);
  const [metInPerson, setMetInPerson] = useState(true);
  const [thankYou, setThankYou] = useState("");
  const [busy, setBusy] = useState<"upload" | "confirm" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const copy = meetCopy(meeting);
  const other = otherName(meeting);
  const ids = { wishId: meeting.wishId, deviceId };

  async function run(kind: "upload" | "confirm" | "reject", fn: () => Promise<unknown>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(null);
    }
  }

  const upload = () =>
    run("upload", async () => {
      const file = await pickPhoto();
      if (!file) return;
      const url = await uploadUrl(ids);
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type || "image/jpeg" }, body: file });
      if (!res.ok) throw new Error((await res.text()) || "Upload failed. Try again.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await submitPhoto({ ...ids, storageId, metInPerson, thankYou: thankYou.trim() });
    });

  const photoId = meeting.photoStorageId;
  const canUpload = meeting.stage === "upload" || meeting.stage === "waiting";

  return (
    <DCard testID={`meet-card-${meeting.wishId}`}>
      <Eyebrow>Meet up</Eyebrow>
      <Text style={styles.title} accessibilityRole="header">
        {copy.title}
      </Text>
      <Text style={styles.wish} numberOfLines={2}>
        “{meeting.wishText}” · with {other}
      </Text>
      <Sub>{copy.sub}</Sub>
      {meeting.photoUrl ? (
        <Image
          testID="meet-photo"
          source={{ uri: meeting.photoUrl }}
          style={styles.photo}
          resizeMode="cover"
          accessibilityLabel={`Meet-up photo of you and ${other}`}
        />
      ) : null}
      {meeting.stage === "review" && photoId ? (
        <View style={styles.actions}>
          {meeting.thankYou ? <Text style={styles.quote}>“{meeting.thankYou}”</Text> : null}
          <DButton
            title="Yes, that's us — grant it"
            onPress={() => run("confirm", () => confirmPhoto({ ...ids, storageId: photoId }))}
            busy={busy === "confirm"}
            disabled={busy !== null}
            testID="meet-confirm"
          />
          <DButton
            title="That's not us"
            variant="ghost"
            onPress={() => run("reject", () => rejectPhoto({ ...ids, storageId: photoId }))}
            busy={busy === "reject"}
            disabled={busy !== null}
            testID="meet-reject"
          />
        </View>
      ) : null}
      {canUpload ? (
        <View style={styles.actions}>
          {meeting.stage === "upload" ? (
            <>
              <DField
                label={`One line for ${other} (optional)`}
                value={thankYou}
                onChangeText={setThankYou}
                placeholder="Thank you for…"
                maxLength={500}
                testID="meet-thank-you"
              />
              <View style={styles.toggle}>
                <Text style={styles.toggleText}>We met in person</Text>
                <Switch
                  testID="meet-in-person"
                  accessibilityLabel="We met in person"
                  value={metInPerson}
                  onValueChange={setMetInPerson}
                  trackColor={{ true: lv.thread, false: lv.fill }}
                />
              </View>
            </>
          ) : null}
          <DButton
            title={meeting.stage === "waiting" ? "Use a different photo" : "Upload a photo together"}
            variant={meeting.stage === "waiting" ? "ghost" : "thread"}
            icon={meeting.stage === "waiting" ? undefined : "sparkles"}
            onPress={upload}
            busy={busy === "upload"}
            disabled={!CAN_PICK_PHOTO || busy !== null}
            testID="meet-upload"
          />
          {!CAN_PICK_PHOTO ? <Sub>{NATIVE_PICK_NOTE}</Sub> : null}
        </View>
      ) : null}
      <DError error={error} />
    </DCard>
  );
}

const styles = StyleSheet.create({
  granted: { gap: 10 },
  title: { ...type.headline, color: lv.fg },
  wish: { ...type.footnote, color: lv.mutedFg },
  quote: { ...type.subheadline, color: lv.fg, fontStyle: "italic" },
  photo: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: lv.muted },
  actions: { gap: 10, marginTop: 4 },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleText: { ...type.subheadline, color: lv.fg },
});

/** For pages that know a wish but not whether this device is in it (link page, ending page). */
export function MeetForWish({ wishId, deviceId, showEndingLink = true }: { wishId: string; deviceId: string | null; showEndingLink?: boolean }) {
  const now = useNow(60000);
  const meeting = useQuery(api.meetings.get, deviceId && wishId ? { wishId, deviceId, now } : "skip");
  return meeting && deviceId ? <MeetCard meeting={meeting} deviceId={deviceId} showEndingLink={showEndingLink} /> : null;
}
