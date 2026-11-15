import type { Id, TableNames } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { avatarFor } from "./lib";

const HOUR = 60 * 60 * 1000;

const PEOPLE = [
  ["louise", "Louise", "San Francisco", 37.7749, -122.4194],
  ["me", "Mia", "San Francisco", 37.7599, -122.4148],
  ["ben", "Ben", "San Francisco", 37.7694, -122.4862],
  ["priya", "Priya", "San Francisco", 37.7858, -122.4064],
  ["amy", "Amy", "Shanghai", 31.2304, 121.4737],
  ["wei", "Wei", "Shanghai", 31.2243, 121.4768],
  ["lin", "Lin", "Shanghai", 31.2397, 121.4998],
  ["oliver", "Oliver", "London", 51.5074, -0.1278],
  ["hannah", "Hannah", "London", 51.5155, -0.0922],
  ["raj", "Raj", "London", 51.5033, -0.1196],
  ["sam", "Sam", "New York", 40.7128, -74.006],
  ["jasmine", "Jasmine", "New York", 40.7306, -73.9352],
  ["marcus", "Marcus", "New York", 40.6782, -73.9442],
  ["kenji", "Kenji", "Tokyo", 35.6762, 139.6503],
  ["yui", "Yui", "Tokyo", 35.6895, 139.6917],
] as const;

type Key = (typeof PEOPLE)[number][0];

async function clear(ctx: MutationCtx, table: TableNames) {
  for await (const doc of ctx.db.query(table)) await ctx.db.delete(table, doc._id);
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    for (const table of [
      "authRefreshTokens",
      "authVerificationCodes",
      "authVerifiers",
      "authSessions",
      "authAccounts",
      "edges",
      "network",
      "vouches",
      "hops",
      "wishes",
      "users",
    ] as const) {
      await clear(ctx, table);
    }
    const now = Date.now();
    const users = {} as Record<Key, { id: Id<"users">; name: string; city: string; lat: number; lng: number }>;
    for (const [key, name, city, lat, lng] of PEOPLE) {
      const id = await ctx.db.insert("users", {
        name,
        city,
        avatar: avatarFor(name),
        wishesLeft: 1,
        stars: key === "amy" || key === "ben" ? 2 : 0,
        demoKey: key,
      });
      users[key] = { id, name, city, lat, lng };
    }

    const hop = async (
      wishId: Id<"wishes">,
      key: Key,
      opts: {
        parent?: Id<"hops">;
        depth: number;
        action?: "pass" | "group" | "its_me";
        vouch?: string;
        aboutKey?: Key;
        tags?: string[];
        message?: string;
        intro?: string;
        linkUser?: boolean;
        hoursAgo?: number;
      },
    ) => {
      const u = users[key];
      const acted = opts.action !== undefined;
      const hopId = await ctx.db.insert("hops", {
        wishId,
        parentHopId: opts.parent,
        depth: opts.depth,
        holderName: u.name,
        holderUserId: opts.linkUser === false ? undefined : u.id,
        city: acted ? u.city : undefined,
        lat: acted ? u.lat : undefined,
        lng: acted ? u.lng : undefined,
        recipientTags: opts.tags ?? [],
        viaGroup: false,
        vouchForParent: opts.vouch,
        passMessage: opts.message,
        itsMeIntro: opts.intro,
        action: opts.action,
        actedAt: acted ? now - (opts.hoursAgo ?? 1) * HOUR : undefined,
      });
      if (opts.vouch && opts.aboutKey) {
        const about = users[opts.aboutKey];
        await ctx.db.insert("vouches", {
          aboutName: about.name,
          aboutUserId: about.id,
          byName: u.name,
          text: opts.vouch,
          tags: opts.tags ?? [],
          wishId,
          hopId,
        });
      }
      return hopId;
    };

    // 1. Granted Silver "Boomerang": SF -> Shanghai -> SF.
    const drums = await ctx.db.insert("wishes", {
      creatorId: users.louise.id,
      type: "do_together",
      text: "Someone to jam on drums with. I bought a drum kit but I'm too shy to play alone.",
      status: "granted",
      expiresAt: now - 24 * HOUR,
      meetDeadline: now + 5 * 24 * HOUR,
      photoUrl: "https://picsum.photos/seed/wishwell-drums/800/800",
      metInPerson: true,
      tier: "silver",
    });
    const amyHop = await hop(drums, "amy", {
      depth: 1,
      action: "pass",
      aboutKey: "louise",
      vouch: "Louise is my co-founder, the most fun person I know.",
      tags: ["fun", "music"],
      message: "A wish just landed with you: Louise wants someone to jam on drums with. Know anyone?",
      hoursAgo: 70,
    });
    const benHop = await hop(drums, "ben", {
      parent: amyHop,
      depth: 2,
      action: "its_me",
      aboutKey: "amy",
      vouch: "Amy is my college roommate, known her 10 years, super reliable.",
      tags: ["reliable", "drums"],
      intro: "I've drummed in a garage band for 8 years and live 10 minutes from Louise!",
      message: "Ben! Louise in SF wants a drum buddy. 2 ripples in, 40h left. Is it you?",
      hoursAgo: 66,
    });
    const oliverHop = await hop(drums, "oliver", {
      depth: 1,
      action: "pass",
      aboutKey: "louise",
      vouch: "Louise is my old flatmate, known her 6 years, so kind.",
      tags: ["kind"],
      hoursAgo: 69,
    });
    await hop(drums, "hannah", { parent: oliverHop, depth: 2, tags: ["music"] });
    await ctx.db.patch("wishes", drums, { winningHopId: benHop });

    // 2. Traveling Tokyo izakaya wish: 3 branches, 2 ripples, 20h left, 4 holding it.
    const tokyo = await ctx.db.insert("wishes", {
      creatorId: users.me.id,
      type: "local",
      text: "A local in Tokyo to show me izakayas. I'm visiting next month and want the tiny places with no English menu.",
      status: "traveling",
      expiresAt: now + 20 * HOUR,
    });
    const samHop = await hop(tokyo, "sam", {
      depth: 1,
      action: "pass",
      aboutKey: "me",
      vouch: "Mia is my college friend, known her 8 years, endlessly adventurous.",
      tags: ["adventurous", "food"],
      hoursAgo: 26,
    });
    await hop(tokyo, "kenji", { parent: samHop, depth: 2, tags: ["Tokyo", "food"] });
    await hop(tokyo, "jasmine", { parent: samHop, depth: 2, tags: ["Japan", "travel"] });
    const weiHop = await hop(tokyo, "wei", {
      depth: 1,
      action: "pass",
      aboutKey: "me",
      vouch: "Mia is my coworker, known her 3 years, really kind.",
      tags: ["kind"],
      hoursAgo: 20,
    });
    await hop(tokyo, "yui", { parent: weiHop, depth: 2, tags: ["Tokyo", "nightlife"] });
    const priyaHop = await hop(tokyo, "priya", { depth: 1, tags: ["travel"] });
    for (const [hopId, personName, tags] of [
      [samHop, "Sam", ["adventurous", "food"]],
      [weiHop, "Wei", ["kind"]],
      [priyaHop, "Priya", ["travel"]],
    ] as const) {
      for (const tag of tags) {
        await ctx.db.insert("edges", {
          ownerUserId: users.me.id,
          ownerName: users.me.name,
          personName,
          tag,
          source: "pick",
          wishId: tokyo,
          hopId,
        });
      }
    }

    // 3. Two branches racing, 1 hour left.
    const antarctica = await ctx.db.insert("wishes", {
      creatorId: users.oliver.id,
      type: "been_there",
      text: "Someone who has been to Antarctica. I'm planning my first trip and want to hear what it's really like.",
      status: "traveling",
      expiresAt: now + 1 * HOUR,
    });
    const hannahHop = await hop(antarctica, "hannah", {
      depth: 1,
      action: "pass",
      aboutKey: "oliver",
      vouch: "Oliver is my brother, known him forever, the most reliable person alive.",
      tags: ["reliable"],
      hoursAgo: 40,
    });
    await hop(antarctica, "me", {
      parent: hannahHop,
      depth: 2,
      tags: ["travel", "adventurous"],
      message: "A wish just landed with you, Mia: Oliver wants someone who has been to Antarctica. 2 ripples in, 1h left!",
    });
    const rajHop = await hop(antarctica, "raj", {
      depth: 1,
      action: "pass",
      aboutKey: "oliver",
      vouch: "Oliver is my teammate, known him 4 years, super fun.",
      tags: ["fun"],
      hoursAgo: 38,
    });
    const marcusHop = await hop(antarctica, "marcus", {
      parent: rajHop,
      depth: 2,
      action: "pass",
      aboutKey: "raj",
      vouch: "Raj is my climbing partner, known him 5 years, fearless.",
      tags: ["climbing", "adventurous"],
      hoursAgo: 12,
    });
    await hop(antarctica, "lin", { parent: marcusHop, depth: 3, tags: ["polar", "photography"] });

    for (const [name, tags] of [
      ["Sam", ["food", "adventurous"]],
      ["Wei", ["kind", "Shanghai"]],
      ["Priya", ["travel"]],
      ["Ben", ["drums", "music"]],
    ] as const) {
      await ctx.db.insert("network", {
        ownerId: users.me.id,
        personName: name,
        tags: [...tags],
        channel: "sms",
      });
    }

    return { users: PEOPLE.length, wishes: 3 };
  },
});
