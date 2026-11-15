import { createContext, useContext, useState, type ReactNode } from "react";
import type React from "react";
import { CHAIN_HOURS, RESCUE_HOURS, haversineKm, tierFor, MAX_HOPS } from "./rules";
import drumPhoto from "@/assets/drum-meet.jpg";

export const CITIES: Record<string, { lat: number; lng: number; country: string }> = {
  "San Francisco": { lat: 37.77, lng: -122.42, country: "USA" },
  Shanghai: { lat: 31.23, lng: 121.47, country: "China" },
  London: { lat: 51.5, lng: -0.12, country: "UK" },
  "New York": { lat: 40.71, lng: -74.0, country: "USA" },
  Tokyo: { lat: 35.68, lng: 139.69, country: "Japan" },
};
export type WishType = "activity" | "guide" | "been" | "same";
export const WISH_TYPES: { id: WishType; label: string; emoji: string; example: string }[] = [
  { id: "activity", label: "Activity partner", emoji: "🥁", example: "find someone to play drums with" },
  { id: "guide", label: "Local guide", emoji: "🏮", example: "find a Tokyo local to show me izakayas" },
  { id: "been", label: "Been there", emoji: "🧭", example: "find someone who has been to Antarctica" },
  { id: "same", label: "Same boat", emoji: "🚲", example: "find someone who also just moved to SF" },
];
export type Hop = {
  id: string; name: string; city: string; message: string;
  action: "wish" | "forward" | "group" | "its_me"; at: number; contact?: string | undefined;
  /** One line vouching for the person who passed it to this holder. */
  vouch?: string | undefined;
  /** Who this hop was passed to (pending holder). */
  to?: string | undefined;
  /** The (up to) 3 friends this holder forwarded the link to. */
  fanout?: string[] | undefined;
};
export type Wish = {
  id: string; creator: string; type: WishType; mode?: "daily" | "real"; text: string; story: string;
  status: "active" | "pending" | "connected" | "completed" | "broken";
  createdAt: number; expiresAt: number; meetDeadline?: number;
  hops: Hop[]; photo?: string; offline?: boolean; rescues: string[]; endStory?: string;
};
export type Person = { name: string; channel: string; contact: string; tags: string[]; together: number; city: string };

const H = 3600_000;
const now = Date.now();
const hop = (id: string, name: string, city: string, message: string, action: Hop["action"], ago: number, vouch?: string, to?: string): Hop =>
  ({ id, name, city, message, action, at: now - ago * H, vouch, to });

const seedWishes: Wish[] = [
  {
    id: "w1", creator: "Louise", type: "activity", text: "find someone to play drums with",
    story: "Six months in SF and my e-drum kit has only ever known me. Looking for someone to jam some funk with on weekends.",
    status: "completed", createdAt: now - 200 * H, expiresAt: now - 152 * H, offline: true,
    hops: [
      hop("h1", "Louise", "San Francisco", "Looking for a drum buddy!", "wish", 200),
      hop("h2", "Wei", "Shanghai", "My college band's drummer moved to the Bay — asking him for you!", "forward", 190, "Louise is the most fearless person I know — she moved here alone."),
      hop("h3", "Sam", "San Francisco", "It's me! Drummer in a basement band in the Mission.", "its_me", 180, "Wei was my bandmate for four years. Never missed a gig."),
    ],
    photo: drumPhoto, rescues: [],
    endStory: "A red thread left San Francisco, crossed the Pacific to Shanghai, and landed 3 km from where it began. Now they jam every Saturday.",
  },
  {
    id: "w2", creator: "Louise", type: "guide", text: "find a Tokyo local to show me izakayas",
    story: "First trip to Tokyo next month. I want to skip the tourist spots and eat yakitori at a counter with a local.",
    status: "active", createdAt: now - 28 * H, expiresAt: now + 20 * H,
    hops: [
      hop("h4", "Louise", "San Francisco", "Seeking a Tokyo izakaya guide!", "wish", 28),
      hop("h5", "Emma", "London", "I did a year abroad in Tokyo — passing to my old roommate!", "forward", 20, "Louise and I were roommates in college. She plans the best trips."),
      hop("h6", "Kenji", "Tokyo", "A friend of mine runs an izakaya — posted it in our group chat.", "group", 6, "Emma and I lived together in Shinjuku. She knows good food."),
    ],
    rescues: [],
  },
  {
    id: "w3", creator: "Mia", type: "been", text: "find someone who has been to Antarctica",
    story: "I'm writing a picture book about a penguin and want to hear what Antarctica actually sounds like from someone who's been.",
    status: "active", createdAt: now - 47.8 * H, expiresAt: now + 10 * 60_000,
    hops: [
      hop("h7", "Mia", "New York", "Has anyone been to Antarctica?", "wish", 47.8),
      hop("h8", "Louise", "San Francisco", "My coworker went to Argentina — asking her!", "forward", 40, "Mia illustrates kids' books. Always curious."),
      hop("h9", "Oliver", "London", "My uncle worked on a research vessel. Sending to him.", "forward", 30, "Louise is my coworker — she never asks for favors lightly."),
      hop("h10", "Lina", "Shanghai", "Asking his old crewmates now.", "forward", 10, "Oliver was my lab partner, totally trustworthy."),
    ],
    rescues: [],
  },
  {
    id: "w4", creator: "Oliver", type: "same", mode: "real", text: "find someone who switched out of pre-med",
    story: "I'm three years into pre-med and want to talk to someone who walked away and is happy they did.",
    status: "active", createdAt: now - 9 * H, expiresAt: now + 39 * H,
    hops: [
      hop("h11", "Oliver", "London", "Anyone know a pre-med dropout?", "wish", 9),
      hop("h12", "Yuki", "Tokyo", "Louise, you know everyone in tech — any ex-pre-meds?", "forward", 3, "Oliver and I did a summer program together. Kind and thoughtful.", "Louise"),
    ],
    rescues: [],
  },
];

/** Receipts: a past forward of yours arrived somewhere and met someone. */
export type Receipt = { id: string; day: string; route: string[]; km: number; met: string; via: string; circle: string };
export const RECEIPTS: Receipt[] = [
  { id: "r1", day: "Thursday", route: ["San Francisco", "London", "Shanghai"], km: 18200, met: "someone who cycled across the Sahara", via: "Lina", circle: "a cycling crew" },
];

/** Today's community-wide challenge (Wordle-style, one per day). */
export const DAILY = {
  id: "d1", text: "someone who has cried in three different countries", emoji: "🌍",
  players: 1284, bestHops: 2, endsAt: (() => { const d = new Date(now); d.setHours(24, 0, 0, 0); return d.getTime(); })(),
};

const seedNetwork: Person[] = [
  { name: "Wei", channel: "WeChat", contact: "wangwei_sh", tags: ["plays in a band", "Shanghai native"], together: 1, city: "Shanghai" },
  { name: "Sam", channel: "Instagram", contact: "@sam.drums", tags: ["drummer", "taco lover"], together: 1, city: "San Francisco" },
  { name: "Emma", channel: "Phone", contact: "+44 7700 900", tags: ["studied in Tokyo", "foodie"], together: 1, city: "London" },
  { name: "Oliver", channel: "WeChat", contact: "oliver_ldn", tags: ["polar nerd", "studied in Iceland"], together: 0, city: "London" },
  { name: "Yuki", channel: "Instagram", contact: "@yuki.tk", tags: ["Tokyo local", "barista"], together: 0, city: "Tokyo" },
];

type Me = { name: string; city: string; credits: number; stars: number; streak: number; tags: string[] };

type Ctx = {
  me: Me; wishes: Wish[]; network: Person[];
  findHop: (hopId: string) => { wish: Wish; hop: Hop } | undefined;
  makeWish: (type: WishType, text: string, story: string, opts?: { free?: boolean; by?: { name: string; city: string } }) => Wish | null;
  relay: (wishId: string, h: Omit<Hop, "id" | "at">) => Hop;
  confirm: (wishId: string, yes: boolean) => void;
  uploadPhoto: (wishId: string, url: string, offline: boolean) => void;
  rescue: (wishId: string) => boolean;
  redeem: () => boolean;
};
// Keep one context object across hot reloads; otherwise the provider and pages can hold different copies.
const g = globalThis as { __rtStoreCtx?: React.Context<Ctx | null> };
const StoreCtx = (g.__rtStoreCtx ??= createContext<Ctx | null>(null));

let n = 100;
const uid = (p: string) => `${p}${++n}${Math.random().toString(36).slice(2, 6)}`;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me>({ name: "Louise", city: "San Francisco", credits: 1, stars: 3, streak: 6, tags: ["great cook", "drummer", "new in SF"] });
  const [wishes, setWishes] = useState<Wish[]>(seedWishes);
  const update = (id: string, f: (w: Wish) => Wish) => setWishes((ws) => ws.map((w) => (w.id === id ? f(w) : w)));

  const ctx: Ctx = {
    me, wishes, network: seedNetwork,
    findHop: (hopId) => {
      for (const w of wishes) { const h = w.hops.find((x) => x.id === hopId); if (h) return { wish: w, hop: h }; }
      return undefined;
    },
    makeWish: (type, text, story, opts) => {
      if (!opts?.free && me.credits < 1) return null;
      const by = opts?.by ?? { name: me.name, city: me.city };
      const t = Date.now();
      const w: Wish = {
        id: uid("w"), creator: by.name, type, text, story, status: "active", createdAt: t,
        expiresAt: t + CHAIN_HOURS * H, rescues: [],
        hops: [{ id: uid("h"), name: by.name, city: by.city, message: text, action: "wish", at: t }],
      };
      if (!opts?.free) setMe((m) => ({ ...m, credits: m.credits - 1 }));
      setWishes((ws) => [w, ...ws]);
      return w;
    },
    relay: (wishId, h) => {
      const nh: Hop = { ...h, id: uid("h"), at: Date.now() };
      update(wishId, (w) => {
        const hops = [...w.hops, nh];
        if (h.action === "its_me") return { ...w, hops, status: "pending" };
        if (hops.length - 1 > MAX_HOPS) return { ...w, hops, status: "broken" };
        return { ...w, hops };
      });
      return nh;
    },
    confirm: (wishId, yes) => update(wishId, (w) => yes
      ? { ...w, status: "connected", meetDeadline: Date.now() + 7 * 24 * H }
      : { ...w, status: "active", hops: w.hops.slice(0, -1) }),
    uploadPhoto: (wishId, url, offline) => {
      const w = wishes.find((x) => x.id === wishId);
      update(wishId, (w) => ({
        ...w, photo: url, offline, status: "completed",
        endStory: `A red thread passed through ${w.hops.length - 1} hands and ${Math.round(totalKm(w))} km to tie ${w.creator} and ${w.hops.at(-1)?.name} together. They finally met — and the story is just getting started.`,
      }));
      if (w) {
        const gold = tierFor(w.hops.length - 1) === "gold";
        setMe((m) => ({ ...m, credits: m.credits + 1, stars: m.stars + (gold ? 1 : 0) + (offline ? 1 : 0) }));
      }
    },
    rescue: (wishId) => {
      if (me.stars < 1) return false;
      setMe((m) => ({ ...m, stars: m.stars - 1 }));
      update(wishId, (w) => ({
        ...w, status: "active", rescues: [...w.rescues, me.name],
        expiresAt: Math.max(w.expiresAt, Date.now()) + RESCUE_HOURS * H,
      }));
      return true;
    },
    redeem: () => {
      if (me.stars < 2) return false;
      setMe((m) => ({ ...m, stars: m.stars - 2, credits: m.credits + 1 }));
      return true;
    },
  };
  return <StoreCtx.Provider value={ctx}>{children}</StoreCtx.Provider>;
}
export const useStore = () => { const c = useContext(StoreCtx); if (!c) throw new Error("no store"); return c; };

const SF = { lat: 37.77, lng: -122.42 };
const cityOf = (c: string) => CITIES[c] ?? SF;
export function totalKm(w: Wish) {
  let km = 0;
  for (let i = 1; i < w.hops.length; i++) km += haversineKm(cityOf(w.hops[i - 1]!.city), cityOf(w.hops[i]!.city));
  return km;
}
/** Footprints: how far your forwards walked after leaving your hands. */
export function footprints(wishes: Wish[], name: string) {
  let best: { wish: Wish; route: string[]; km: number } | null = null;
  for (const w of wishes) {
    const i = w.hops.findIndex((h) => h.name === name);
    if (i < 1 || i === w.hops.length - 1) continue;
    const tail = w.hops.slice(i);
    let km = 0;
    for (let j = 1; j < tail.length; j++) km += haversineKm(cityOf(tail[j - 1]!.city), cityOf(tail[j]!.city));
    if (!best || tail.length > best.route.length) best = { wish: w, route: tail.map((h) => h.city), km };
  }
  return best;
}
export function badgesFor(w: Wish) {
  const b: string[] = [];
  const first = w.hops[0]!, last = w.hops.at(-1)!;
  if (w.status !== "completed") return b;
  if (first.city === last.city) b.push("Boomerang");
  if (new Set(w.hops.map((h) => CITIES[h.city]?.country)).size >= 3) b.push("Around the World");
  if (first.city === last.city) b.push("Right Next Door");
  return b;
}
