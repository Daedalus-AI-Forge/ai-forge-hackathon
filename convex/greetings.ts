// Shared FACTS-only rules for AI greetings (pass-on, vouch, intro).
// Design: docs/superpowers/specs/2026-11-15-ai-greetings-design.md
// The model gets an explicit FACTS block; `checkDraft` then rejects any draft that
// names a person/place, or uses a number, that is not in FACTS, contains a URL,
// uses pressure/share wording, or is too long. Callers fall back to a template.

export const FACTS_RULES =
  "Use ONLY the facts in FACTS. Never invent jobs, places, history or feelings. " +
  "Never mention tags, graphs, apps' data or anyone not named in FACTS. " +
  'No pressure: no deadlines-as-threats, no "forward to unlock", no rewards for sharing, no "share with friends". ' +
  "Plain ASCII quotes. At most one emoji, never in the first 70 characters. Output only the text.";

const PRESSURE = /unlock|forward this|share (this|with)|红包|助力|分享|\bh(ours?)? left\b|\d+h\b|ripple|deadline|expires?|hurry|last chance/i;
const URL_LIKE = /https?:|www\.|\b[a-z0-9-]+\.(com|net|org|io|app|co|ly|me)\b/i;

// Capitalized words that are not names or places.
const COMMON = new Set(
  (
    "i i'm i'd i've i'll me my we our you you're your hi hey hello oh so and but or if a an the this that these those it it's " +
    "is are was were be do does did can could would will should may might want wants know knows anyone anybody someone somebody " +
    "anything something any some who what when where why how thought think thinking just maybe ok okay hope up let let's " +
    "friend friends small world thanks thank here there got have has had no yes not sounds sound up for to of in on at with " +
    "would love lovely great quick free fancy because since also really wish wishes paper boat" +
    " ask asked mind come came is it you or someone you'd"
  ).split(/\s+/),
);

function norm(s: string) {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .trim();
}

/** First name only ("Louise Chen" -> "Louise"). */
export function firstName(name: string | null | undefined) {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** First sentence of a wish, lowercased start, no trailing punctuation. */
export function wishGist(wishText: string, max = 80) {
  const first = norm(wishText).split(/(?<=[.!?])\s/)[0].replace(/[.!?]+$/, "");
  const g = first.charAt(0).toLowerCase() + first.slice(1);
  return g.length > max ? `${g.slice(0, max - 1).trimEnd()}...` : g;
}

/**
 * Clean an AI draft and verify it only uses FACTS. Returns the cleaned text,
 * or null when it must be replaced by the deterministic template.
 */
export function checkDraft(raw: string, facts: string[], maxChars: number): string | null {
  const text = norm(raw).replace(/^["']+|["']+$/g, "").trim();
  if (!text || text.length > maxChars) return null;
  if (URL_LIKE.test(text) || PRESSURE.test(text)) return null;
  const factText = norm(facts.join(" ")).toLowerCase();
  const factWords = new Set(factText.split(/[^\p{L}\p{N}']+/u).filter(Boolean).map((w) => w.replace(/'s$/, "")));
  for (const d of text.match(/\d+/g) ?? []) {
    if (!factText.includes(d)) return null;
  }
  for (const m of text.match(/\b[A-Z][\p{L}'-]*/gu) ?? []) {
    const w = m.toLowerCase().replace(/'s$/, "").replace(/-+$/, "");
    if (COMMON.has(w) || factWords.has(w)) continue;
    return null;
  }
  return text;
}
