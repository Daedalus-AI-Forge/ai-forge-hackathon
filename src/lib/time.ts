import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function hoursLeft(expiresAt: number, now: number) {
  return Math.max(0, Math.floor((expiresAt - now) / 3600000));
}

export function timeLeft(expiresAt: number, now: number) {
  const ms = expiresAt - now;
  if (ms <= 0) return "time's up";
  if (ms < 3600000) return `${Math.max(1, Math.floor(ms / 60000))}m left`;
  return `${hoursLeft(expiresAt, now)}h left`;
}

export function countdown(expiresAt: number, now: number) {
  const total = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

export function ordinal(n: number) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/** How far a boat has come, the one way the UI counts it: "Just set sail", "1 hop", "2 hops". */
export function hopCount(hops: number) {
  return hops === 0 ? "Just set sail" : `${hops} hop${hops === 1 ? "" : "s"}`;
}

export function hopLine(hops: number, holding: number, expiresAt: number, now: number) {
  return `${hopCount(hops)} · ${holding} holding it · ${timeLeft(expiresAt, now)}`;
}

/** Start of the next UTC day: today's boat is keyed by the UTC date, so it rolls over here. */
export function nextUtcMidnight(now: number) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
