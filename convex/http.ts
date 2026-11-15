import { registerStaticRoutes } from "@convex-dev/static-hosting";
import { httpRouter } from "convex/server";

import { components } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();

// /api/auth/signin/*, /api/auth/callback/* (Google OAuth) and the JWKS /
// OpenID discovery routes Convex uses to verify our tokens.
auth.addHttpRoutes(http);

// Keep last: static web app catch-all (SPA fallback to index.html). Exact
// routes registered above win over it.
registerStaticRoutes(http, components.staticHosting);

export default http;
