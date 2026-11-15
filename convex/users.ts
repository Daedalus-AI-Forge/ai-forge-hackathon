import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { avatarFor, userByDevice } from "./lib";

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
