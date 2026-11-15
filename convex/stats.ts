import { query } from "./_generated/server";

/** Live counts for the "why this works" card on the pass-on page. Nothing here is hard-coded. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const hops = await ctx.db.query("hops").take(2000);
    const granted = await ctx.db
      .query("wishes")
      .withIndex("by_status", (q) => q.eq("status", "granted"))
      .take(500);
    const people = new Set(hops.filter((h) => !h.viaGroup).map((h) => h.holderName.trim().toLowerCase()));
    const depths = [];
    for (const wish of granted) {
      const winner = wish.winningHopId ? await ctx.db.get("hops", wish.winningHopId) : null;
      if (winner) depths.push(winner.depth);
    }
    return {
      people: people.size,
      passes: hops.length,
      vouches: hops.filter((h) => h.vouchForParent).length,
      granted: granted.length,
      avgRipples: depths.length ? Math.round((depths.reduce((a, b) => a + b, 0) / depths.length) * 10) / 10 : null,
    };
  },
});
