import { useSyncExternalStore } from "react";

/**
 * Which look the shared chrome (the floating tab bar) takes for the screen in focus.
 * A night screen (the Pool) sets "night" on focus and "light" on blur, like it does for the status bar.
 */
export type ChromeTone = "light" | "night";

let tone: ChromeTone = "light";
const listeners = new Set<() => void>();

export function setChromeTone(next: ChromeTone) {
  if (next === tone) return;
  tone = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useChromeTone() {
  return useSyncExternalStore(subscribe, () => tone, () => tone);
}
