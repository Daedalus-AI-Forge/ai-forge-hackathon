// Convex Auth issues its own JWTs; Convex validates them against this
// deployment's site URL. Without this file every request is signed out.
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
