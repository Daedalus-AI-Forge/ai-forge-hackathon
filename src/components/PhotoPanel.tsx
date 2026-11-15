import { useMutation } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Image, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button, Card, ErrorText, Muted, errorMessage } from "@/components/ui";
import { colors } from "@/lib/theme";

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
    <Card testID="photo-panel">
      <Text style={styles.title}>{theirs ? `${otherName} added your photo` : "Add a photo together"}</Text>
      {!photo ? (
        <Muted>
          Meet {otherName} online or in person, then add a selfie or a video-call screenshot.
          {days !== null ? ` ${days === 1 ? "1 day" : `${days} days`} left to meet.` : ""}
        </Muted>
      ) : null}
      {photo?.url ? <Image testID="photo-preview" source={{ uri: photo.url }} style={styles.preview} resizeMode="cover" /> : null}
      {theirs ? (
        <>
          <Muted>{photo.metInPerson ? "You met in person." : "You met online."} Is this you two?</Muted>
          <ErrorText error={error} />
          <Button testID="photo-confirm" title="Yes, that's us!" busy={busy} onPress={() => run(() => confirmPhoto({ wishId, ...party }))} />
        </>
      ) : (
        <>
          {photo ? <Muted>Waiting for {otherName} to confirm. Then everyone gets the ending.</Muted> : null}
          <View style={styles.toggle}>
            <Text style={styles.toggleText}>We met in person</Text>
            <Switch
              testID="photo-met-in-person"
              value={metInPerson}
              onValueChange={setMetInPerson}
              trackColor={{ true: colors.red, false: colors.line }}
              thumbColor="#fff"
            />
          </View>
          <ErrorText error={error} />
          <Button
            testID="photo-upload"
            title={photo ? "Use a different photo" : "Pick a photo"}
            variant={photo ? "secondary" : "primary"}
            busy={busy}
            onPress={() => run(pickAndUpload)}
          />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: "800", color: colors.ink },
  preview: { width: "100%", aspectRatio: 1, borderRadius: 14, backgroundColor: colors.water },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  toggleText: { fontSize: 15, fontWeight: "600", color: colors.ink },
});
