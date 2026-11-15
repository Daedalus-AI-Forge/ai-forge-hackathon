import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { errorMessage } from "@/components/ui";
import { lv, type } from "@/theme/tokens";

import { Eyebrow, LvAvatar, LvButton, LvCard } from "./parts";

export type CoachPick = { name: string; why: string };
type Turn = { role: "user" | "coach"; text: string };

/**
 * AI coach: suggests who in my own network should get this wish. Suggests only — a tap
 * fills a recipient card; nothing is sent. Below the graph threshold it shows a hint and
 * falls back to the legacy "Ask the well" call (kept from the previous screen).
 */
export function CoachPanel({
  deviceId,
  wishText,
  onPick,
  onSuggestions,
  pickedNames,
}: {
  deviceId: string | null;
  wishText: string;
  onPick: (p: CoachPick) => void;
  /** Called with the top suggestions each time the coach answers (the screen decides whether to prefill). */
  onSuggestions?: (s: CoachPick[]) => void;
  pickedNames: string[];
}) {
  const readiness = useQuery(api.graph.coachReady, deviceId ? { deviceId } : "skip");
  const coach = useAction(api.ai.coach);
  const askTheWell = useAction(api.ai.askTheWell);
  const [result, setResult] = useState<{ message: string; suggestions: CoachPick[] } | null>(null);
  const [advice, setAdvice] = useState<CoachPick | "none" | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const taken = (n: string) => pickedNames.some((p) => p.trim().toLowerCase() === n.toLowerCase());

  async function runCoach(nextTurns: Turn[]) {
    if (!deviceId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await coach({ deviceId, wishText, turns: nextTurns.length ? nextTurns : undefined });
      if (r.ready) {
        const suggestions = r.suggestions.slice(0, 3).map((x) => ({ name: x.name, why: x.why }));
        setResult({ message: r.message, suggestions });
        onSuggestions?.(suggestions);
        setTurns([...nextTurns, { role: "coach", text: r.message }]);
      } else setResult(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function runAsk() {
    if (!deviceId) return;
    setBusy(true);
    setError(null);
    try {
      const a = await askTheWell({ deviceId, text: wishText });
      setAdvice(a ? { name: a.name, why: a.reason } : "none");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const ready = readiness?.ready === true;

  return (
    <LvCard testID="ask-the-well">
      <Eyebrow color={lv.thread}>✦ Suggested by AI</Eyebrow>
      {readiness === undefined ? (
        <ActivityIndicator color={lv.thread} />
      ) : ready ? (
        <View testID="toss-coach" style={{ gap: 10 }}>
          {result ? (
            <>
              <Text testID="toss-coach-message" style={s.msg}>
                {result.message}
              </Text>
              {result.suggestions.map((sg, i) => (
                <Pressable
                  key={sg.name}
                  testID={`toss-coach-chip-${i}`}
                  disabled={taken(sg.name)}
                  onPress={() => onPick(sg)}
                  style={[s.row, taken(sg.name) && { opacity: 0.5 }]}
                >
                  <LvAvatar name={sg.name} size={36} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.name}>{sg.name}</Text>
                    <Text style={s.why} numberOfLines={2}>
                      {sg.why}
                    </Text>
                  </View>
                  <Text style={s.add}>{taken(sg.name) ? "Added" : "+ Add"}</Text>
                </Pressable>
              ))}
              <LvButton
                testID="toss-coach-more"
                compact
                variant="ghost"
                title="Ask for other ideas"
                busy={busy}
                onPress={() => runCoach([...turns, { role: "user", text: "Who else could help?" }])}
              />
            </>
          ) : (
            <>
              <Text style={s.hint}>The well knows who you've passed wishes to. Ask it who should get this one first.</Text>
              <LvButton
                testID="ask-the-well-button"
                compact
                variant="ink"
                title="Who should get it first?"
                busy={busy}
                disabled={!wishText.trim()}
                onPress={() => runCoach([])}
              />
            </>
          )}
        </View>
      ) : (
        <View testID="toss-coach-empty" style={{ gap: 10 }}>
          <Text style={s.hint}>
            The well is still learning your circle ({readiness.edgeCount}/{readiness.threshold}). Pass a few daily wishes and
            it'll start suggesting who to ask.
          </Text>
          {advice === null ? (
            <LvButton testID="ask-the-well-button" compact variant="ghost" title="Ask the well anyway" busy={busy} onPress={runAsk} />
          ) : advice === "none" ? (
            <Text style={s.hint}>The well doesn't know your friends yet.</Text>
          ) : (
            <Pressable testID="ask-the-well-add" disabled={taken(advice.name)} onPress={() => onPick(advice)} style={s.row}>
              <LvAvatar name={advice.name} size={36} />
              <View style={{ flex: 1 }}>
                <Text testID="ask-the-well-answer" style={s.name}>
                  Start with {advice.name}
                </Text>
                <Text style={s.why}>{advice.why}</Text>
              </View>
              <Text style={s.add}>{taken(advice.name) ? "Added" : "+ Add"}</Text>
            </Pressable>
          )}
        </View>
      )}
      {error ? <Text style={s.err}>{error}</Text> : null}
    </LvCard>
  );
}

const s = StyleSheet.create({
  msg: { ...type.callout, fontWeight: "500", color: lv.fg },
  hint: { ...type.subheadline, color: lv.mutedFg },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6, minHeight: 52 },
  name: { ...type.subheadline, fontWeight: "600", color: lv.fg },
  why: { ...type.caption1, color: lv.mutedFg, marginTop: 2 },
  add: { ...type.subheadline, fontWeight: "600", color: lv.thread },
  err: { ...type.footnote, color: lv.destructive },
});
