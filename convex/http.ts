import { httpRouter } from "convex/server";

import { auth } from "./auth";

const http = httpRouter();

// /api/auth/signin/*, /api/auth/callback/* (Google OAuth) and the JWKS /
// OpenID discovery routes Convex uses to verify our tokens.
auth.addHttpRoutes(http);

export default http;
