import { useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { errorMessage } from "@/components/ui";
import { DButton, DCard, DError, Sub } from "@/components/lv/passon/kit";
import { lv } from "@/theme/tokens";

type Party = { deviceId: string } | { hopId: Id<"hops"> };
type Photo = { url: string | null; by: "wisher" | "match"; metInPerson: boolean } | null;

/** Upload the photo together, or confirm the one the other side uploaded. Works on web and native. */
export function PhotoPanel({
  wishId,
  party,
  me,
  otherName,
  photo,
  meetDeadline,
}: {
  wishId: Id<"wishes">;
  party: Party;
  me: "wisher" | "match";
  otherName: string;
  photo: Photo;
  meetDeadline: number | null;
}) {
  const generateUploadUrl = useMutation(api.endings.generateUploadUrl);
  const submitPhoto = useMutation(api.endings.submitPhoto);
  const confirmPhoto = useMutation(api.endings.confirmPhoto);
  const [metInPerson, setMetInPerson] = useState(photo?.metInPerson ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const days = meetDeadline ? Math.max(0, Math.ceil((meetDeadline - Date.now()) / 86400000)) : null;

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function pickAndUpload() {
    const picked = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    const blob = await (await fetch(asset.uri)).blob();
    const url = await generateUploadUrl({ wishId, ...party });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": blob.type || asset.mimeType || "image/jpeg" },
      body: blob,
    });
    if (!res.ok) throw new Error("Upload failed, try again");
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    const refusal = await submitPhoto({ wishId, ...party, storageId, metInPerson });
    if (refusal) throw new Error(refusal);
  }

  const theirs = photo && photo.by !== me;
  return (
    <DCard testID="photo-panel">
      <Text style={styles.title}>{theirs ? `${otherName} added your photo` : "Add a photo together"}</Text>
      {!photo ? (
        <Sub>
          Meet {otherName} online or in person, then add a selfie or a video-call screenshot.
          {days !== null ? ` ${days === 1 ? "1 day" : `${days} days`} left to meet.` : ""}
        </Sub>
      ) : null}
      {photo?.url ? <Image testID="photo-preview" source={{ uri: photo.url }} style={styles.preview} resizeMode="cover" /> : null}
      {theirs ? (
        <>
          <Sub>{photo.metInPerson ? "You met in person." : "You met online."} Is this you two?</Sub>
          <DError error={error} />
          <DButton testID="photo-confirm" title="Yes, that's us!" busy={busy} onPress={() => run(() => confirmPhoto({ wishId, ...party }))} />
        </>
      ) : (
        <>
          {photo ? <Sub>Waiting for {otherName} to confirm. Then everyone gets the ending.</Sub> : null}
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>We met in person</Text>
            <Switch
              testID="photo-met-in-person"
              value={metInPerson}
              onValueChange={setMetInPerson}
              trackColor={{ true: lv.thread, false: lv.border }}
              thumbColor="#fff"
            />
          </View>
          <DError error={error} />
          <DButton
            testID="photo-upload"
            title={photo ? "Use a different photo" : "Pick a photo"}
            variant={photo ? "ghost" : "thread"}
            busy={busy}
            onPress={() => run(pickAndUpload)}
          />
        </>
      )}
    </DCard>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", color: lv.fg },
  preview: { width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: lv.muted },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleText: { fontSize: 15, fontWeight: "600", color: lv.fg },
});
