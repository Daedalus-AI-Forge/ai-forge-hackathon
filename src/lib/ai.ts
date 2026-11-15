// Demo-only "AI": template-based so the clickable demo works offline.
import type { WishType } from "./store";
const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms));
export async function polishWish(type: WishType, text: string) {
  await wait();
  const why: Record<WishType, string> = {
    activity: "Doing it solo got old — I'd love someone to get lost in it with, and laugh at the mistakes together.",
    guide: "I'd rather skip the guidebook and see the city through a local's eyes.",
    been: "I want to hear the details photos never capture, from someone who was actually there.",
    same: "New place, new life. It'd mean a lot to meet someone in the exact same spot.",
  };
  const t = text.trim().replace(/\.$/, "");
  return `${t[0]?.toUpperCase() ?? ""}${t.slice(1)}. ${why[type]}`;
}
export function memoryPrompt(text: string) {
  const s = text.toLowerCase();
  if (s.includes("drum") || s.includes("band") || s.includes("music"))
    return "Drummers tend to hang out in college bands, church groups, music programs, and at local venues. Know anyone in those circles?";
  if (s.includes("tokyo") || s.includes("japan") || s.includes("izakaya"))
    return "Think: friends who studied in Japan, coworkers at Japanese companies, the sushi obsessive in your group chat…";
  if (s.includes("antarctica"))
    return "People who've been to Antarctica: research crews, wildlife photographers, adventurous relatives, cruise industry folks…";
  return "Think about your college friends, coworkers, workout crew, family — who has the widest circle?";
}
export async function draftRelay(sender: string, wisher: string, wish: string, who: string, tags: string[]) {
  await wait();
  return `Hey${who ? " " + who : ""}! We're doing a Wishwell 🔴 ${wisher} wants to ${wish.replace(/^find /i, "find ")}. ${tags.length ? `I thought of you because you're ${tags.join(", ")}. ` : ""}If it's you, tap "It's me." If not, pass it to someone who might know — fewer hops wins. — ${sender}`;
}

/** Friendly forwarding nudges: neutral circles only, never private traits of a specific person. */
const NUDGES = [
  "A friend who grew up in a big family", "The friend who's always planning the next trip",
  "Someone who's lived in three or more cities", "Your most social coworker",
  "A friend from a club, team, or band", "Someone who knows everyone at the gym",
  "The friend who always has a story", "A cousin or relative who moved abroad",
];
export function forwardNudges(seed: string) {
  let h = 0; for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return [0, 1, 2].map((i) => NUDGES[(h + i * 3) % NUDGES.length]!);
}
const PROPHECIES = [
  "someone who cycled across the Sahara", "a jazz pianist who plays in a Tokyo subway", "someone who once lived on a sailboat for a year",
  "a person who's hiring for their dream team", "someone who learned to surf at 50", "a beekeeper on a city rooftop",
];
/** The prophecy: given when you forward. The receipt comes when it arrives. */
export async function prophecy(seed: string) {
  await wait(900);
  let h = 7; for (const c of seed) h = (h * 33 + c.charCodeAt(0)) >>> 0;
  return `These three forwards could help you meet ${PROPHECIES[h % PROPHECIES.length]}. We'll tell you when it arrives.`;
}

/** Hop Router (demo): one friendly clue + 3 jogger questions pointing at work, hobby and family. */
export function clueCard(wishText: string) {
  const t = wishText.replace(/^find /i, "");
  return {
    clue: `Pass it to the friend most likely to know ${t}.`,
    joggers: [
      "Who at work or school has the widest circle?",
      "Who's in a club, team, band or group chat that's always up to something?",
      "Which cousin, sibling or family friend knows everyone?",
    ],
  };
}
export const VOUCH_HOW = ["college", "work", "neighbors", "family", "a friend's friend"];
export const VOUCH_LONG = ["under a year", "1–5 years", "5+ years"];
export const VOUCH_WORD = ["kind", "reliable", "fun", "curious", "generous"];
export function draftVouch3(name: string, how?: string, long?: string, word?: string) {
  if (!how && !long && !word) return "";
  return `I know ${name}${how ? ` from ${how}` : ""}${long ? `, ${long}` : ""}.${word ? ` One word: ${word}.` : ""}`;
}
export function draftForward(to: string, wisher: string, wish: string, tags: string[]) {
  return `Hey ${to || "you"}! ${wisher} wants to ${wish}.${tags.length ? ` Thought of you — ${tags.join(", ")}.` : ""} You also get a free wish 🪙`;
}
