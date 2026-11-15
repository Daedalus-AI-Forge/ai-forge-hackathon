import type { Id, TableNames } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { avatarFor } from "./lib";

const HOUR = 60 * 60 * 1000;

/** Fixed device id of the seeded "fresh" demo user (demoKey "fresh"); see docs/api/graph-coach.md. */
export const FRESH_DEVICE_ID = "dev_demo_fresh";

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
      mode: "serious",
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
      mode: "serious",
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
    // 3. Two branches racing, 1 hour left.
    const antarctica = await ctx.db.insert("wishes", {
      creatorId: users.oliver.id,
      type: "been_there",
      mode: "serious",
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

    // 4. Mia's ego graph (docs/api/graph-coach.md): 12 people, 23 edges, oldest first so
    // `_creationTime` follows insertion order. Two older wishes of hers, yesterday's daily
    // wish (fun, "daily" edges), then the Tokyo wish above.
    const climbing = await ctx.db.insert("wishes", {
      creatorId: users.me.id,
      type: "do_together",
      mode: "serious",
      text: "A climbing partner for Saturday mornings at Mission Cliffs.",
      status: "faded",
      expiresAt: now - 20 * 24 * HOUR,
    });
    const studio = await ctx.db.insert("wishes", {
      creatorId: users.me.id,
      type: "same_boat",
      mode: "serious",
      text: "Someone who has started a small design studio, to grab coffee and ask how they did it.",
      status: "faded",
      expiresAt: now - 9 * 24 * HOUR,
    });
    const well = await ctx.db.insert("users", {
      name: "The well",
      avatar: "#E63946",
      city: "",
      wishesLeft: 0,
      stars: 0,
      demoKey: "well",
    });
    const dailyWish = await ctx.db.insert("wishes", {
      creatorId: well,
      type: "same_boat",
      mode: "fun",
      text: "Someone who cried at a concert this year and will admit it.",
      status: "faded",
      expiresAt: now - 2 * HOUR,
      daily: {
        date: new Date(now - 26 * HOUR).toISOString().slice(0, 10),
        steps: [{ tag: "music", learns: "who your way into the music scene is", hint: "Who always has a spare ticket?" }],
        reasoning: "Seeded daily wish (yesterday).",
      },
    });
    const miaDailyHop = await hop(dailyWish, "me", { depth: 1, action: "pass", hoursAgo: 30 });

    const MIA_GRAPH: [Id<"wishes">, Id<"hops"> | undefined, Key, [string, string, "pick" | "daily"][]][] = [
      [climbing, undefined, "raj", [["climbing", "Raj leads 5.12 and is weirdly patient with beginners", "pick"]]],
      [climbing, undefined, "jasmine", [
        ["climbing", "Jasmine started bouldering last spring and is looking for a regular buddy", "pick"],
        ["photography", "Jasmine shoots film on every climbing trip", "pick"],
      ]],
      [climbing, undefined, "hannah", [
        ["antarctica", "Hannah spent a season at a research station in Antarctica", "pick"],
        ["climbing", "Hannah ice-climbs every winter and never gets cold feet", "pick"],
      ]],
      [studio, undefined, "amy", [
        ["design", "Amy ran the design team at her last startup", "pick"],
        ["startups", "Amy co-founded two companies and loves giving founders advice", "pick"],
      ]],
      [studio, undefined, "kenji", [
        ["coffee", "Kenji roasts his own beans and runs a coffee cart in Nakameguro", "pick"],
        ["tokyo", "Kenji has lived in Tokyo his whole life and knows every back street", "pick"],
      ]],
      [studio, undefined, "lin", [
        ["photography", "Lin photographs product launches for studios in Shanghai", "pick"],
        ["design", "Lin art-directed a rebrand I still think about", "pick"],
      ]],
      [dailyWish, miaDailyHop, "ben", [
        ["music", "Ben always has a spare ticket and an opinion about the opener", "daily"],
        ["drums", "Ben has drummed in a garage band for eight years", "pick"],
      ]],
      [dailyWish, miaDailyHop, "louise", [
        ["music", "Louise just bought a drum kit and wants people to jam with", "daily"],
        ["drums", "Louise practices drums every night but is shy about playing with others", "pick"],
      ]],
      [dailyWish, miaDailyHop, "yui", [
        ["music", "Yui DJs at a tiny bar in Shimokitazawa on Fridays", "daily"],
        ["tokyo", "Yui knows the late-night spots in Tokyo that never show up on maps", "pick"],
      ]],
      [tokyo, undefined, "sam", [
        ["food", "Sam keeps a spreadsheet of every ramen shop he has ever tried", "pick"],
        ["tokyo", "Sam lived in Tokyo for two years and still has friends there", "pick"],
      ]],
      [tokyo, undefined, "wei", [
        ["shanghai", "Wei grew up in Shanghai and knows the night markets by heart", "pick"],
        ["food", "Wei will cross the city for the right soup dumplings", "pick"],
      ]],
      [tokyo, undefined, "priya", [
        ["startups", "Priya is a founder in SF who plans every trip like a product launch", "pick"],
        ["sf", "Priya knows every coffee shop in the Mission worth working from", "pick"],
      ]],
    ];
    // Tokyo recipients already have their depth-1 hops above.
    const existing: Partial<Record<Key, Id<"hops">>> = { sam: samHop, wei: weiHop, priya: priyaHop };
    let miaEdges = 0;
    for (const [wishId, parent, key, links] of MIA_GRAPH) {
      // Picks on Mia's own wishes are depth-1 hops; on the daily wish they are her pass-ons.
      const hopId =
        existing[key] ?? (await hop(wishId, key, { parent, depth: parent ? 2 : 1, tags: links.map((l) => l[0]) }));
      for (const [tag, reason, source] of links) {
        await ctx.db.insert("edges", {
          ownerUserId: users.me.id,
          ownerName: users.me.name,
          personName: users[key].name,
          tag,
          source,
          reason,
          wishId,
          hopId,
        });
        miaEdges += 1;
      }
    }

    // 5. A second demo user with too few edges for the coach (below COACH_THRESHOLD).
    // Not claimable via users.claimDemo; log in by using the fixed device id below.
    const fresh = await ctx.db.insert("users", {
      name: "Theo",
      city: "San Francisco",
      avatar: avatarFor("Theo"),
      wishesLeft: 1,
      stars: 0,
      demoKey: "fresh",
      deviceId: FRESH_DEVICE_ID,
    });
    const freshWish = await ctx.db.insert("wishes", {
      creatorId: fresh,
      type: "local",
      mode: "serious",
      text: "Someone who knows a quiet cafe in SF to read in on Sundays.",
      status: "traveling",
      expiresAt: now + 30 * HOUR,
    });
    for (const [personName, tag, reason] of [
      ["Nora", "coffee", "Nora worked as a barista in three SF cafes"],
      ["Diego", "sf", "Diego has lived in the Sunset for ten years"],
    ] as const) {
      const hopId = await ctx.db.insert("hops", {
        wishId: freshWish,
        depth: 1,
        holderName: personName,
        recipientTags: [tag],
        viaGroup: false,
      });
      await ctx.db.insert("edges", {
        ownerUserId: fresh,
        ownerName: "Theo",
        personName,
        tag,
        source: "pick",
        reason,
        wishId: freshWish,
        hopId,
      });
    }

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

    return { users: PEOPLE.length + 2, wishes: 6, miaEdges, freshEdges: 2 };
  },
});
