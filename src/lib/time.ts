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

export function rippleLine(ripples: number, holding: number, expiresAt: number, now: number) {
  const left = timeLeft(expiresAt, now);
  const first = ripples === 0 ? "In the well" : `${ordinal(ripples)} ripple`;
  return `${first} · ${holding} holding it · ${left}`;
}
