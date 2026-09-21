# Production image for the API. Build context is the repo root.
# The dev image is Dockerfile.dev; this one compiles and drops the toolchain.

FROM node:24-bookworm-slim AS build
WORKDIR /app
# Manifests first so the dependency layer is cached until they change.
COPY .npmrc package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/api apps/api
# prisma.config.ts resolves env('DATABASE_URL') eagerly, but generate never
# connects — this placeholder only has to parse. The real URL arrives at runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run build -w @reserivo/shared \
  && npm run -w api prisma:generate \
  && npm run -w api build

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY .npmrc package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/apps/api/dist apps/api/dist
# Migrations and the Prisma config travel with the image so the container can
# bring the schema up to date on its own.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts

USER node
WORKDIR /app/apps/api
EXPOSE 3001

# Applying migrations at start keeps a single-instance deploy honest. Run them
# as a separate release step before rollout once there is more than one replica.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
