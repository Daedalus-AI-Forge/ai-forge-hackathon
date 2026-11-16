import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Dates are UTC (see dateKey in daily.ts), so the new day's wish is written just after midnight UTC.
crons.cron("daily wish", "5 0 * * *", internal.daily.generate, {});

// Wish bots (convex/bots.ts): no-op unless the Convex env var BOTS_ENABLED is "true".
crons.interval("wish bots", { minutes: 2 }, internal.bots.tick, {});

export default crons;
