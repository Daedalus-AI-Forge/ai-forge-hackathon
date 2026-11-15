#!/usr/bin/env bash
# Re-export the Expo web build and publish it to Convex static hosting on the
# dev deployment (gallant-seal-635). Usage: scripts/deploy-web.sh
# Requires this checkout to be linked to the dev deployment
# (npx convex dev --once --configure existing ...). Never touches prod.
set -euo pipefail
cd "$(dirname "$0")/.."

DEPLOYMENT="${DEPLOYMENT:-gallant-seal-635}"
ORIGIN="https://${DEPLOYMENT}.convex.site"

# 1. Push backend (http.ts catch-all + staticHosting component) to dev.
npx convex dev --once

# 2. Static SPA export (app.json web.output = "single").
rm -rf dist
EXPO_PUBLIC_CONVEX_URL="https://${DEPLOYMENT}.convex.cloud" \
EXPO_PUBLIC_CONVEX_SITE_URL="$ORIGIN" \
  npx expo export --platform web

# 3. Upload to the dev deployment (atomic publish, SPA fallback to index.html).
npx @convex-dev/static-hosting upload --dist ./dist

# 4. Keep share links pointing at this origin.
npx convex env set APP_WEB_URL "$ORIGIN"

# 5. Smoke check: root and a deep link must both serve the app shell.
for path in / /l/test; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$ORIGIN$path")
  [ "$code" = 200 ] || { echo "FAIL $ORIGIN$path -> $code" >&2; exit 1; }
  echo "OK $ORIGIN$path -> $code"
done
