import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { deleteUserAndAuthData } from "./authUsers";

/**
 * Ops/test helper: delete a user row plus its auth sessions, refresh tokens
 * and accounts. Internal only (`npx convex run authAdmin:deleteUser`).
 * Does not touch wishes/hops the user created.
 */
export const deleteUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    if (!(await ctx.db.get("users", userId))) return null;
    await deleteUserAndAuthData(ctx, userId);
    return null;
  },
});
