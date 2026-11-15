import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Dates are UTC (see dateKey in daily.ts), so the new day's wish is written just after midnight UTC.
crons.cron("daily wish", "5 0 * * *", internal.daily.generate, {});

export default crons;
