# Link page web hosting

The Expo **web** build is served by Convex static hosting
(`@convex-dev/static-hosting`) on the dev deployment:

- Origin: https://gallant-seal-635.convex.site
- Link page: `https://gallant-seal-635.convex.site/l/<hopId>`
- Convex env `APP_WEB_URL` (dev) = `https://gallant-seal-635.convex.site`

## Redeploy

```bash
scripts/deploy-web.sh
```

It pushes Convex functions to dev, runs `expo export --platform web`, uploads
`dist/` (atomic publish; the previous build stays live if an upload fails),
sets `APP_WEB_URL`, and curls `/` and `/l/test` for a 200.

## How routing works

- `convex/convex.config.ts` mounts the component with no `httpPrefix`.
- `convex/http.ts` registers exact routes first (auth, `/og/w/`), then
  `registerStaticRoutes(...)` as the catch-all. Exact routes win.
- Paths without an extension fall back to `index.html` (SPA, `web.output: "single"`);
  missing assets such as `/missing.js` return 404.
- Convex HTTP routes support GET, not HEAD. Use GET for uptime checks.

## Rollback

Re-run `scripts/deploy-web.sh` from the previous good commit. To remove hosting,
delete the `registerStaticRoutes` line and the `app.use(staticHosting)` line, then
run `npx convex dev --once`.

## Caveat

`gallant-seal-635` is a shared dev deployment: whichever branch last runs
`npx convex dev` defines its functions. A branch that pushes Convex code without
the static hosting wiring takes the web app offline until it is redeployed.
