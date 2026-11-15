import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Button, ErrorText, Field, Muted } from "@/components/ui";
import { api } from "@/convex/_generated/api";
import { phoneAuthErrorData, phoneAuthErrorMessage, phoneFromParts, RESEND_SECONDS, usePhoneAuth } from "@/lib/phoneAuth";
import { colors } from "@/lib/theme";

type Busy = "send" | "verify" | null;

const DEMO_HINT = "Demo: +1 555 555 0100 · code 000000";

/**
 * "Continue with phone": number → SMS code → signed in. Calls `onDone` after a
 * successful verify, the same completion path Apple/Google use (AuthBridge then
 * runs linkDevice). `disabled` blocks it while another provider is busy.
 */
export function PhoneSignIn({ onDone, disabled }: { onDone: () => void; disabled?: boolean }) {
  const { sendCode, verifyCode } = usePhoneAuth();
  // Release builds hide __DEV__ hints; a demo deployment still needs its demo number shown.
  const demo = useQuery(api.users.demoEnabled) === true || __DEV__;
  const [open, setOpen] = useState(false);
  const [countryCode, setCountryCode] = useState("1");
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState<string | null>(null); // normalized E.164 once a code was sent
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const locked = disabled || busy !== null;

  async function send() {
    setError(null);
    setBusy("send");
    try {
      const res = await sendCode(phoneFromParts(countryCode, number));
      setPhone(res.phone);
      setCode("");
      setResendIn(RESEND_SECONDS);
    } catch (e) {
      // No SMS provider for real numbers on a demo deployment: point at the demo number.
      const notConfigured = phoneAuthErrorData(e)?.code === "NOT_CONFIGURED";
      setError(notConfigured && demo ? `${phoneAuthErrorMessage(e)}. ${DEMO_HINT}` : phoneAuthErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function verify() {
    if (!phone) return;
    setError(null);
    setBusy("verify");
    try {
      await verifyCode(phone, code);
      setBusy(null);
      onDone();
    } catch (e) {
      setError(phoneAuthErrorMessage(e));
      setBusy(null);
    }
  }

  function changeNumber() {
    setPhone(null);
    setCode("");
    setError(null);
    setResendIn(0);
  }

  if (!open) {
    return (
      <Button
        title="Continue with phone"
        variant="secondary"
        disabled={disabled}
        onPress={() => setOpen(true)}
        testID="sign-in-phone"
      />
    );
  }

  if (!phone) {
    const canSend = number.replace(/\D/g, "").length >= 4 && countryCode.replace(/\D/g, "").length > 0;
    return (
      <View style={styles.box} testID="phone-step-number">
        <Text style={styles.label}>Phone number</Text>
        <View style={styles.row}>
          <View style={styles.cc}>
            <Text style={styles.plus}>+</Text>
            <Field
              value={countryCode}
              onChangeText={(t) => setCountryCode(t.replace(/\D/g, "").slice(0, 4))}
              keyboardType="phone-pad"
              maxLength={4}
              accessibilityLabel="Country code"
              editable={!locked}
              style={styles.ccInput}
              testID="phone-country-code"
            />
          </View>
          <View style={styles.grow}>
            <Field
              value={number}
              onChangeText={setNumber}
              placeholder="555 555 0100"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              accessibilityLabel="Phone number"
              editable={!locked}
              returnKeyType="send"
              onSubmitEditing={() => canSend && !locked && void send()}
              testID="phone-number"
            />
          </View>
        </View>
        {demo ? <Muted style={styles.hint}>{DEMO_HINT}</Muted> : null}
        <Button
          title="Send code"
          busy={busy === "send"}
          disabled={locked || !canSend}
          onPress={() => void send()}
          testID="phone-send"
        />
        <ErrorText error={error} />
      </View>
    );
  }

  return (
    <View style={styles.box} testID="phone-step-code">
      <Muted>Enter the 6-digit code we sent to {phone}.</Muted>
      <Field
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
        placeholder="000000"
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        accessibilityLabel="Verification code"
        editable={!locked}
        returnKeyType="done"
        onSubmitEditing={() => code.length === 6 && !locked && void verify()}
        style={styles.codeInput}
        testID="phone-code"
      />
      <Button
        title="Verify"
        busy={busy === "verify"}
        disabled={locked || code.length !== 6}
        onPress={() => void verify()}
        testID="phone-verify"
      />
      <ErrorText error={error} />
      <View style={styles.links}>
        <Pressable
          accessibilityRole="button"
          disabled={locked || resendIn > 0}
          onPress={() => void send()}
          testID="phone-resend"
        >
          <Text style={[styles.link, (locked || resendIn > 0) && styles.linkOff]}>
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={locked} onPress={changeNumber} testID="phone-change-number">
          <Text style={[styles.link, locked && styles.linkOff]}>Change number</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 10 },
  label: { fontSize: 14, color: colors.muted, fontWeight: "600" },
  row: { flexDirection: "row", gap: 8 },
  cc: { flexDirection: "row", alignItems: "center", gap: 4 },
  plus: { fontSize: 17, color: colors.ink, fontWeight: "600" },
  ccInput: { width: 64, textAlign: "center" },
  grow: { flex: 1 },
  hint: { fontSize: 13 },
  codeInput: { letterSpacing: 6, textAlign: "center", fontSize: 22 },
  links: { flexDirection: "row", justifyContent: "space-between" },
  link: { color: colors.red, fontSize: 15, fontWeight: "600" },
  linkOff: { color: colors.muted, opacity: 0.6 },
});
