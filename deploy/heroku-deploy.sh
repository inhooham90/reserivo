#!/usr/bin/env bash
#
# Build both images and release them to Heroku. Safe to re-run; this is the
# normal way to ship a change.
#
#   API_ORIGIN=https://api.reserivo.com ./deploy/heroku-deploy.sh
#
# Run it from the repo root. See deploy/HEROKU.md for first-time setup.
set -euo pipefail

API_APP="${API_APP:-reserivo-api}"
WEB_APP="${WEB_APP:-reserivo-web}"
# Baked into the browser bundle at build time, so the web image is tied to one
# API origin and changing it means rebuilding, not just setting a config var.
API_ORIGIN="${API_ORIGIN:?set API_ORIGIN to the public API origin, e.g. https://api.reserivo.com}"

# Heroku's registry rejects the multi-platform manifest lists and attestations
# that buildx attaches by default, and only runs linux/amd64.
BUILD_FLAGS=(--platform linux/amd64 --provenance=false --sbom=false)

if ! heroku auth:whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: heroku login" >&2
  exit 1
fi
heroku container:login

echo "==> API  -> $API_APP"
docker build "${BUILD_FLAGS[@]}" -f apps/api/Dockerfile -t "registry.heroku.com/$API_APP/web" .
docker push "registry.heroku.com/$API_APP/web"
# The dyno runs `prisma migrate deploy` before the server, so releasing the API
# first means the schema is ready by the time the new web build talks to it.
heroku container:release web -a "$API_APP"

echo "==> WEB  -> $WEB_APP  (API_URL=$API_ORIGIN)"
docker build "${BUILD_FLAGS[@]}" -f apps/web/Dockerfile \
  --build-arg "NEXT_PUBLIC_API_URL=$API_ORIGIN" \
  -t "registry.heroku.com/$WEB_APP/web" .
docker push "registry.heroku.com/$WEB_APP/web"
heroku container:release web -a "$WEB_APP"

echo
echo "Released. Watch it come up with:"
echo "  heroku logs --tail -a $API_APP"
