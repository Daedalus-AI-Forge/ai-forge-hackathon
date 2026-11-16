// Turn a Convex client error into the one-line message the server meant to show.

const FALLBACK = "Something went wrong. Try again.";

/** Cut a trailing JS stack frame (" at handler (convex/x.ts:3)") off a one-line message. */
const dropFrames = (s: string) => s.replace(/\s+at\s+\S+\s+\([^)]*\)[\s\S]*$/, "").trim();

export function cleanError(e: unknown): string {
  if (e && typeof e === "object" && "data" in e) {
    const data = (e as { data: unknown }).data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string") {
      return (data as { message: string }).message;
    }
  }
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  if (!raw) return FALLBACK;
  const convexJson = raw.match(/Uncaught ConvexError: (\{[^\n]*?\})(?:\s+at\s|\n|$)/);
  if (convexJson) {
    try {
      const parsed = JSON.parse(convexJson[1]) as { message?: unknown };
      if (typeof parsed.message === "string") return parsed.message;
    } catch {
      // fall through to the generic line cleanup
    }
  }
  const uncaught = raw.match(/Uncaught (?:\w*Error): ([^\n]+)/);
  if (uncaught) return dropFrames(uncaught[1]) || FALLBACK;
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
