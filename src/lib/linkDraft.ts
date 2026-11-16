// Local draft for the no-app link page: the visitor's wish text and where they were in the wizard.
// Web uses localStorage directly (works in a plain browser tab); native uses AsyncStorage.
// Storage failures (private mode, quota) never block the page: reads return null, writes are dropped.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

export type LinkStep = "first" | "wish" | "handle" | "contact" | "done";

export type LinkDraft = {
  wishText: string;
  /** True when the visitor chose "Not now, just help". */
  skipped: boolean;
  /** Last step reached, so a refresh resumes there (never past "contact": done needs the server result). */
  step: LinkStep;
  savedAt: number;
};

const PREFIX = "wishwell.linkDraft.";
const STEPS: readonly LinkStep[] = ["first", "wish", "handle", "contact", "done"];

function webStore(): Storage | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

async function getRaw(key: string): Promise<string | null> {
  try {
    if (Platform.OS === "web") return webStore()?.getItem(key) ?? null;
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function setRaw(key: string, value: string | null): Promise<void> {
  try {
    if (Platform.OS === "web") {
      const store = webStore();
      if (!store) return;
      if (value === null) store.removeItem(key);
      else store.setItem(key, value);
      return;
    }
    if (value === null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, value);
  } catch {
    // Draft persistence is best-effort.
  }
}

/** Parses a stored draft; anything malformed reads as no draft. */
export function parseDraft(raw: string | null): LinkDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<LinkDraft>;
    if (typeof d.wishText !== "string") return null;
    const step = STEPS.includes(d.step as LinkStep) ? (d.step as LinkStep) : "first";
    return {
      wishText: d.wishText.slice(0, 500),
      skipped: d.skipped === true,
      step: step === "done" ? "contact" : step,
      savedAt: typeof d.savedAt === "number" ? d.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export async function loadDraft(hopId: string): Promise<LinkDraft | null> {
  return parseDraft(await getRaw(PREFIX + hopId));
}

export async function saveDraft(hopId: string, draft: Omit<LinkDraft, "savedAt">): Promise<void> {
  await setRaw(PREFIX + hopId, JSON.stringify({ ...draft, savedAt: Date.now() }));
}

export async function clearDraft(hopId: string): Promise<void> {
  await setRaw(PREFIX + hopId, null);
}

/** Resolves to `fallback` when `p` rejects or takes longer than `ms`. */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      },
    );
  });
}
