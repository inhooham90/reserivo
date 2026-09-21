#!/usr/bin/env bash
#
# Build both images and release them to Heroku. Safe to re-run; this is the
# normal way to ship a change.
#
#   API_ORIGIN=https://reserivo-api-e04c6a11001e.herokuapp.com ./deploy/heroku-deploy.sh
#
# Run it from the repo root. See deploy/HEROKU.md for first-time setup.
# The PowerShell equivalent is deploy/heroku-deploy.ps1.
set -euo pipefail

API_APP="${API_APP:-reserivo-api}"
WEB_APP="${WEB_APP:-reserivo-web}"
# Baked into the browser bundle at build time, so the web image is tied to one
# API origin and changing it means rebuilding, not just setting a config var.
API_ORIGIN="${API_ORIGIN:?set API_ORIGIN to the public API origin}"

# Heroku's registry is fussy about how the image is built, in three ways, and
# gives one unhelpful error for all of them ("error from registry: unsupported"):
#
#   oci-mediatypes=false  Docker Desktop's containerd image store writes OCI
#                         manifests. Heroku only accepts Docker Schema 2. This is
#                         the one that actually bites; the push uploads every
#                         layer and then fails on the manifest.
#   provenance/sbom=false buildx otherwise attaches attestations, which turn the
#                         push into a manifest list.
#   platform              Heroku runs linux/amd64 only.
#
# Building straight to the registry with push=true keeps the media type intact;
# a separate `docker push` would re-export it from the local store.
BUILD_FLAGS=(--platform linux/amd64 --provenance=false --sbom=false)
push_image() {
  local tag="$1" dockerfile="$2"
  shift 2
  docker buildx build "${BUILD_FLAGS[@]}" "$@" -f "$dockerfile" \
    --output "type=image,name=$tag,oci-mediatypes=false,push=true" .
}

if ! heroku auth:whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: heroku login" >&2
  exit 1
fi
heroku container:login

echo "==> API  -> $API_APP"
push_image "registry.heroku.com/$API_APP/web" apps/api/Dockerfile
# The dyno runs `prisma migrate deploy` before the server, so releasing the API
# first means the schema is ready by the time the new web build talks to it.
heroku container:release web -a "$API_APP"

echo "==> WEB  -> $WEB_APP  (API_URL=$API_ORIGIN)"
push_image "registry.heroku.com/$WEB_APP/web" apps/web/Dockerfile \
  --build-arg "NEXT_PUBLIC_API_URL=$API_ORIGIN"
heroku container:release web -a "$WEB_APP"

echo
echo "Released. Watch it come up with:"
echo "  heroku logs --tail -a $API_APP"
