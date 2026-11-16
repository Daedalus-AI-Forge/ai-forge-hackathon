import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import * as Clipboard from "expo-clipboard";
import { useEffect, useRef, useState } from "react";
import { Image, Linking, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cleanError } from "@/components/link/claim/errors";
import { DButton, DCard, DError, DField, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { useNow } from "@/lib/time";
import { lv, type } from "@/theme/tokens";

import { GrantedCard } from "./GrantedCard";
import { meetCopy, otherName } from "./meetLogic";
import { CAN_PICK_PHOTO, pickPhoto, releasePhoto, type MeetingPhoto } from "./pickPhoto";
import { WishProgressButton } from "./WishProgressButton";

export type MeetingView = NonNullable<FunctionReturnType<typeof api.meetings.get>>;

export function MeetCard({ meeting, deviceId, showEndingLink = true }: { meeting: MeetingView; deviceId: string; showEndingLink?: boolean }) {
  if (meeting.stage === "granted") return <GrantedFromEnding wishId={meeting.wishId} showEndingLink={showEndingLink} />;
  // A new server photo or stage invalidates local consent and restores the persisted meeting details.
  return <MeetUp key={`${meeting.wishId}:${meeting.stage}:${meeting.photoStorageId}`} meeting={meeting} deviceId={deviceId} />;
}

function GrantedFromEnding({ wishId, showEndingLink }: { wishId: Id<"wishes">; showEndingLink: boolean }) {
  const ending = useQuery(api.link.ending, { wishId });
  if (!ending || ending.status !== "granted" || ending.locked) return null;
  return (
    <View style={styles.granted}>
      <GrantedCard ending={ending} wishId={wishId} />
      {showEndingLink ? <WishProgressButton wishId={wishId} title="Open the ending" testID={`granted-open-${wishId}`} /> : null}
    </View>
  );
}

function MatchContact({ contact, phone, name }: { contact: string; phone: string | null; name: string }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function copyContact() {
    setNote("");
    setError(null);
    try {
      if (!(await Clipboard.setStringAsync(contact))) throw new Error();
      setNote("Contact copied.");
    } catch {
      setError("Couldn't copy the contact. You can select it above.");
    }
  }

  async function openMessages() {
    if (!phone) return;
    setNote("");
    setError(null);
    try {
      await Linking.openURL(`sms:${phone}`);
    } catch {
      setError("Couldn't open Messages on this device.");
    }
  }

  return (
    <View style={styles.contact}>
      <Text style={styles.contactLabel}>{name}’s contact</Text>
      <Text selectable style={styles.contactText} testID="meet-contact">{contact}</Text>
      <View style={styles.contactActions}>
        <DButton title="Copy contact" variant="ghost" size="sm" onPress={copyContact} testID="meet-copy-contact" />
        {phone ? <DButton title="Open Messages" variant="ghost" size="sm" onPress={openMessages} testID="meet-open-messages" /> : null}
      </View>
      {note ? <Text style={styles.contactLabel} accessibilityLiveRegion="polite">{note}</Text> : null}
      <DError error={error} />
    </View>
  );
}

type Work = "pick" | "submit" | "confirm" | "reject";

function MeetUp({ meeting, deviceId }: { meeting: MeetingView; deviceId: string }) {
  const uploadUrl = useMutation(api.meetings.uploadUrl);
  const submitPhoto = useMutation(api.meetings.submitPhoto);
  const confirmPhoto = useMutation(api.meetings.confirmPhoto);
  const rejectPhoto = useMutation(api.meetings.rejectPhoto);
  const [metInPerson, setMetInPerson] = useState(meeting.metInPerson ?? true);
  const [thankYou, setThankYou] = useState(meeting.thankYou);
  const [picked, setPicked] = useState<MeetingPhoto | null>(null);
  const [busy, setBusy] = useState<Work | null>(null);
  const [committed, setCommitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const [photoAttempt, setPhotoAttempt] = useState(0);
  const [photoResult, setPhotoResult] = useState<{ key: string; loaded: boolean } | null>(null);
  const work = useRef<Work | "committed" | null>(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => () => {
    if (picked) releasePhoto(picked);
  }, [picked]);

  const { photoStorageId, photoUrl, stage, wishId } = meeting;
  const ids = { wishId, deviceId };
  const copy = meetCopy(meeting);
  const other = otherName(meeting);
  const contact = meeting.role === "creator" ? meeting.matchContact || meeting.matchPhone : null;
  const canUpload = stage === "upload" || stage === "waiting";
  const uri = picked?.uri ?? photoUrl;
  const photoKey = `${photoStorageId}:${uri}:${photoAttempt}`;
  const loaded = !!uri && photoResult?.key === photoKey && photoResult.loaded;
  const failed = photoResult?.key === photoKey && !photoResult.loaded;
  const inactive = busy !== null || committed;

  async function run(kind: Work, fn: () => Promise<unknown>) {
    if (work.current) return;
    work.current = kind;
    setBusy(kind);
    setError(null);
    setPickError(null);
    try {
      await fn();
      if (kind !== "pick") {
        work.current = "committed";
        setCommitted(true);
      }
    } catch (e) {
      if (kind === "pick") setPickError(cleanError(e));
      else setError(cleanError(e));
    } finally {
      if (work.current !== "committed") work.current = null;
      setBusy(null);
    }
  }

  function choosePhoto() {
    return run("pick", async () => {
      const next = await pickPhoto();
      if (!next) return;
      if (!mounted.current) {
        releasePhoto(next);
        return;
      }
      setPicked(next);
      setPhotoResult(null);
    });
  }

  function cancelPreview() {
    if (work.current) return;
    setPicked(null);
    setPickError(null);
    setError(null);
    setPhotoResult(null);
  }

  function submit() {
    if (!picked || !loaded) return;
    return run("submit", async () => {
      const url = await uploadUrl(ids);
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": picked.type }, body: picked.blob });
      if (!res.ok) throw new Error((await res.text()) || "Upload failed. Try again.");
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await submitPhoto({ ...ids, storageId, metInPerson, thankYou: thankYou.trim() });
    });
  }

  const photoError = pickError ?? (failed || (!uri && photoStorageId)
    ? "This photo couldn't be loaded."
    : null);

  return (
    <DCard testID={`meet-card-${wishId}`}>
      <Eyebrow>Meet up</Eyebrow>
      <Text style={styles.title} accessibilityRole="header">{copy.title}</Text>
      <Text style={styles.wish} numberOfLines={2}>“{meeting.wishText}” · with {other}</Text>
      <Sub>{copy.sub}</Sub>
      {stage !== "expired" ? (
        <Text style={styles.contactLabel} testID="meet-deadline">
          Confirm by {new Date(meeting.meetDeadline).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
        </Text>
      ) : null}
      {contact ? <MatchContact contact={contact} phone={meeting.matchPhone} name={other} /> : null}
      {picked ? <Eyebrow>Photo preview</Eyebrow> : null}
      {uri ? (
        <Image
          key={photoKey}
          testID={picked ? "meet-photo-preview" : "meet-photo"}
          source={{ uri }}
          style={styles.photo}
          resizeMode="contain"
          onLoad={() => setPhotoResult({ key: photoKey, loaded: true })}
          onError={() => setPhotoResult({ key: photoKey, loaded: false })}
          accessibilityLabel={`Meet-up photo of you and ${other}`}
        />
      ) : null}
      {uri && !loaded && !failed ? <Sub>Loading photo…</Sub> : null}
      {photoError ? <View testID="meet-photo-error"><DError error={photoError} /></View> : null}
      {failed && !picked ? (
        <DButton title="Retry loading photo" variant="ghost" size="sm" onPress={() => setPhotoAttempt((n) => n + 1)} disabled={inactive} testID="meet-photo-retry" />
      ) : null}
      {stage === "review" && photoStorageId ? (
        <View style={styles.actions}>
          {meeting.thankYou ? <Text style={styles.quote}>“{meeting.thankYou}”</Text> : null}
          <Sub>Confirming makes this photo and thank-you part of the public ending.</Sub>
          <DButton
            title="Yes, that's us — grant it"
            onPress={() => {
              if (loaded) void run("confirm", () => confirmPhoto({ ...ids, storageId: photoStorageId }));
            }}
            busy={busy === "confirm"}
            disabled={inactive || !loaded}
            testID="meet-confirm"
          />
          <DButton
            title="Reject photo"
            variant="ghost"
            onPress={() => run("reject", () => rejectPhoto({ ...ids, storageId: photoStorageId }))}
            busy={busy === "reject"}
            disabled={inactive}
            testID="meet-reject"
          />
        </View>
      ) : null}
      {canUpload ? (
        <View style={styles.actions}>
          {stage === "upload" || picked ? (
            <>
              <DField
                label={`One line for ${other} (optional)`}
                value={thankYou}
                onChangeText={setThankYou}
                placeholder="Thank you for…"
                maxLength={500}
                editable={!inactive}
                testID="meet-thank-you"
              />
              <View style={styles.toggle}>
                <Text style={styles.toggleText}>We met in person</Text>
                <Switch
                  testID="meet-in-person"
                  accessibilityLabel="We met in person"
                  value={metInPerson}
                  onValueChange={setMetInPerson}
                  disabled={inactive}
                  trackColor={{ true: lv.thread, false: lv.fill }}
                />
              </View>
            </>
          ) : null}
          {picked ? (
            <>
              <Sub>Submit only if you’re both in this photo and agree to share it and your note when the wish is granted.</Sub>
              <DButton title="Submit photo" onPress={submit} busy={busy === "submit"} disabled={inactive || !loaded} testID="meet-submit" />
            </>
          ) : null}
          <DButton
            title={picked || stage === "waiting" ? "Choose a different photo" : "Choose a photo together"}
            variant={picked || stage === "waiting" ? "ghost" : "thread"}
            onPress={choosePhoto}
            busy={busy === "pick"}
            disabled={!CAN_PICK_PHOTO || inactive}
            testID="meet-upload"
          />
          {picked ? <DButton title="Cancel preview" variant="plain" onPress={cancelPreview} disabled={inactive} testID="meet-photo-cancel" /> : null}
        </View>
      ) : null}
      {committed ? <Sub>Updating the meeting…</Sub> : null}
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
  contact: { gap: 6, marginTop: 4 },
  contactLabel: { ...type.footnote, color: lv.mutedFg },
  contactText: { ...type.subheadline, color: lv.fg },
  contactActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});

/** For pages that know a wish but not whether this device is in it. */
export function MeetForWish({ wishId, deviceId, showEndingLink = true }: { wishId: string; deviceId: string | null; showEndingLink?: boolean }) {
  const now = useNow(60000);
  const meeting = useQuery(api.meetings.get, deviceId && wishId ? { wishId, deviceId, now } : "skip");
  if (!meeting || !deviceId || (!showEndingLink && meeting.stage === "granted")) return null;
  return <MeetCard meeting={meeting} deviceId={deviceId} showEndingLink={showEndingLink} />;
}
