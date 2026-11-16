// Surface tone for shared controls: "night" inside the pool's dark sheets, "light" everywhere else.
import { createContext, useContext, type ReactNode } from "react";

import { lv, night } from "@/theme/tokens";

export type SurfaceTone = "light" | "night";

const ToneContext = createContext<SurfaceTone>("light");

/** Wrap a dark surface so cards, fields, chips and buttons inside it switch to the night palette. */
export function ToneProvider({ tone, children }: { tone: SurfaceTone; children: ReactNode }) {
  return <ToneContext.Provider value={tone}>{children}</ToneContext.Provider>;
}

export function useSurfaceTone(): SurfaceTone {
  return useContext(ToneContext);
}

/** The palette a control reads for text, fills and accents on the current surface. */
export function useToneColors() {
  return useContext(ToneContext) === "night" ? NIGHT : LIGHT;
}

const LIGHT = {
  isNight: false as boolean,
  fg: lv.fg as string,
  mutedFg: lv.mutedFg as string,
  placeholder: lv.tertiaryFg as string,
  accent: lv.thread as string,
  fill: lv.fill as string,
  chipOn: lv.primary as string,
  chipOnFg: lv.primaryFg as string,
  err: lv.destructive as string,
};

const NIGHT: typeof LIGHT = {
  isNight: true,
  fg: night.fg,
  mutedFg: night.mutedFg,
  placeholder: "rgba(181,203,201,0.75)",
  accent: night.gold,
  fill: "rgba(248,242,226,0.10)",
  chipOn: night.gold,
  chipOnFg: night.goldFg,
  err: "#FF8A80",
};
