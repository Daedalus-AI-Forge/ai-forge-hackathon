// Turn a Convex client error into the one-line message the server meant to show.

const FALLBACK = "Something went wrong. Try again.";

export function cleanError(e: unknown): string {
  if (e && typeof e === "object" && "data" in e && typeof (e as { data: unknown }).data === "string") {
    return (e as { data: string }).data;
  }
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!raw) return FALLBACK;
  const uncaught = raw.match(/Uncaught (?:\w*Error): ([^\n]+)/);
  if (uncaught) return uncaught[1].trim();
  const line = raw
    .replace(/\[CONVEX [^\]]*\]\s*/g, "")
    .replace(/\[Request ID: [^\]]*\]\s*/g, "")
    .replace(/^Server Error\s*/, "")
    .split("\n")[0]
    .trim();
  return line || FALLBACK;
}

export function isSixDigitCode(code: string) {
  return /^\d{6}$/.test(code);
}
