import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { ogHtml, ogNotFoundHtml } from "./linkMetrics";

const http = httpRouter();

// /api/auth/signin/*, /api/auth/callback/* (Google OAuth) and the JWKS /
// OpenID discovery routes Convex uses to verify our tokens.
auth.addHttpRoutes(http);

// Share preview for a link-page hop: OG/Twitter tags, then redirect to the web app.
http.route({
  pathPrefix: "/og/w/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const hopId = new URL(req.url).pathname.slice("/og/w/".length).replace(/\/+$/, ""); // ids are URL-safe
    const hop = hopId ? await ctx.runQuery(internal.linkMetrics.ogHop, { hopId }) : null;
    const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" };
    if (!hop) return new Response(ogNotFoundHtml(), { status: 404, headers });
    return new Response(ogHtml(hop, process.env.APP_WEB_URL), { status: 200, headers });
  }),
});

export default http;
