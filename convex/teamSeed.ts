// Team demo data (docs/demo/team-chain.md): 4 real team members who sign in with their own
// phone numbers, each with 20 generated close friends plus the guaranteed demo chain
// Darren -> Louise -> Katie -> Dazi. Phone numbers are run-time arguments only.
//
//   npx convex run teamSeed:run '{"members":[{"key":"darren","name":"Darren","phone":"+1..."}, ...]}'
//
// Idempotent: every row it writes hangs off a wish tagged `teamKey`, and members carry
// `users.teamKey`; a re-run deletes exactly those rows before reinserting. It never touches
// other users or the `seed:run` demo data.
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx, type QueryCtx } from "./_generated/server";
import { deleteUserAndAuthData } from "./authUsers";
import { avatarFor, recordEdges } from "./lib";
import { personKey } from "./graphShared";

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

const MEMBER_CITY: Record<TeamKey, string> = {
  darren: "San Francisco",
  louise: "San Francisco",
  katie: "Oakland",
  dazi: "Berkeley",
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

export type Friend = { name: string; age: number; city: string; job: string; tags: string[]; reason: string };

/** The member's 20 close friends. Members on the chain never get music habits, so nobody outranks it. */
export function generateFriends(key: TeamKey, reserved: string[] = []): Friend[] {
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
    const city = pick(CITIES);
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

/** Remove every row this seed wrote. Members keep their user + auth rows (they may have signed in). */
async function clearSeedData(ctx: MutationCtx) {
  const users = await teamUsers(ctx);
  let wishes = 0;
  for (const u of users) {
    const own = await ctx.db.query("wishes").withIndex("by_creatorId", (q) => q.eq("creatorId", u._id)).take(BATCH);
    for (const w of own) {
      if (!w.teamKey) continue;
      await deleteWishTree(ctx, w);
      wishes++;
    }
  }
  return { users, wishes };
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

async function writePerson(
  ctx: MutationCtx,
  owner: { userId: Id<"users">; name: string },
  wishId: Id<"wishes">,
  person: { name: string; tags: string[]; reason: string },
) {
  const hopId = await ctx.db.insert("hops", {
    wishId,
    depth: 1,
    holderName: person.name,
    recipientTags: person.tags,
    viaGroup: false,
  });
  return (await recordEdges(ctx, { owner, personName: person.name, tags: person.tags, reason: person.reason, wishId, hopId }))
    .length;
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
  },
  returns: v.array(
    v.object({ key: v.string(), userId: v.id("users"), created: v.boolean(), edges: v.number(), deviceId: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, { members, bindDevices }) => {
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
      for (const f of generateFriends(me.key, resolved.map((r) => r.name))) {
        edges += await writePerson(ctx, owner, wishId, f);
      }
      const chain = CHAIN[me.key];
      for (const mate of mates) {
        const crafted = chain && chain.to === mate.key ? chain : TEAMMATE;
        edges += await writePerson(ctx, owner, wishId, { name: mate.name, tags: crafted.tags, reason: crafted.reason });
      }
      out.push({ key: me.key, userId: me.userId, created: me.created, edges, deviceId: bindDevices ? teamDeviceId(me.key) : null });
    }
    console.log(JSON.stringify({ event: "team_seed.run", members: out.length, replacedWishes: previous.wishes }));
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
