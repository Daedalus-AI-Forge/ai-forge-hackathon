import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { api } from "@/convex/_generated/api";
import { Glass, LargeTitle, Screen, Segmented } from "@/components/ios";
import { BranchRace } from "@/components/BranchRace";
import { TierBadge } from "@/components/TierBadge";
import { DTag } from "@/components/lv/passon/kit";
import { ThreadMap } from "@/components/lv/threads/ThreadMap";
import { STATUS_LABEL, TIER_LABEL, pathHolders } from "@/components/lv/threads/threadData";
import { ClaimCard, type PendingClaim } from "@/components/lv/voyages/ClaimCard";
import { MiniRoute } from "@/components/lv/voyages/MiniRoute";
import { VOYAGE_STATUS } from "@/components/lv/voyages/voyageData";
import { useMe } from "@/lib/device";
import { rippleLine, useNow } from "@/lib/time";
import { layout, lv, type } from "@/theme/tokens";

type Tab = "boats" | "coins";

const TABS = [
  { key: "boats", label: "Boats", testID: "voyages-tab-boats" },
  { key: "coins", label: "Coins", testID: "voyages-tab-coins" },
] as const;

const INSET = 8; // map inset inside a coin card; the map's radius stays concentric with the card

/** Boats I pushed and coins I tossed: where they drifted and how they ended. */
export default function VoyagesScreen() {
  const { deviceId } = useMe();
  const [tab, setTab] = useState<Tab>("boats");
  const boats = useQuery(api.pool.voyages, deviceId ? { deviceId } : "skip");
  const coins = useQuery(api.wishes.mine, deviceId ? { deviceId } : "skip");
  const claims = useQuery(api.link.pendingClaims, deviceId ? { deviceId } : "skip");
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  // Confirmed claims drop out of pendingClaims; keep their cards for the draft/text step.
  const [confirmed, setConfirmed] = useState<Record<string, PendingClaim>>({});
  const claimCards = [
    ...Object.values(confirmed).filter((c) => !claims?.some((p) => p.hopId === c.hopId)),
    ...(claims ?? []),
  ].filter((c) => !hidden.has(c.hopId));
  const now = useNow(30000);
  const router = useRouter();

  return (
    <Screen tab testID="voyages-screen">
      <LargeTitle eyebrow="Where they drifted" title="Voyages" />

      {deviceId
        ? claimCards.map((c) => (
            <ClaimCard
              key={c.hopId}
              claim={c}
              deviceId={deviceId}
              onDismiss={() => setHidden((prev) => new Set(prev).add(c.hopId))}
              onConfirmed={() => setConfirmed((prev) => ({ ...prev, [c.hopId]: c }))}
            />
          ))
        : null}

      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === "boats" ? (
        <>
          {boats === undefined ? <Text style={styles.empty}>Loading…</Text> : null}
          {boats?.map((b) => (
            <Glass
              key={b.hopId}
              testID={`boat-card-${b.hopId}`}
              onPress={() => router.push({ pathname: "/boat/[hopId]", params: { hopId: b.hopId } })}
              style={styles.card}
            >
              <View style={styles.row}>
                <DTag label={b.source === "daily" ? "Today's boat" : `${b.creatorName}'s real wish`} tone={b.source === "daily" ? "gold" : "thread"} />
                <Text style={styles.status}>{VOYAGE_STATUS[b.status]}</Text>
              </View>
              <Text style={styles.text} numberOfLines={2}>
                {b.text}
              </Text>
              <MiniRoute cities={b.cities} hops={b.hops} />
              <Text style={styles.meta}>
                {b.hops} {b.hops === 1 ? "hop" : "hops"} past you
                {b.found ? ` · Found ${b.found.name}${b.found.city ? `, ${b.found.city}` : ""}` : ""}
              </Text>
            </Glass>
          ))}
          {boats && boats.length === 0 ? <Text style={styles.empty}>No boats yet. Push today's boat from the Pool.</Text> : null}
        </>
      ) : (
        <>
          {coins === undefined ? <Text style={styles.empty}>Loading…</Text> : null}
          {coins?.map((w) => {
            const path = pathHolders(w.holders);
            return (
              <View key={w._id} style={{ gap: 8 }}>
              <Glass
                testID={`coin-card-${w._id}`}
                onPress={() => router.push({ pathname: "/threads/[id]", params: { id: w._id } })}
                style={styles.coinCard}
              >
                <ThreadMap holders={w.holders} compact highlightName={w.creatorName} radius={lv.radiusXl - INSET} />
                <View style={styles.coinBody}>
                  <View style={styles.row}>
                    <DTag label="Your coin" tone="threadSolid" />
                    <Text style={styles.status}>
                      {STATUS_LABEL[w.status]}
                      {w.status === "granted" && w.tier ? ` · ${TIER_LABEL[w.tier]}` : ""}
                    </Text>
                  </View>
                  {w.tier ? <TierBadge tier={w.tier} testID={`my-wish-tier-${w._id}`} /> : null}
                  <Text style={styles.text}>{w.text}</Text>
                  <Text style={styles.meta}>{rippleLine(w.ripples, w.holding, w.expiresAt, now)}</Text>
                  <View style={styles.chain}>
                    {path.map((h, i) => (
                      <View key={h.key} style={styles.chainItem}>
                        {i > 0 ? <View style={styles.dash} /> : null}
                        <View style={[styles.chip, i === 0 && styles.chipMe]}>
                          <Text style={[styles.chipText, i === 0 && styles.chipTextMe]}>{i === 0 ? "You" : h.name}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              </Glass>
              {deviceId && (w.status === "traveling" || w.status === "found") ? (
                <BranchRace deviceId={deviceId} wishId={w._id} />
              ) : null}
              </View>
            );
          })}
          {coins && coins.length === 0 ? <Text style={styles.empty}>No coins tossed yet.</Text> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: layout.cardPadding, gap: 8 },
  coinCard: { padding: INSET },
  coinBody: { padding: layout.cardPadding - INSET, paddingTop: 12, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  status: { ...type.footnote, color: lv.mutedFg, flexShrink: 0 },
  text: { ...type.headline, color: lv.fg },
  meta: { ...type.footnote, color: lv.mutedFg },
  empty: { ...type.subheadline, color: lv.mutedFg, textAlign: "center", paddingVertical: 24 },
  chain: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 6, marginTop: 2 },
  chainItem: { flexDirection: "row", alignItems: "center" },
  dash: { width: 12, height: 1.5, backgroundColor: lv.thread, marginHorizontal: 4, borderRadius: 1 },
  chip: { backgroundColor: lv.fill, borderRadius: 999, paddingHorizontal: 10, height: 22, justifyContent: "center" },
  chipMe: { backgroundColor: lv.fg },
  chipText: { ...type.caption1, color: lv.mutedFg },
  chipTextMe: { color: lv.primaryFg, fontWeight: "600" },
});
