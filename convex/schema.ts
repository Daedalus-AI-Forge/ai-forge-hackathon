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
    deviceId: v.optional(v.string()),
    demoKey: v.optional(v.string()),
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
    // Index names required by Convex Auth (`phone` also serves phone sign-in).
    .index("email", ["email"])
    .index("phone", ["phone"]),

  wishes: defineTable({
    creatorId: v.id("users"),
    type: wishType,
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
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_status", ["status"]),

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
    action: v.optional(hopAction),
    actedAt: v.optional(v.number()),
  })
    .index("by_wishId", ["wishId"])
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
});
