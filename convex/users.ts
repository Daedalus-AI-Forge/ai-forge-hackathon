import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { hasAccountLogin, mergeUserInto } from "./authUsers";
import { avatarFor, deviceUser, userByDevice } from "./lib";

/** Auth status for the client: is this user backed by a Google/Apple/phone account? */
export const account = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { signedIn: false as const };
    const user = await ctx.db.get("users", userId);
    if (!user) return { signedIn: false as const };
    return {
      signedIn: true as const,
      hasAccount: await hasAccountLogin(ctx, userId),
      email: user.email ?? null,
      phone: user.phone ?? null,
    };
  },
});

/**
 * Anonymous -> account upgrade. Called by the app right after any sign-in:
 * if this device's identity is a different (device/anonymous) user, its
 * wishes, hops, vouches, network, stars and wishes left move onto the
 * signed-in user and the old row is deleted. Never merges another real
 * Google/Apple/phone account.
 */
export const linkDevice = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first");
    const me = await ctx.db.get("users", userId);
    if (!me) throw new Error("Unknown user");
    const device = await deviceUser(ctx, deviceId);
    if (!device || device._id === me._id) return { merged: false };
    if (await hasAccountLogin(ctx, device._id)) return { merged: false };
    await mergeUserInto(ctx, device, me);
    return { merged: true };
  },
});

export const me = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    return await userByDevice(ctx, deviceId);
  },
});

export const ensure = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const existing = await userByDevice(ctx, deviceId);
    if (existing) return existing._id;
    return await ctx.db.insert("users", {
      name: "",
      avatar: avatarFor(deviceId),
      city: "",
      wishesLeft: 1,
      stars: 0,
      deviceId,
    });
  },
});

export const updateProfile = mutation({
  args: { deviceId: v.string(), name: v.string(), city: v.string() },
  handler: async (ctx, { deviceId, name, city }) => {
    const user = await userByDevice(ctx, deviceId);
    if (!user) throw new Error("Unknown device");
    await ctx.db.patch("users", user._id, {
      name: name.trim(),
      city: city.trim(),
      avatar: avatarFor(name.trim() || deviceId),
    });
    return null;
  },
});

export const claimDemo = mutation({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const demo = await ctx.db
      .query("users")
      .withIndex("by_demoKey", (q) => q.eq("demoKey", "me"))
      .unique();
    if (!demo) throw new Error("Seed the demo data first: npx convex run seed:run");
    const current = await userByDevice(ctx, deviceId);
    if (current && current._id !== demo._id) {
      await ctx.db.patch("users", current._id, { deviceId: undefined });
    }
    await ctx.db.patch("users", demo._id, { deviceId });
    return demo._id;
  },
});
