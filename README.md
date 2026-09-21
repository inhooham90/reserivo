# Reserivo

Online booking for hair and nail salons. Each salon gets a booking page at `/{slug}`; designers manage their own services and hours; customers and designers message through the platform so contact details stay private.

## Layout

```
apps/api          NestJS 12 API (ESM) — Prisma 7 + PostgreSQL
apps/web          Next.js 16 frontend — Tailwind 4, shadcn/ui (Base UI)
packages/shared   zod schemas and types shared by both (@reserivo/shared)
compose.yaml      Postgres, Redis, shared watcher, api, web
```

npm workspaces; one lockfile at the root.

## Run it

```sh
cp .env.example .env            # JWT secrets (dev defaults are fine locally)
npm install                     # host install, for the IDE and running tests
docker compose up --build       # first time, or after any dependency change
```

- Web: http://localhost:3000
- API: http://localhost:3001 (`GET /health`)
- Postgres: `localhost:5433` from the host (5433, not 5432 — a native Postgres often owns 5432). Inside compose it is `postgres:5432`.
- Redis: `localhost:6379`

Source is bind-mounted, so edits hot-reload. `node_modules` live in named volumes populated from the images; after changing dependencies run `docker compose build` and `docker compose up -V` (or `down -v` to reset the volumes).

`packages/shared` compiles to `dist/`, which api and web import. The `shared` service rebuilds it on change; restart `api` after editing shared (Nest's tsc watch does not re-resolve node_modules).

## Database

```sh
npm run db:migrate -- --name <what_changed>   # prisma migrate dev, inside the api container
npm run -w api prisma:generate                # regenerate the client after schema changes (host)
npm run -w api prisma:studio                  # browse data
```

Schema: `apps/api/prisma/schema.prisma`. Generated client is git-ignored at `apps/api/src/generated/`.

## Tests

```sh
npm run -w api test        # unit
npm run -w api test:e2e    # hits DATABASE_URL from apps/api/.env — Postgres must be up
npm run lint
```

## Roles

Roles live on `SalonMembership`, not `User`: one person can be a customer at one salon and a designer at another.

| Role | Scope | Notes |
|---|---|---|
| Customer | any user | books and messages |
| Designer | per salon | owns services and hours; **never sees customer contact info** |
| Manager | per salon | runs the salon, can act as its designers |
| Site admin | `User.isSiteAdmin` | can act as anyone; every such action is audited |

Every mutating request writes an `AuditLog` row with `actorUserId` (real person) and `impersonatedUserId` (when acting as someone else).
