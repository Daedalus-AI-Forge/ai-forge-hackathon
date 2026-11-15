import { useEffect, useState } from "react";
import { Text, type StyleProp, type TextStyle } from "react-native";

import { lv } from "@/theme/tokens";

/** Next UTC midnight: the daily wish is keyed by UTC date (see daily.today). */
export function nextUtcMidnight(now: number) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export function formatRemaining(ms: number) {
  const d = Math.max(0, ms);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(Math.floor(d / 3_600_000))}:${p(Math.floor((d % 3_600_000) / 60_000))}:${p(Math.floor((d % 60_000) / 1000))}`;
}

export function Countdown({ to, style, testID }: { to: number; style?: StyleProp<TextStyle>; testID?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Text testID={testID} style={[{ fontFamily: lv.font.mono, fontVariant: ["tabular-nums"], fontWeight: "500" }, style]}>
      {formatRemaining(to - now)}
    </Text>
  );
}
