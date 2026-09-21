# Production image for the web app. Build context is the repo root.
# The dev image is Dockerfile.dev; this one ships Next's standalone output.

FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY .npmrc package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/web apps/web

# NEXT_PUBLIC_* is inlined into the browser bundle at build time, so the API
# origin is baked in here — not read from the environment at runtime.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build -w @reserivo/shared && npm run build -w web

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
# standalone carries its own traced node_modules; static and public are not
# included in it and have to come across separately.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
