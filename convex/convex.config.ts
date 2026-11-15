import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import staticHosting from "@convex-dev/static-hosting/convex.config";
import { defineApp } from "convex/server";

const app = defineApp();
// Per-phone OTP send/verify limits (convex/phoneLimits.ts).
app.use(rateLimiter);
// Expo web build served from <deployment>.convex.site (scripts/deploy-web.sh).
// No httpPrefix: convex/http.ts keeps its root routes and registers the catch-all.
app.use(staticHosting);

export default app;
