// Team demo data (docs/demo/team-chain.md): 4 real team members who sign in with their own
// phone numbers, each with 20 generated close friends plus the guaranteed demo chain
// Darren -> Louise -> Katie -> Dazi. Phone numbers are run-time arguments only.
//
//   npx convex run teamSeed:run '{"members":[{"key":"darren","name":"Darren","phone":"+1..."}, ...]}'
//
// Idempotent: every row it writes hangs off a wish tagged `teamKey`, and members carry
// `users.teamKey`; a re-run deletes exactly those rows before reinserting. It never touches
// other users or the `seed:run` demo data. Meet-up photos attached by scripts/seed-gallery.mjs
// are carried over to the reinserted voyages, so the gallery survives a reseed.
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { deleteUserAndAuthData } from "./authUsers";
import { LIMITS, avatarFor, clampText, cleanTags, recordEdges } from "./lib";
import { REASON_MAX, personKey } from "./graphShared";
import { bestBot, botVouch } from "./bots";
import { THANK_YOU_MAX } from "./meetings";
import { addToPool, fillMissingPhotos } from "./gallery";

export const TEAM_KEYS = ["darren", "louise", "katie", "dazi"] as const;
export type TeamKey = (typeof TEAM_KEYS)[number];

/** Deterministic device id bound to a member when `bindDevices` is set (rehearsal script). */
export function teamDeviceId(key: TeamKey) {
  return `dev_team_${key}`;
}

/** The wish text the demo tosses; the chain is tuned so each hop's coach ranks the next person first. */
export const DEMO_WISH_TEXT = "someone to jam on drums with in the Bay Area";

/** Hidden holder wish for a member's seeded graph (status faded, mode fun). */
export const GRAPH_WISH_TEXT = "My close friends (team seed)";

const PHONE_PROVIDER = "phone"; // convex/phoneProvider.ts: createAccount({ provider: "phone", account: { id: e164 } })
const FRIENDS_PER_MEMBER = 20;
const BATCH = 500;

// Tea-ceremony demo story (docs/submission/demo-script.md): Louise wishes from California,
// Katie (two years in Osaka) passes it on, Darren makes ceramics in Kyoto, Dazi teaches tea.
const MEMBER_CITY: Record<TeamKey, string> = {
  darren: "Kyoto",
  louise: "California",
  katie: "Osaka",
  dazi: "Kyoto",
};

/** The demo wish Louise types; her coach must rank Katie first with a daily-boat evidence line. */
export const TEA_WISH_TEXT = "Talk to someone who really practices the Japanese tea ceremony";
const DAY = 24 * 60 * 60 * 1000;

/**
 * A person in one member's graph who came from a daily boat `daysAgo` days ago (edges carry
 * `at`). The graph hop records where they live so the map and link page can place them.
 */
const DAILY_PEOPLE: Partial<Record<TeamKey, { to: TeamKey; probe: string; tags: string[]; reason: string; city: string; daysAgo: number }>> = {
  louise: {
    to: "katie",
    probe: "someone who has lived abroad",
    tags: ["japan", "osaka", "lived-abroad", "traditional-arts-adjacent"],
    reason: "Spent two years in Osaka",
    city: "Osaka",
    daysAgo: 21,
  },
};

/** Crafted chain edges: owner -> next person. Tags/reasons chosen so keyword ranking puts them first. */
const CHAIN: Partial<Record<TeamKey, { to: TeamKey; tags: string[]; reason: string }>> = {
  // "jam" is added to the requested [music, band, sf]: none of those words occur in the demo
  // wish, so without it keyword ranking would score Louise 0 and the coach would skip her.
  darren: { to: "louise", tags: ["music", "band", "sf", "jam"], reason: "Plays bass in a Mission garage band — knows every musician in SF" },
  louise: { to: "katie", tags: ["drums", "music", "oakland"], reason: "Took drum lessons with her; she knows every drummer in the East Bay" },
  katie: { to: "dazi", tags: ["drums", "jam", "berkeley"], reason: "Drummer in a Berkeley jam collective — plays every week" },
};
const TEAMMATE = { tags: ["wishwell", "hackathon"], reason: "Building Wishwell with me at the YC hackathon" };

// ---------- deterministic friend generator ----------

/** mulberry32 over a string hash: same member key -> same 20 friends on every run. */
export function prng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 3432918353) >>> 0;
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = [
  "Maya", "Ethan", "Sofia", "Noah", "Aisha", "Lucas", "Priya", "Mateo", "Hana", "Owen",
  "Camila", "Jonah", "Leila", "Diego", "Nora", "Ravi", "Elena", "Theo", "Mina", "Gabe",
  "Zoe", "Arjun", "Isla", "Marcus", "Yuna", "Felix", "Tessa", "Kofi", "Ines", "Jasper",
  "Lena", "Omar", "Ruby", "Andre", "Mei", "Caleb", "Sana", "Hugo", "Ada", "Rafael",
];
const LAST = [
  "Nguyen", "Patel", "Garcia", "Kim", "Okafor", "Chen", "Rossi", "Silva", "Tanaka", "Murphy",
  "Haddad", "Lopez", "Schmidt", "Park", "Reyes", "Cohen", "Ibrahim", "Wong", "Novak", "Bennett",
  "Alvarez", "Singh", "Larsen", "Mendes", "Sato", "Adeyemi", "Fischer", "Castillo", "Huang", "Byrne",
];
const CITIES: { slug: string; label: string }[] = [
  { slug: "sf-mission", label: "the Mission, SF" },
  { slug: "sf-soma", label: "SoMa, SF" },
  { slug: "sf-sunset", label: "the Sunset, SF" },
  { slug: "oakland", label: "Oakland" },
  { slug: "berkeley", label: "Berkeley" },
  { slug: "palo-alto", label: "Palo Alto" },
  { slug: "mountain-view", label: "Mountain View" },
  { slug: "sunnyvale", label: "Sunnyvale" },
  { slug: "san-jose", label: "San Jose" },
  { slug: "fremont", label: "Fremont" },
  { slug: "san-mateo", label: "San Mateo" },
  { slug: "redwood-city", label: "Redwood City" },
];
const JOBS: { slug: string; label: string }[] = [
  { slug: "designer", label: "product designer" },
  { slug: "pm", label: "product manager" },
  { slug: "nurse", label: "ER nurse" },
  { slug: "teacher", label: "high school teacher" },
  { slug: "barista", label: "barista" },
  { slug: "swe", label: "software engineer" },
  { slug: "chef", label: "line chef" },
  { slug: "photographer", label: "wedding photographer" },
  { slug: "founder", label: "startup founder" },
  { slug: "data-scientist", label: "data scientist" },
  { slug: "lawyer", label: "immigration lawyer" },
  { slug: "architect", label: "architect" },
  { slug: "vet", label: "veterinarian" },
  { slug: "writer", label: "tech writer" },
  { slug: "researcher", label: "biotech researcher" },
];
/** Habit tag + the phrase used in the reason. Music habits are only for members off the chain. */
const HABITS: { tag: string; phrase: string; music?: true }[] = [
  { tag: "climbing", phrase: "climbs every Sunday" },
  { tag: "running", phrase: "runs the Embarcadero at dawn" },
  { tag: "ramen", phrase: "ramen hunter" },
  { tag: "hiking", phrase: "hikes Mount Tam most weekends" },
  { tag: "board games", phrase: "hosts board game nights" },
  { tag: "yoga", phrase: "does sunrise yoga" },
  { tag: "coffee", phrase: "pour-over coffee nerd" },
  { tag: "surfing", phrase: "surfs Ocean Beach" },
  { tag: "photography", phrase: "shoots street photos on film" },
  { tag: "film", phrase: "never misses an indie screening" },
  { tag: "volunteering", phrase: "volunteers at the food bank" },
  { tag: "cycling", phrase: "bikes to work every day" },
  { tag: "tennis", phrase: "plays doubles tennis" },
  { tag: "dancing", phrase: "takes salsa classes" },
  { tag: "gardening", phrase: "keeps a rooftop garden" },
  { tag: "books", phrase: "runs a sci-fi book club" },
  { tag: "chess", phrase: "plays blitz chess online" },
  { tag: "baking", phrase: "bakes sourdough every week" },
  { tag: "guitar", phrase: "plays guitar at open mics", music: true },
  { tag: "drums", phrase: "drums in a garage band", music: true },
];

/** Global cities for `run({ global: true })`: labels match src/components/lv/threads/threadData.ts. */
export const GLOBAL_CITIES: { slug: string; label: string; country: string; lat: number; lng: number }[] = [
  { slug: "san-francisco", label: "San Francisco", country: "USA", lat: 37.77, lng: -122.42 },
  { slug: "nyc", label: "New York", country: "USA", lat: 40.71, lng: -74.0 },
  { slug: "seattle", label: "Seattle", country: "USA", lat: 47.61, lng: -122.33 },
  { slug: "austin", label: "Austin", country: "USA", lat: 30.27, lng: -97.74 },
  { slug: "toronto", label: "Toronto", country: "Canada", lat: 43.65, lng: -79.38 },
  { slug: "mexico-city", label: "Mexico City", country: "Mexico", lat: 19.43, lng: -99.13 },
  { slug: "sao-paulo", label: "São Paulo", country: "Brazil", lat: -23.55, lng: -46.63 },
  { slug: "london", label: "London", country: "UK", lat: 51.5, lng: -0.12 },
  { slug: "paris", label: "Paris", country: "France", lat: 48.86, lng: 2.35 },
  { slug: "berlin", label: "Berlin", country: "Germany", lat: 52.52, lng: 13.4 },
  { slug: "lisbon", label: "Lisbon", country: "Portugal", lat: 38.72, lng: -9.14 },
  { slug: "lagos", label: "Lagos", country: "Nigeria", lat: 6.52, lng: 3.38 },
  { slug: "nairobi", label: "Nairobi", country: "Kenya", lat: -1.29, lng: 36.82 },
  { slug: "dubai", label: "Dubai", country: "UAE", lat: 25.2, lng: 55.27 },
  { slug: "mumbai", label: "Mumbai", country: "India", lat: 19.08, lng: 72.88 },
  { slug: "bangalore", label: "Bangalore", country: "India", lat: 12.97, lng: 77.59 },
  { slug: "singapore", label: "Singapore", country: "Singapore", lat: 1.35, lng: 103.82 },
  { slug: "shanghai", label: "Shanghai", country: "China", lat: 31.23, lng: 121.47 },
  { slug: "tokyo", label: "Tokyo", country: "Japan", lat: 35.68, lng: 139.69 },
  { slug: "osaka", label: "Osaka", country: "Japan", lat: 34.69, lng: 135.5 },
  { slug: "kyoto", label: "Kyoto", country: "Japan", lat: 35.01, lng: 135.77 },
  { slug: "seoul", label: "Seoul", country: "Korea", lat: 37.57, lng: 126.98 },
  { slug: "sydney", label: "Sydney", country: "Australia", lat: -33.87, lng: 151.21 },
  { slug: "taipei", label: "Taipei", country: "Taiwan", lat: 25.03, lng: 121.57 },
];
// Members' home cities, for their hops on seeded voyages.
const BAY_COORDS: Record<string, { lat: number; lng: number }> = {
  California: { lat: 37.77, lng: -122.42 },
  "San Francisco": { lat: 37.77, lng: -122.42 },
  Oakland: { lat: 37.8, lng: -122.27 },
  Berkeley: { lat: 37.87, lng: -122.27 },
};

export type Friend = {
  name: string;
  age: number;
  city: string;
  job: string;
  tags: string[];
  reason: string;
  // Set only on global friends (`global: true`).
  country?: string;
  lat?: number;
  lng?: number;
};

/**
 * The member's 20 close friends. Members on the chain never get music habits, so nobody outranks it.
 * `global`: every other friend lives in a GLOBAL_CITIES city instead. The random stream is the
 * same in both modes (one draw per city pick), so names, ages, jobs and habits do not change.
 */
export function generateFriends(key: TeamKey, reserved: string[] = [], opts: { global?: boolean } = {}): Friend[] {
  const rand = prng(`team:${key}`);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const habits = HABITS.filter((h) => !h.music || key === "dazi");
  const taken = new Set(reserved.map(personKey));
  const friends: Friend[] = [];
  while (friends.length < FRIENDS_PER_MEMBER) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    if (taken.has(personKey(name))) continue;
    taken.add(personKey(name));
    const age = 22 + Math.floor(rand() * 24);
    const cityRoll = rand();
    const abroad = opts.global && friends.length % 2 === 1 ? GLOBAL_CITIES[Math.floor(cityRoll * GLOBAL_CITIES.length)] : null;
    const city = abroad ?? CITIES[Math.floor(cityRoll * CITIES.length)];
    const job = pick(JOBS);
    const count = 2 + Math.floor(rand() * 2);
    const chosen: (typeof HABITS)[number][] = [];
    while (chosen.length < count) {
      const h = pick(habits);
      if (!chosen.includes(h)) chosen.push(h);
    }
    friends.push({
      name,
      age,
      city: city.label,
      job: job.label,
      tags: [job.slug, ...chosen.map((h) => h.tag), city.slug],
      reason: `${age}, ${job.label} in ${city.label} — ${chosen.map((h) => h.phrase).join(", ")}`,
      ...(abroad ? { country: abroad.country, lat: abroad.lat, lng: abroad.lng } : {}),
    });
  }
  return friends;
}

// ---------- data access ----------

/** E.164 exactly as phone sign-in stores it (libphonenumber canonical form, no validity check so test numbers work). */
export function e164(raw: string) {
  const parsed = parsePhoneNumberFromString(raw.trim());
  const phone = parsed?.number;
  if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Each member needs an E.164 phone like +14155550123");
  return phone;
}

async function teamUsers(ctx: QueryCtx | MutationCtx) {
  const rows: Doc<"users">[] = [];
  for (const key of TEAM_KEYS) {
    rows.push(...(await ctx.db.query("users").withIndex("by_teamKey", (q) => q.eq("teamKey", key)).take(10)));
  }
  return rows;
}

/** Delete one wish and everything hanging off it (hops, vouches, edges + their memory docs). */
async function deleteWishTree(ctx: MutationCtx, wish: Doc<"wishes">) {
  const hops = await ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", wish._id)).take(BATCH);
  const owners = new Set<Id<"users"> | undefined>([wish.creatorId, undefined]);
  for (const h of hops) owners.add(h.holderUserId);
  for (const ownerUserId of owners) {
    const edges = await ctx.db
      .query("edges")
      .withIndex("by_ownerUserId", (q) => q.eq("ownerUserId", ownerUserId))
      .filter((q) => q.eq(q.field("wishId"), wish._id))
      .take(BATCH);
    for (const e of edges) {
      await ctx.db.delete("edges", e._id);
      await ctx.scheduler.runAfter(0, internal.memory.forget, { edgeId: e._id, ownerUserId: e.ownerUserId });
    }
  }
  for (const vch of await ctx.db.query("vouches").withIndex("by_wishId", (q) => q.eq("wishId", wish._id)).take(BATCH)) {
    await ctx.db.delete("vouches", vch._id);
  }
  for (const h of hops) await ctx.db.delete("hops", h._id);
  await ctx.db.delete("wishes", wish._id);
  return hops;
}

type GalleryPhoto = NonNullable<Doc<"wishes">["meetingPhoto"]>;

/**
 * Remove every row this seed wrote. Members keep their user + auth rows (they may have signed in).
 * Meet-up photos attached by `attachGalleryPhotos` are returned keyed by wish text (their files
 * stay in storage) so a re-run can put them back on the reinserted voyage.
 */
async function clearSeedData(ctx: MutationCtx) {
  const users = await teamUsers(ctx);
  let wishes = 0;
  const photos = new Map<string, GalleryPhoto>();
  for (const u of users) {
    const own = await ctx.db.query("wishes").withIndex("by_creatorId", (q) => q.eq("creatorId", u._id)).take(BATCH);
    for (const w of own) {
      if (!w.teamKey) continue;
      if (w.meetingPhoto) photos.set(w.text, w.meetingPhoto);
      await deleteWishTree(ctx, w);
      wishes++;
    }
  }
  return { users, wishes, photos };
}

/**
 * The users row a phone sign-in with `phone` resolves to, creating/repairing it the way
 * Convex Auth would: authAccounts(provider "phone", providerAccountId = E.164) -> userId.
 */
async function resolvePhoneUser(ctx: MutationCtx, phone: string, name: string, city: string) {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("providerAndAccountId", (q) => q.eq("provider", PHONE_PROVIDER).eq("providerAccountId", phone))
    .unique();
  let user = account ? await ctx.db.get("users", account.userId) : null;
  if (!user) user = await ctx.db.query("users").withIndex("phone", (q) => q.eq("phone", phone)).first();
  let created = false;
  if (!user) {
    const id = await ctx.db.insert("users", {
      name,
      avatar: avatarFor(name),
      city,
      wishesLeft: 3,
      stars: 0,
      phone,
      phoneVerificationTime: Date.now(),
    });
    user = (await ctx.db.get("users", id))!;
    created = true;
  }
  if (!account) {
    await ctx.db.insert("authAccounts", { userId: user._id, provider: PHONE_PROVIDER, providerAccountId: phone });
  } else if (account.userId !== user._id) {
    // Account pointed at a deleted user: repair the link.
    await ctx.db.patch("authAccounts", account._id, { userId: user._id });
  }
  return { user, created };
}

async function bindDevice(ctx: MutationCtx, userId: Id<"users">, deviceId: string | undefined) {
  if (!deviceId) return;
  const holders = await ctx.db.query("users").withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId)).take(10);
  for (const row of holders) if (row._id !== userId) await ctx.db.patch("users", row._id, { deviceId: undefined });
  await ctx.db.patch("users", userId, { deviceId });
}

/**
 * One person in the owner's graph: a depth-1 hop on the graph wish plus one edge per tag.
 * Teammates go through `recordEdges` (edges + Supermemory ingest). Generated friends get the
 * same edge rows but are NOT ingested: when Supermemory has hits, graphRank ranks by semantic
 * score alone, and 20 loosely similar friends ("Bay Area", "board game nights") outranked the
 * chain in rehearsal. Keyword ranking (no memory hits, or rate-limited) still covers them.
 */
async function writePerson(
  ctx: MutationCtx,
  owner: { userId: Id<"users">; name: string },
  wishId: Id<"wishes">,
  person: { name: string; tags: string[]; reason: string },
  opts: { ingest: boolean },
) {
  const hopId = await ctx.db.insert("hops", {
    wishId,
    depth: 1,
    holderName: person.name,
    recipientTags: person.tags,
    viaGroup: false,
  });
  if (opts.ingest) {
    return (await recordEdges(ctx, { owner, personName: person.name, tags: person.tags, reason: person.reason, wishId, hopId }))
      .length;
  }
  const tags = cleanTags(person.tags);
  for (const tag of tags) {
    await ctx.db.insert("edges", {
      ownerUserId: owner.userId,
      ownerName: clampText(owner.name, LIMITS.name),
      personName: clampText(person.name, LIMITS.name),
      tag,
      source: "pick",
      wishId,
      hopId,
      reason: clampText(person.reason, REASON_MAX) || undefined,
    });
  }
  return tags.length;
}

/**
 * A person the owner passed a daily boat to `daysAgo` days ago: a graph hop with their city and
 * one daily edge per tag dated `at`, ingested like teammates so semantic search sees them too.
 */
async function writeDailyPerson(
  ctx: MutationCtx,
  owner: { userId: Id<"users">; name: string },
  wishId: Id<"wishes">,
  name: string,
  p: { tags: string[]; reason: string; city: string; daysAgo: number },
  now: number,
) {
  const coords = coordsOf(p.city);
  const hopId = await ctx.db.insert("hops", {
    wishId,
    depth: 1,
    holderName: name,
    city: p.city,
    ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    recipientTags: p.tags,
    viaGroup: false,
  });
  const tags = cleanTags(p.tags);
  for (const tag of tags) {
    const edgeId = await ctx.db.insert("edges", {
      ownerUserId: owner.userId,
      ownerName: clampText(owner.name, LIMITS.name),
      personName: clampText(name, LIMITS.name),
      tag,
      source: "daily",
      wishId,
      hopId,
      reason: clampText(p.reason, REASON_MAX) || undefined,
      at: now - p.daysAgo * DAY,
    });
    await ctx.scheduler.runAfter(0, internal.memory.ingest, { edgeId });
  }
  return tags.length;
}

// ---------- global voyages (`global: true`) ----------

type VoyageHop = { who: TeamKey | string; city: string; action?: "pass" | "its_me"; note: string };
type Voyage = {
  creator: TeamKey;
  text: string;
  status: "traveling" | "found" | "granted";
  hops: VoyageHop[];
  thankYou?: string;
  /** Ending line; defaults to "<cities>: N hops around the world." */
  story?: string;
};

/** Seeded wishes whose hops cross the world. The last hop is the finder (its_me) unless still traveling. */
export const VOYAGES: Voyage[] = [
  {
    // Pre-completed copy of the live demo story, so the ending screen exists even if the live run fails.
    creator: "louise",
    text: TEA_WISH_TEXT,
    status: "granted",
    thankYou: "Dazi poured tea for us in Kyoto and showed me every step. Thank you Katie and Darren for passing it on!",
    story: "California → Osaka → Kyoto: 3 passes across the Pacific to a tea teacher of twenty years.",
    hops: [
      { who: "katie", city: "Osaka", action: "pass", note: "Darren makes ceramics in Kyoto" },
      { who: "darren", city: "Kyoto", action: "pass", note: "My teacher Dazi has practiced tea for twenty years" },
      { who: "dazi", city: "Kyoto", action: "its_me", note: "That's me! I've practiced tea for twenty years." },
    ],
  },
  {
    creator: "darren",
    text: "Someone to teach me how to make real tonkotsu broth",
    status: "granted",
    thankYou: "Yuki spent a whole Saturday on broth with me over video. Arigato, everyone who passed it on!",
    hops: [
      { who: "louise", city: "San Francisco", action: "pass", note: "My friend Ravi cooks like a pro and knows chefs everywhere" },
      { who: "Ravi Singh", city: "Bangalore", action: "pass", note: "Mina did a ramen stage in Asia, she will know" },
      { who: "Mina Park", city: "Seoul", action: "pass", note: "Yuki runs a tiny ramen counter in Tokyo" },
      { who: "Yuki Sato", city: "Tokyo", action: "its_me", note: "That's me! Broth is my whole life." },
    ],
  },
  {
    creator: "louise",
    text: "A street photographer to shoot golden hour with on my Lisbon trip",
    status: "granted",
    thankYou: "Rafael showed me the Alfama at sunset. Best photos I've ever taken.",
    hops: [
      { who: "katie", city: "Oakland", action: "pass", note: "Elena shoots film and travels constantly" },
      { who: "Elena Rossi", city: "London", action: "pass", note: "Ines is in every photo walk in Europe" },
      { who: "Ines Mendes", city: "Paris", action: "pass", note: "My cousin Rafael lives in Lisbon and shoots street" },
      { who: "Rafael Silva", city: "Lisbon", action: "its_me", note: "Golden hour in Lisbon is my thing, let's go." },
    ],
  },
  {
    creator: "katie",
    text: "A running buddy for a half marathon while I'm in Nairobi",
    status: "granted",
    thankYou: "Leila paced me the whole 21k. Asante sana!",
    hops: [
      { who: "dazi", city: "Berkeley", action: "pass", note: "Andre runs marathons all over the world" },
      { who: "Andre Fischer", city: "Berlin", action: "pass", note: "Kofi coaches a run club in Lagos" },
      { who: "Kofi Adeyemi", city: "Lagos", action: "pass", note: "Omar trains with East African runners" },
      { who: "Omar Haddad", city: "Dubai", action: "pass", note: "Leila runs Karura Forest every morning" },
      { who: "Leila Ibrahim", city: "Nairobi", action: "its_me", note: "I run Nairobi every day, come join." },
    ],
  },
  {
    creator: "dazi",
    text: "A late-night dumpling crawl buddy in Shanghai",
    status: "found",
    hops: [
      { who: "katie", city: "Oakland", action: "pass", note: "Mei knows every night market in Asia" },
      { who: "Mei Huang", city: "Taipei", action: "pass", note: "Arjun is the biggest foodie in Singapore" },
      { who: "Arjun Patel", city: "Singapore", action: "pass", note: "Jonah lives in Shanghai and eats out every night" },
      { who: "Jonah Wong", city: "Shanghai", action: "its_me", note: "Xiaolongbao at midnight? I'm in." },
    ],
  },
  {
    creator: "dazi",
    text: "Someone to jam on drums with on my São Paulo trip",
    status: "traveling",
    hops: [
      { who: "darren", city: "San Francisco", action: "pass", note: "Marcus plays in a jazz trio in NYC" },
      { who: "Marcus Bennett", city: "New York", action: "pass", note: "Diego tours Latin America with his band" },
      { who: "Diego Lopez", city: "Mexico City", action: "pass", note: "Camila drums in a samba school in São Paulo" },
      { who: "Camila Reyes", city: "São Paulo", note: "" },
    ],
  },
];

const HOUR = 60 * 60 * 1000;

function takePhoto(photos: Map<string, GalleryPhoto>, reattached: Set<string>, text: string) {
  const meetingPhoto = photos.get(text);
  if (!meetingPhoto) return {};
  reattached.add(text);
  return { meetingPhoto, meetingPhotoRevision: 1 };
}

function coordsOf(city: string) {
  const g = GLOBAL_CITIES.find((c) => c.label === city);
  return g ? { lat: g.lat, lng: g.lng } : BAY_COORDS[city];
}

/** Write the voyages as rows shaped like wishes.toss + hops.act + link.confirmClaim + meetings write them. */
async function writeVoyages(
  ctx: MutationCtx,
  members: { key: TeamKey; name: string; userId: Id<"users"> }[],
  now: number,
  photos: Map<string, GalleryPhoto> = new Map(),
  reattached = new Set<string>(),
) {
  let written = 0;
  for (const [vi, voyage] of VOYAGES.entries()) {
    const creator = members.find((m) => m.key === voyage.creator);
    if (!creator) continue;
    // Skip a voyage whose route needs a member who is not being seeded.
    if (voyage.hops.some((h) => (TEAM_KEYS as readonly string[]).includes(h.who) && !members.some((m) => m.key === h.who))) continue;
    const start = now - (72 - vi * 6) * HOUR;
    const wishId = await ctx.db.insert("wishes", {
      creatorId: creator.userId,
      type: "do_together",
      mode: "serious",
      text: voyage.text,
      status: voyage.status,
      expiresAt: voyage.status === "traveling" ? now + 48 * HOUR : start + 48 * HOUR,
      teamKey: voyage.creator,
    });
    let parent: Id<"hops"> | undefined;
    let winner: Id<"hops"> | undefined;
    for (const [i, h] of voyage.hops.entries()) {
      const member = members.find((m) => m.key === h.who);
      const acted = h.action !== undefined;
      const coords = coordsOf(h.city);
      const hopId: Id<"hops"> = await ctx.db.insert("hops", {
        wishId,
        parentHopId: parent,
        depth: i + 1,
        holderName: member?.name ?? h.who,
        holderUserId: member?.userId,
        city: acted ? h.city : undefined,
        lat: acted ? coords?.lat : undefined,
        lng: acted ? coords?.lng : undefined,
        recipientTags: [],
        viaGroup: false,
        passMessage: h.action === "pass" ? h.note : undefined,
        itsMeIntro: h.action === "its_me" ? h.note : undefined,
        introVouch: i > 0 ? voyage.hops[i - 1].note : undefined,
        action: h.action,
        actedAt: acted ? start + (i + 1) * 6 * HOUR : undefined,
      });
      if (h.action === "its_me") winner = hopId;
      parent = hopId;
    }
    if (voyage.status !== "traveling") {
      const depth = voyage.hops.length;
      await ctx.db.patch("wishes", wishId, {
        winningHopId: winner,
        meetDeadline: now + 5 * 24 * HOUR,
        ...(voyage.status === "granted"
          ? {
              metInPerson: true,
              tier: depth >= 5 ? ("gold" as const) : ("silver" as const),
              photoUrl: `https://picsum.photos/seed/wishwell-voyage-${vi}/800/800`,
              // A stored meet-up photo (scripts/seed-gallery.mjs) survives re-runs and wins over photoUrl.
              ...takePhoto(photos, reattached, voyage.text),
              endingStory:
                voyage.story ??
                `${voyage.hops.map((h) => h.city).join(" → ")}: ${depth} hops around the world. ${voyage.thankYou ?? ""}`.trim(),
            }
          : {}),
      });
    }
    written++;
  }
  return written;
}

/** Pool-filled photos carry no thank-you; give seeded granted voyages theirs. */
async function thankYouOnPoolPhotos(ctx: MutationCtx, members: { userId: Id<"users"> }[]) {
  for (const m of members) {
    const granted = await ctx.db
      .query("wishes")
      .withIndex("by_creatorId_and_status", (q) => q.eq("creatorId", m.userId).eq("status", "granted"))
      .take(BATCH);
    for (const w of granted) {
      const voyage = VOYAGES.find((vg) => vg.text === w.text);
      if (!w.teamKey || !voyage?.thankYou || !w.meetingPhoto || w.meetingPhoto.thankYou) continue;
      await ctx.db.patch("wishes", w._id, {
        meetingPhoto: { ...w.meetingPhoto, thankYou: clampText(voyage.thankYou, THANK_YOU_MAX) },
      });
    }
  }
}

// ---------- wish bots (`global: true`, convex/bots.ts) ----------

export const BOTS_PER_MEMBER = 5;
export const botTeamKey = (key: TeamKey) => `bot:${key}`;

/** The bots for one member: their first BOTS_PER_MEMBER global friends (deterministic). */
export function botFriends(key: TeamKey, reserved: string[]) {
  return generateFriends(key, reserved, { global: true })
    .filter((f) => f.lat !== undefined)
    .slice(0, BOTS_PER_MEMBER);
}

/** Upsert bot users (no phone, no contact, no deviceId); drop this member's stale bots. */
async function writeBots(ctx: MutationCtx, members: { key: TeamKey; name: string }[]) {
  const seen = new Set<string>();
  const bots: Doc<"users">[] = [];
  for (const m of members) {
    const existing = await ctx.db.query("users").withIndex("by_teamKey", (q) => q.eq("teamKey", botTeamKey(m.key))).take(50);
    const keep = new Set<Id<"users">>();
    for (const f of botFriends(m.key, members.map((x) => x.name))) {
      if (seen.has(personKey(f.name))) continue;
      seen.add(personKey(f.name));
      const fields = {
        name: f.name,
        avatar: avatarFor(f.name),
        city: f.city,
        wishesLeft: 0,
        stars: 0,
        isBot: true,
        teamKey: botTeamKey(m.key),
        botProfile: { tags: f.tags, persona: f.reason, lat: f.lat!, lng: f.lng!, country: f.country ?? "" },
      };
      const row = existing.find((u) => personKey(u.name) === personKey(f.name));
      const id = row ? (await ctx.db.patch("users", row._id, fields), row._id) : await ctx.db.insert("users", fields);
      keep.add(id);
      bots.push((await ctx.db.get("users", id))!);
    }
    for (const u of existing) if (!keep.has(u._id) && u.isBot) await ctx.db.delete("users", u._id);
  }
  return bots;
}

/** Fresh traveling wishes already in a bot's hands, so the map moves right after seeding. */
export const BOT_WISHES: { creator: TeamKey; text: string }[] = [
  { creator: "darren", text: "A climbing partner for a bouldering trip abroad" },
  { creator: "louise", text: "Someone to bake sourdough with while I travel" },
  { creator: "katie", text: "A hiking buddy for a mountain trail weekend" },
];

async function writeBotWishes(
  ctx: MutationCtx,
  members: { key: TeamKey; name: string; userId: Id<"users"> }[],
  bots: Doc<"users">[],
  now: number,
) {
  let written = 0;
  for (const bw of BOT_WISHES) {
    const creator = members.find((m) => m.key === bw.creator);
    const first = bestBot(bw.text, bots)?.bot ?? bots[written % Math.max(bots.length, 1)];
    if (!creator || !first) continue;
    const wishId = await ctx.db.insert("wishes", {
      creatorId: creator.userId,
      type: "do_together",
      mode: "serious",
      text: bw.text,
      status: "traveling",
      expiresAt: now + 48 * HOUR,
      teamKey: bw.creator,
    });
    const city = MEMBER_CITY[creator.key];
    const root = await ctx.db.insert("hops", {
      wishId,
      depth: 1,
      holderName: creator.name,
      holderUserId: creator.userId,
      city,
      ...coordsOf(city),
      recipientTags: [],
      viaGroup: false,
      passMessage: `${first.name.split(" ")[0]} came to mind first`,
      action: "pass",
      actedAt: now - 10 * 60 * 1000,
    });
    await ctx.db.insert("hops", {
      wishId,
      parentHopId: root,
      depth: 2,
      holderName: first.name,
      holderUserId: first._id,
      recipientTags: first.botProfile?.tags ?? [],
      viaGroup: false,
      introVouch: botVouch(first),
    });
    written++;
  }
  return written;
}

const memberValidator = v.object({
  key: v.union(v.literal("darren"), v.literal("louise"), v.literal("katie"), v.literal("dazi")),
  name: v.string(),
  phone: v.string(),
});

export const run = internalMutation({
  args: {
    members: v.array(memberValidator),
    // Bind dev_team_<key> device ids (scripts/team-chain.mjs). Off by default: a guessable
    // device id lets anyone act as that member and read their row (incl. phone) via users.me.
    bindDevices: v.optional(v.boolean()),
    // Half of each member's friends live abroad, plus VOYAGES routed across GLOBAL_CITIES.
    global: v.optional(v.boolean()),
  },
  returns: v.array(
    v.object({ key: v.string(), userId: v.id("users"), created: v.boolean(), edges: v.number(), deviceId: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, { members, bindDevices, global }) => {
    const keys = new Set(members.map((m) => m.key));
    if (members.length === 0 || keys.size !== members.length) throw new Error("Pass each team key at most once");
    const phones = members.map((m) => e164(m.phone));
    if (new Set(phones).size !== phones.length) throw new Error("Two members share a phone number");
    for (const m of members) if (!m.name.trim()) throw new Error(`Member ${m.key} needs a name`);

    const previous = await clearSeedData(ctx);
    // Drop stale markers (a key moved to another number, or devices no longer bound).
    for (const u of previous.users) {
      const patch: Partial<Doc<"users">> = {};
      if (!members.some((m, i) => m.key === u.teamKey && phones[i] === u.phone)) patch.teamKey = undefined;
      if (u.deviceId?.startsWith("dev_team_")) patch.deviceId = undefined;
      if (Object.keys(patch).length) await ctx.db.patch("users", u._id, patch);
    }

    const resolved = [];
    for (const [i, m] of members.entries()) {
      const name = m.name.trim();
      const city = MEMBER_CITY[m.key];
      const { user, created } = await resolvePhoneUser(ctx, phones[i], name, city);
      await ctx.db.patch("users", user._id, {
        name,
        avatar: avatarFor(name),
        city,
        wishesLeft: Math.max(user.wishesLeft, 3),
        phone: phones[i],
        phoneVerificationTime: user.phoneVerificationTime ?? Date.now(),
        teamKey: m.key,
      });
      await bindDevice(ctx, user._id, bindDevices ? teamDeviceId(m.key) : undefined);
      resolved.push({ key: m.key, name, userId: user._id, created });
    }

    const now = Date.now();
    const out = [];
    for (const me of resolved) {
      const owner = { userId: me.userId, name: me.name };
      const wishId = await ctx.db.insert("wishes", {
        creatorId: me.userId,
        type: "do_together",
        mode: "fun",
        text: GRAPH_WISH_TEXT,
        status: "faded",
        expiresAt: now - 1,
        teamKey: me.key,
      });
      const mates = resolved.filter((r) => r.key !== me.key);
      let edges = 0;
      for (const f of generateFriends(me.key, resolved.map((r) => r.name), { global })) {
        edges += await writePerson(ctx, owner, wishId, f, { ingest: false });
      }
      const chain = CHAIN[me.key];
      for (const mate of mates) {
        const crafted = chain && chain.to === mate.key ? chain : TEAMMATE;
        edges += await writePerson(ctx, owner, wishId, { name: mate.name, tags: crafted.tags, reason: crafted.reason }, { ingest: true });
      }
      const daily = DAILY_PEOPLE[me.key];
      const dailyMate = daily && resolved.find((r) => r.key === daily.to);
      if (daily && dailyMate) edges += await writeDailyPerson(ctx, owner, wishId, dailyMate.name, daily, now);
      out.push({ key: me.key, userId: me.userId, created: me.created, edges, deviceId: bindDevices ? teamDeviceId(me.key) : null });
    }
    const reattached = new Set<string>();
    const voyages = global ? await writeVoyages(ctx, resolved, now, previous.photos, reattached) : 0;
    // Fill the found voyage and any other blank success story from the stock pool.
    await fillMissingPhotos(ctx);
    if (global) await thankYouOnPoolPhotos(ctx, resolved);
    const bots = global ? await writeBots(ctx, resolved) : [];
    const botWishes = global ? await writeBotWishes(ctx, resolved, bots, now) : 0;
    console.log(
      JSON.stringify({ event: "team_seed.run", members: out.length, replacedWishes: previous.wishes, global: !!global, voyages, bots: bots.length, botWishes }),
    );
    return out;
  },
});

/**
 * Remove this seed's data. `deleteTestUsers` also deletes member rows (and their auth rows)
 * whose phone is a +1555 test number — never a real member.
 */
export const clear = internalMutation({
  args: { deleteTestUsers: v.optional(v.boolean()) },
  returns: v.object({ wishes: v.number(), deletedUsers: v.number() }),
  handler: async (ctx, { deleteTestUsers }) => {
    const { users, wishes } = await clearSeedData(ctx);
    let deletedUsers = 0;
    for (const u of users) {
      if (deleteTestUsers && u.phone?.startsWith("+1555")) {
        // Rehearsal leftovers created by these test users.
        for (const w of await ctx.db.query("wishes").withIndex("by_creatorId", (q) => q.eq("creatorId", u._id)).take(BATCH)) {
          await deleteWishTree(ctx, w);
        }
        await deleteUserAndAuthData(ctx, u._id);
        deletedUsers++;
      } else {
        await ctx.db.patch("users", u._id, {
          teamKey: undefined,
          ...(u.deviceId?.startsWith("dev_team_") ? { deviceId: undefined } : {}),
        });
      }
    }
    return { wishes, deletedUsers };
  },
});

/**
 * Undo one rehearsal wish (scripts/team-chain.mjs): its hops, vouches, edges, the network rows
 * its toss created, and the creator's spent wish. Refuses the seed's own graph wish.
 */
export const removeRehearsalWish = internalMutation({
  args: { wishId: v.id("wishes") },
  returns: v.object({ hops: v.number() }),
  handler: async (ctx, { wishId }) => {
    const wish = await ctx.db.get("wishes", wishId);
    if (!wish) return { hops: 0 };
    if (wish.teamKey) throw new Error("That is the team seed's graph wish; use teamSeed:clear");
    const creator = await ctx.db.get("users", wish.creatorId);
    if (!creator?.teamKey) throw new Error("Only rehearsal wishes tossed by a team member can be removed here");
    const hops = await deleteWishTree(ctx, wish);
    const names = new Set(hops.filter((h) => h.depth === 1).map((h) => personKey(h.holderName)));
    const network = await ctx.db.query("network").withIndex("by_ownerId", (q) => q.eq("ownerId", creator._id)).take(BATCH);
    for (const n of network) {
      if (n._creationTime >= wish._creationTime && names.has(personKey(n.personName))) await ctx.db.delete("network", n._id);
    }
    await ctx.db.patch("users", creator._id, { wishesLeft: creator.wishesLeft + 1 });
    return { hops: hops.length };
  },
});

/** Who is seeded, without phone numbers: lets scripts refuse a --fake run over real members. */
export const status = internalQuery({
  args: {},
  returns: v.array(v.object({ key: v.string(), name: v.string(), testNumber: v.boolean(), deviceBound: v.boolean() })),
  handler: async (ctx) =>
    (await teamUsers(ctx)).map((u) => ({
      key: u.teamKey ?? "",
      name: u.name,
      testNumber: !!u.phone?.startsWith("+1555"),
      deviceBound: !!u.deviceId?.startsWith("dev_team_"),
    })),
});

/** Where the seed's voyages and friends are: distinct cities/countries (verifies `global: true`). */
export const globalSummary = internalQuery({
  args: {},
  returns: v.object({
    voyages: v.array(v.object({ creator: v.string(), status: v.string(), route: v.array(v.string()) })),
    voyageCities: v.number(),
    friendCities: v.number(),
    countries: v.number(),
  }),
  handler: async (ctx) => {
    const voyages = [];
    const voyageCities = new Set<string>();
    const friendCities = new Set<string>();
    const countries = new Set<string>();
    for (const u of await teamUsers(ctx)) {
      for (const w of await ctx.db.query("wishes").withIndex("by_creatorId", (q) => q.eq("creatorId", u._id)).take(BATCH)) {
        if (!w.teamKey) continue;
        const hops = await ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", w._id)).take(BATCH);
        if (w.text === GRAPH_WISH_TEXT) {
          for (const h of hops) {
            const g = GLOBAL_CITIES.find((c) => h.recipientTags.includes(c.slug));
            if (g) { friendCities.add(g.label); countries.add(g.country); }
          }
          continue;
        }
        const route = hops.sort((a, b) => a.depth - b.depth).flatMap((h) => (h.city ? [h.city] : []));
        for (const c of route) {
          voyageCities.add(c);
          const g = GLOBAL_CITIES.find((x) => x.label === c);
          countries.add(g?.country ?? "USA");
        }
        voyages.push({ creator: w.teamKey, status: w.status, route });
      }
    }
    return { voyages, voyageCities: voyageCities.size, friendCities: friendCities.size, countries: countries.size };
  },
});

/** The pre-completed tea-ceremony voyage (fallback ending): its wish id, route and photo state. */
export const teaStory = internalQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({ wishId: v.id("wishes"), status: v.string(), route: v.array(v.string()), hasPhoto: v.boolean() }),
  ),
  handler: async (ctx) => {
    const louise = (await ctx.db.query("users").withIndex("by_teamKey", (q) => q.eq("teamKey", "louise")).take(5))[0];
    if (!louise) return null;
    const wishes = await ctx.db.query("wishes").withIndex("by_creatorId", (q) => q.eq("creatorId", louise._id)).take(BATCH);
    const w = wishes.find((x) => x.teamKey && x.text === TEA_WISH_TEXT);
    if (!w) return null;
    const hops = await ctx.db.query("hops").withIndex("by_wishId", (q) => q.eq("wishId", w._id)).take(BATCH);
    const route = [louise.city, ...hops.sort((a, b) => a.depth - b.depth).flatMap((h) => (h.city ? [h.city] : []))];
    return { wishId: w._id, status: w.status, route, hasPhoto: !!w.meetingPhoto };
  },
});

// ---------- meet-up gallery (scripts/seed-gallery.mjs) ----------

/** One upload URL per gallery photo. Files are POSTed straight to storage by the script. */
export const galleryUploadUrls = internalMutation({
  args: { count: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, { count }) => {
    if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("count must be 1..20");
    const urls: string[] = [];
    for (let i = 0; i < count; i++) urls.push(await ctx.storage.generateUploadUrl());
    return urls;
  },
});

/**
 * Give every seeded granted voyage a confirmed meet-up photo, as meetings.submitPhoto (by the
 * finder) + confirmPhoto (by the wisher) would leave it: `meetingPhoto` with the voyage's
 * thank-you line. Photos are dealt round-robin and join the stock pool (convex/gallery.ts), which
 * then fills every other blank success story. Re-running replaces earlier gallery photos (their
 * files stay in the pool); teamSeed.run keeps them across reseeds.
 */
export const attachGalleryPhotos = internalMutation({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.array(v.object({ wishId: v.id("wishes"), text: v.string(), storageId: v.id("_storage") })),
  handler: async (ctx, { storageIds }) => {
    if (storageIds.length === 0) throw new Error("Pass at least one storageId");
    await addToPool(ctx, storageIds);
    const granted: Doc<"wishes">[] = [];
    for (const u of await teamUsers(ctx)) {
      const own = await ctx.db
        .query("wishes")
        .withIndex("by_creatorId_and_status", (q) => q.eq("creatorId", u._id).eq("status", "granted"))
        .take(BATCH);
      granted.push(...own.filter((w) => w.teamKey && VOYAGES.some((vg) => vg.text === w.text)));
    }
    granted.sort((a, b) => a._creationTime - b._creationTime);
    const out = [];
    for (const [i, wish] of granted.entries()) {
      const storageId = storageIds[i % storageIds.length];
      const voyage = VOYAGES.find((vg) => vg.text === wish.text);
      await ctx.db.patch("wishes", wish._id, {
        meetingPhotoRevision: (wish.meetingPhotoRevision ?? 0) + 1,
        meetingPhoto: {
          storageId,
          uploaderRole: "match",
          metInPerson: wish.metInPerson ?? true,
          thankYou: clampText(voyage?.thankYou ?? "", THANK_YOU_MAX),
        },
      });
      out.push({ wishId: wish._id, text: wish.text, storageId });
    }
    await fillMissingPhotos(ctx);
    console.log(JSON.stringify({ event: "team_seed.gallery", photos: storageIds.length, wishes: out.length }));
    return out;
  },
});
