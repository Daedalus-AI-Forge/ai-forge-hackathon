import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
// Per-phone OTP send/verify limits (convex/phoneLimits.ts).
app.use(rateLimiter);

export default app;
