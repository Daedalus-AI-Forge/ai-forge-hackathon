import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { avatarFor } from "./lib";

/** Providers that represent a real, recoverable account (vs device/anonymous). */
export const ACCOUNT_PROVIDERS = ["google", "apple", "phone"] as const;

const DEVICE_ID_MAX = 64;

export function cleanDeviceId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 && value.length <= DEVICE_ID_MAX
    ? value
    : undefined;
}

export function newUserFields(seed: string) {
  return { name: "", avatar: avatarFor(seed), city: "", wishesLeft: 1, stars: 0 };
}

/** True when the user row is attached to a Google, Apple or phone account. */
export async function hasAccountLogin(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  for (const provider of ACCOUNT_PROVIDERS) {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", provider))
      .first();
    if (account) return true;
  }
  return false;
}

type CreateOrUpdateArgs = {
  existingUserId: Id<"users"> | null;
  provider: { id: string };
  profile: Record<string, unknown>;
};

/**
 * Convex Auth `createOrUpdateUser` callback. We own user creation because the
 * users table carries required app fields (wishesLeft, stars, ...).
 *
 * - Anonymous sign-in passes `deviceId`; if this device already has an
 *   (unlinked) user row we adopt it, so a device-identity user keeps all
 *   their data the moment they get an auth session.
 * - Google/Apple/phone create a fresh row (or reuse the one tied to that
 *   account); the device's data is folded in afterwards by `users.linkDevice`.
 * - Phone sign-in passes `phone` (E.164, already verified) and sets
 *   `phone` + `phoneVerificationTime` on the row.
 */
export async function createOrUpdateUser(ctx: MutationCtx, args: CreateOrUpdateArgs) {
  const { profile } = args;
  const email = typeof profile.email === "string" ? profile.email : undefined;
  const name = typeof profile.name === "string" ? profile.name.trim() : "";
  const image = typeof profile.image === "string" ? profile.image : undefined;
  const phone =
    args.provider.id === "phone" && typeof profile.phone === "string" ? profile.phone : undefined;

  if (args.existingUserId) {
    const existing = await ctx.db.get("users", args.existingUserId);
    if (existing) {
      const patch: Partial<Doc<"users">> = {};
      if (email && !existing.email) patch.email = email;
      if (image && !existing.image) patch.image = image;
      if (phone && !existing.phone) {
        patch.phone = phone;
        patch.phoneVerificationTime = Date.now();
      }
      if (name && !existing.name) {
        patch.name = name;
        patch.avatar = avatarFor(name);
      }
      if (Object.keys(patch).length > 0) await ctx.db.patch("users", existing._id, patch);
      return existing._id;
    }
  }

  if (args.provider.id === "anonymous") {
    const deviceId = cleanDeviceId(profile.deviceId);
    if (deviceId) {
      const device = await ctx.db
        .query("users")
        .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
        .unique();
      if (device && !(await hasAccountLogin(ctx, device._id))) {
        if (!device.isAnonymous) await ctx.db.patch("users", device._id, { isAnonymous: true });
        return device._id;
      }
    }
    return await ctx.db.insert("users", {
      ...newUserFields(deviceId ?? crypto.randomUUID()),
      // Only claim the deviceId when no other row holds it (by_deviceId is unique).
      deviceId: deviceId && !(await deviceTaken(ctx, deviceId)) ? deviceId : undefined,
      isAnonymous: true,
    });
  }

  const verified = profile.emailVerified === true;
  return await ctx.db.insert("users", {
    ...newUserFields(name || email || phone || args.provider.id),
    name,
    email,
    image,
    ...(email && verified ? { emailVerificationTime: Date.now() } : {}),
    ...(phone ? { phone, phoneVerificationTime: Date.now() } : {}),
  });
}

async function deviceTaken(ctx: MutationCtx, deviceId: string) {
  const row = await ctx.db
    .query("users")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .first();
  return row !== null;
}

const BATCH = 500;

/**
 * Move everything owned by `from` onto `into`, then delete `from` and its
 * auth sessions/accounts. Used when a device/anonymous user signs in with
 * Google or Apple ("upgrade"), so wishes, hops, vouches, network, stars and
 * wishes left survive.
 */
export async function mergeUserInto(ctx: MutationCtx, from: Doc<"users">, into: Doc<"users">) {
  for (const w of await ctx.db
    .query("wishes")
    .withIndex("by_creatorId", (q) => q.eq("creatorId", from._id))
    .take(BATCH)) {
    await ctx.db.patch("wishes", w._id, { creatorId: into._id });
  }
  for (const h of await ctx.db
    .query("hops")
    .withIndex("by_holderUserId_and_action", (q) => q.eq("holderUserId", from._id))
    .take(BATCH)) {
    await ctx.db.patch("hops", h._id, { holderUserId: into._id });
  }
  for (const vch of await ctx.db
    .query("vouches")
    .withIndex("by_aboutUserId", (q) => q.eq("aboutUserId", from._id))
    .take(BATCH)) {
    await ctx.db.patch("vouches", vch._id, { aboutUserId: into._id });
  }
  for (const n of await ctx.db
    .query("network")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", from._id))
    .take(BATCH)) {
    await ctx.db.patch("network", n._id, { ownerId: into._id });
  }

  const name = into.name || from.name;
  await ctx.db.patch("users", into._id, {
    name,
    city: into.city || from.city,
    avatar: into.name ? into.avatar : from.name ? from.avatar : into.avatar,
    stars: into.stars + from.stars,
    wishesLeft: Math.max(into.wishesLeft, from.wishesLeft),
    demoKey: into.demoKey ?? from.demoKey,
  });

  await deleteUserAndAuthData(ctx, from._id);
}

export async function deleteUserAndAuthData(ctx: MutationCtx, userId: Id<"users">) {
  for (const session of await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .take(BATCH)) {
    for (const token of await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .take(BATCH)) {
      await ctx.db.delete("authRefreshTokens", token._id);
    }
    await ctx.db.delete("authSessions", session._id);
  }
  for (const account of await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .take(BATCH)) {
    for (const code of await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .take(BATCH)) {
      await ctx.db.delete("authVerificationCodes", code._id);
    }
    await ctx.db.delete("authAccounts", account._id);
  }
  await ctx.db.delete("users", userId);
}
