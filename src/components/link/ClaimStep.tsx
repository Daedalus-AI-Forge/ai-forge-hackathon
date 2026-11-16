// Screen 3a: claim the boat ("it's me"). Daily boat: intro + optional proof photo + show-name toggle.
// Real wish: intro + AI follow-up questions + phone verification code.
import { useAction, useMutation } from "convex/react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { WishProgressButton } from "@/components/lv/meet/WishProgressButton";
import { DButton, DCard, DError, DField, DHint, Eyebrow, Sub } from "@/components/lv/passon/kit";
import { phoneFromParts } from "@/lib/phoneNumber";
import { lv, type } from "@/theme/tokens";

import { cleanError, isSixDigitCode } from "./claim/errors";
import { canPickPhoto, pickPhoto, uploadPhoto } from "./claim/photo";

// Lands in convex/linkAi.ts at merge; typed here so this file compiles before then.

export type ClaimStepProps = { hopId: string; wishId: string; deviceId: string; kind: "daily" | "real"; onDone: () => void };

export function ClaimStep({ hopId, wishId, deviceId, kind, onDone }: ClaimStepProps) {
  const hop = hopId as Id<"hops">;
  const claim = useMutation(api.link.claim);
  const generateUploadUrl = useMutation(api.link.generateUploadUrl);
  const track = useMutation(api.linkMetrics.track);
  const claimQuestions = useAction(api.linkAi.claimQuestions);
  const sendClaimCode = useAction(api.linkAi.sendClaimCode);
  const verifyClaimCode = useAction(api.linkAi.verifyClaimCode);

  const [intro, setIntro] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // daily
  const [showNameAndCity, setShowNameAndCity] = useState(true);
  const [photo, setPhoto] = useState<{ storageId: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  // real
  const [questions, setQuestions] = useState<string[] | null>(kind === "real" ? null : []);
  const [answers, setAnswers] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (kind !== "real") return;
    let live = true;
    claimQuestions({ hopId: hop })
      .then((qs) => live && setQuestions(qs))
      .catch(() => live && setQuestions(["What makes you a fit for this wish?"]));
    return () => {
      live = false;
    };
  }, [kind, hopId]);

  const fullPhone = phone.trim() ? phoneFromParts("1", phone) : "";

  async function onPickPhoto() {
    setError(null);
    setUploading(true);
    try {
      const picked = await pickPhoto();
      if (!picked) return;
      const url = await generateUploadUrl({});
      const storageId = await uploadPhoto(url, picked.blob, picked.type);
      setPhoto({ storageId, name: picked.name });
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setUploading(false);
    }
  }

  async function onSendCode() {
    setError(null);
    setSending(true);
    try {
      await sendClaimCode({ hopId: hop, phone: fullPhone });
      setCodeSent(true);
      setVerified(false);
      setCode("");
    } catch (e) {
      // Rate limited = a code was sent moments ago: let them enter it instead of blocking.
      const data = (e as { data?: { code?: string } }).data;
      if (data?.code === "RATE_LIMITED") {
        setCodeSent(true);
        setVerified(false);
        setError(null);
      } else {
        setError(cleanError(e));
      }
    } finally {
      setSending(false);
    }
  }

  async function onVerify() {
    setError(null);
    setVerifying(true);
    try {
      const { verified: ok } = await verifyClaimCode({ hopId: hop, phone: fullPhone, code: code.trim() });
      setVerified(ok);
      if (!ok) setError("That code didn't work");
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setVerifying(false);
    }
  }

  async function onSubmit() {
    setError(null);
    setBusy(true);
    try {
      await claim({
        hopId: hop,
        deviceId,
        intro: intro.trim(),
        ...(kind === "daily"
          ? { showNameAndCity, proofStorageId: photo ? (photo.storageId as Id<"_storage">) : undefined }
          : { answers: answers.map((a) => a.trim()), phone: fullPhone, code: code.trim() }),
      });
      setDone(true);
      void track({ hopId: hop, deviceId, event: "claim" }).catch(() => {});
    } catch (e) {
      setError(cleanError(e));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <DCard testID="claim-waiting">
        <Eyebrow>Claimed</Eyebrow>
        <Text style={styles.title}>{kind === "daily" ? "This boat landed" : "Waiting for the wish-maker to confirm"}</Text>
        {kind === "real" ? <Sub>We’ll let you know as soon as they do.</Sub> : null}
        <DButton title="Continue" onPress={onDone} testID="claim-continue" />
        <WishProgressButton wishId={wishId} testID="claim-progress-link" />
      </DCard>
    );
  }

  const realReady =
    kind !== "real" ||
    (questions !== null && questions.every((_, i) => (answers[i] ?? "").trim()) && verified);
  const canSubmit = intro.trim().length > 0 && realReady && !uploading;
  const claimMissing = canSubmit
    ? null
    : uploading
      ? "Uploading your photo…"
      : !intro.trim()
        ? "Write a quick intro to claim it."
        : questions !== null && !questions.every((_, i) => (answers[i] ?? "").trim())
          ? "Answer the questions above."
          : "Verify your phone to claim it.";

  return (
    <DCard testID="claim-step">
      <Eyebrow>It's me</Eyebrow>
      <Text style={styles.title}>Tell the wish-maker who you are</Text>
      <DField
        label="A quick intro"
        value={intro}
        onChangeText={setIntro}
        placeholder="Hi, I'm…"
        multiline
        maxLength={500}
        testID="claim-intro"
      />

      {kind === "daily" ? (
        <View style={styles.section}>
          {canPickPhoto ? (
            <DButton
              title={photo ? `Photo added: ${photo.name}` : "Add a proof photo (optional)"}
              variant="ghost"
              size="sm"
              busy={uploading}
              onPress={onPickPhoto}
              testID="claim-photo"
            />
          ) : (
            <Sub>Proof photos can be added from the web page.</Sub>
          )}
          <Pressable style={styles.toggle} onPress={() => setShowNameAndCity((v) => !v)} accessibilityRole="switch">
            <Text style={styles.toggleText}>Show my name and city</Text>
            <Switch
              value={showNameAndCity}
              onValueChange={setShowNameAndCity}
              trackColor={{ true: lv.thread, false: lv.fillStrong }}
              ios_backgroundColor={lv.fillStrong}
              testID="claim-show-name"
            />
          </Pressable>
        </View>
      ) : (
        <View style={styles.section}>
          {questions === null ? (
            <View style={styles.row}>
              <ActivityIndicator color={lv.thread} />
              <Sub>Getting a few questions…</Sub>
            </View>
          ) : (
            questions.map((q, i) => (
              <DField
                key={i}
                label={q}
                value={answers[i] ?? ""}
                onChangeText={(t) => setAnswers((prev) => Object.assign([...prev], { [i]: t }))}
                maxLength={300}
                testID={`claim-answer-${i}`}
              />
            ))
          )}
          <View style={styles.row}>
            <DField
              label="Your phone"
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setVerified(false);
              }}
              placeholder="+1 555 010 0000"
              keyboardType="phone-pad"
              autoComplete="tel"
              testID="claim-phone"
              containerStyle={styles.grow}
            />
            <DButton
              title={codeSent ? "Resend" : "Send code"}
              variant="ink"
              size="sm"
              style={styles.codeBtn}
              busy={sending}
              disabled={fullPhone.replace(/\D/g, "").length < 8}
              onPress={onSendCode}
              testID="claim-send-code"
            />
          </View>
          {codeSent ? (
            <View style={styles.row}>
              <DField
                label="6-digit code"
                value={code}
                onChangeText={(t) => {
                  setCode(t.replace(/\D/g, "").slice(0, 6));
                  setVerified(false);
                }}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
                editable={!verified}
                testID="claim-code"
                containerStyle={styles.grow}
              />
              <DButton
                title={verified ? "Verified" : "Verify"}
                variant="ink"
                size="sm"
                style={styles.codeBtn}
                busy={verifying}
                disabled={verified || !isSixDigitCode(code.trim())}
                onPress={onVerify}
                testID="claim-verify"
              />
            </View>
          ) : null}
        </View>
      )}

      <DError error={error} />
      <DButton title="Claim this boat" size="lg" onPress={onSubmit} busy={busy} disabled={!canSubmit} testID="claim-submit" />
      <DHint testID="claim-missing">{busy ? null : claimMissing}</DHint>
    </DCard>
  );
}

const styles = StyleSheet.create({
  title: { ...type.title3, color: lv.fg },
  section: { gap: 16 },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  grow: { flex: 1 },
  // Same height as the field next to it so the row reads as one control.
  codeBtn: { height: 50 },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 44 },
  toggleText: { ...type.body, color: lv.fg, flexShrink: 1 },
});
