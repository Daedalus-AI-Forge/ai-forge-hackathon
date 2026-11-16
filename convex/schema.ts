import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const wishType = v.union(
  v.literal("do_together"),
  v.literal("local"),
  v.literal("been_there"),
  v.literal("same_boat"),
);

export const hopAction = v.union(v.literal("pass"), v.literal("group"), v.literal("its_me"));

export default defineSchema({
  // Convex Auth tables (authSessions, authAccounts, authRefreshTokens, ...).
  ...authTables,

  // One row per person. Doubles as the Convex Auth `users` table: the app
  // fields come first, then the optional profile fields Convex Auth writes.
  // Rows are created by `users.ensure` (device identity) or by the auth
  // `createOrUpdateUser` callback in convex/authUsers.ts.
  users: defineTable({
    name: v.string(),
    avatar: v.string(),
    city: v.string(),
    wishesLeft: v.number(),
    stars: v.number(),
    // Boats pushed toward the next coin (convex/pool.ts BOATS_PER_COIN).
    boatProgress: v.optional(v.number()),
    // Missing = true: finders may show my name and city in their voyage log.
    showInLogs: v.optional(v.boolean()),
    deviceId: v.optional(v.string()),
    demoKey: v.optional(v.string()),
    // Team demo member ("darren" | "louise" | "katie" | "dazi"), set by teamSeed.run.
    teamKey: v.optional(v.string()),
    // Convex Auth profile fields (see authTables.users).
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    // E.164, set by phone sign-in (convex/phoneProvider.ts).
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  })
    .index("by_deviceId", ["deviceId"])
    .index("by_demoKey", ["demoKey"])
    .index("by_teamKey", ["teamKey"])
    // Index names required by Convex Auth (`phone` also serves phone sign-in).
    .index("email", ["email"])
    .index("phone", ["phone"]),

  wishes: defineTable({
    creatorId: v.id("users"),
    // Set on the hidden graph-holder wish written by teamSeed.run (re-runs replace it).
    teamKey: v.optional(v.string()),
    type: wishType,
    // "serious" (default when missing): each pass needs a reason. "fun": reason optional.
    mode: v.optional(v.union(v.literal("serious"), v.literal("fun"))),
    text: v.string(),
    status: v.union(
      v.literal("traveling"),
      v.literal("found"),
      v.literal("granted"),
      v.literal("faded"),
    ),
    expiresAt: v.number(),
    meetDeadline: v.optional(v.number()),
    winningHopId: v.optional(v.id("hops")),
    photoUrl: v.optional(v.string()),
    metInPerson: v.optional(v.boolean()),
    tier: v.optional(
      v.union(v.literal("gold"), v.literal("silver"), v.literal("bronze"), v.literal("red")),
    ),
    // Set by rewards.grantRewards once a granted wish's wishes and stars are handed out.
    rewardsAppliedAt: v.optional(v.number()),
    // Set on the platform's daily wish (convex/daily.ts). One step per pass:
    // `tag` is the kind of friend the well learns about on that pass, `hint` the clue.
    daily: v.optional(
      v.object({
        date: v.string(),
        steps: v.array(v.object({ tag: v.string(), learns: v.string(), hint: v.string() })),
        reasoning: v.string(),
      }),
    ),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_status", ["status"])
    .index("by_daily_date", ["daily.date"]),

  hops: defineTable({
    wishId: v.id("wishes"),
    parentHopId: v.optional(v.id("hops")),
    depth: v.number(),
    holderName: v.string(),
    holderUserId: v.optional(v.id("users")),
    holderContact: v.optional(v.string()),
    city: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
    recipientTags: v.array(v.string()),
    viaGroup: v.boolean(),
    vouchForParent: v.optional(v.string()),
    passMessage: v.optional(v.string()),
    itsMeIntro: v.optional(v.string()),
    // Missing = shown: whether voyage logs may show this finder's name and city.
    itsMePublic: v.optional(v.boolean()),
    action: v.optional(hopAction),
    actedAt: v.optional(v.number()),
    // Link page (docs/superpowers/plans/2026-11-15-link-page.md)
    introVouch: v.optional(v.string()), // the pusher's vouch about this hop's holder
    relation: v.optional(v.string()),
    proofStorageId: v.optional(v.id("_storage")),
    claimAnswers: v.optional(v.array(v.string())),
    claimPhone: v.optional(v.string()),
    claimVerified: v.optional(v.boolean()),
  })
    .index("by_wishId", ["wishId"])
    .index("by_wishId_and_holderUserId", ["wishId", "holderUserId"])
    .index("by_parentHopId", ["parentHopId"])
    .index("by_holderUserId_and_action", ["holderUserId", "action"]),

  vouches: defineTable({
    aboutName: v.string(),
    aboutContact: v.optional(v.string()),
    aboutUserId: v.optional(v.id("users")),
    byName: v.string(),
    text: v.string(),
    tags: v.array(v.string()),
    wishId: v.id("wishes"),
    hopId: v.id("hops"),
  })
    .index("by_wishId", ["wishId"])
    .index("by_aboutUserId", ["aboutUserId"]),

  network: defineTable({
    ownerId: v.id("users"),
    personName: v.string(),
    personContact: v.optional(v.string()),
    channel: v.optional(v.string()),
    tags: v.array(v.string()),
  }).index("by_ownerId", ["ownerId"]),

  // The network map: one row per (owner, person, tag). Written when someone
  // passes a wish on. `daily` = learned from the daily wish's tag, `pick` =
  // a tag the owner chose themselves. Owners see and delete theirs in Me.
  edges: defineTable({
    ownerUserId: v.optional(v.id("users")),
    ownerName: v.string(),
    personName: v.string(),
    tag: v.string(),
    source: v.union(v.literal("daily"), v.literal("pick")),
    wishId: v.id("wishes"),
    hopId: v.id("hops"),
    // Graph + coach (docs/api/wishwell-graph-api.md): why the owner picked this person.
    reason: v.optional(v.string()),
    contact: v.optional(v.string()),
  })
    .index("by_ownerUserId", ["ownerUserId"])
    .index("by_ownerUserId_and_personName", ["ownerUserId", "personName"])
    .index("by_tag", ["tag"]),
  linkVisitors: defineTable({
    contactKey: v.string(), // E.164 phone or lowercase email
    contactKind: v.union(v.literal("phone"), v.literal("email")),
    userId: v.id("users"),
    freeWishId: v.optional(v.id("wishes")),
    draftText: v.optional(v.string()),
    draftAt: v.optional(v.number()),
    remindedAt: v.optional(v.number()),
  })
    .index("by_contactKey", ["contactKey"])
    .index("by_userId", ["userId"]),

  linkEvents: defineTable({
    hopId: v.optional(v.id("hops")),
    userId: v.optional(v.id("users")),
    event: v.union(
      v.literal("open"),
      v.literal("wish_written"),
      v.literal("skip_wish"),
      v.literal("claim"),
      v.literal("push"),
      v.literal("contact"),
      v.literal("download_click"),
    ),
    wroteWish: v.optional(v.boolean()),
    at: v.number(),
  }).index("by_event", ["event"]),
});
