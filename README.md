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

## Deploying

`compose.yaml` is for development only — it bind-mounts source and runs watchers. Production uses the multi-stage images:

```sh
docker compose -f compose.prod.yaml up -d --build
```

It reads everything from the environment and refuses to start if a secret is missing. Set at least:

| Variable | Notes |
|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD` | Database credentials |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Two different long random strings. Rotating either signs everyone out |
| `WEB_URL` | Public origin of the web app; also the CORS allow-list |
| `NEXT_PUBLIC_API_URL` | Public origin of the API. The API also reads it as `PUBLIC_API_URL` for the one-click unsubscribe header. **Baked into the browser bundle at build time** — changing it needs a web rebuild |
| `RESEND_API_KEY`, `EMAIL_FROM` | Required in production: confirmations and password resets are undeliverable without them. `EMAIL_FROM` must be on a domain verified with Resend |
| `SITE_ADMIN_EMAILS` | Optional; see below |

The API applies migrations on start (`prisma migrate deploy`), which suits a single instance. With more than one replica, run migrations as a release step before rollout instead.

Not yet set up, and worth doing before real customer data lands: **database backups**, TLS termination, and log shipping.

## Reminders

Each salon picks its own schedule under Settings (2 days / 1 day / 2 hours before; none turns them off). A sweep runs every five minutes and sends whatever is owed.

**Email** works out of the box wherever `RESEND_API_KEY` is set.

**SMS** stays off until Twilio is configured:

```sh
TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+1...
```

Two things gate a text besides that: the customer must have ticked the reminder box when booking (US law requires express opt-in), and — for US numbers — **the sending number must be registered for A2P 10DLC**, or carriers will filter the messages. Registration is done in the Twilio console, costs a few dollars a month, and takes days to weeks. Reminders are email-only until it clears, with no code change either way.

Cost at pilot scale is negligible: roughly $0.0079 per message plus $1.15/month for the number, so 200 reminders is under $2.

## Site admin

The console at `/admin` (platform stats, user and salon search, act-as, audit log) needs `isSiteAdmin`. It is granted by configuration, never by anything inside the app:

```sh
SITE_ADMIN_EMAILS=you@example.com,cofounder@example.com
```

Set in `compose.yaml` (defaults to `james@akkija.com`) or overridden in `.env`. Listed accounts are promoted when the API starts, and anyone on the list who signs up later is an admin from their first request. It takes effect immediately — no re-login.

This is **grant-only**: taking an address off the list does not remove the flag. To revoke, or to promote someone not in the config:

```sh
docker compose exec postgres psql -U reserivo -d reserivo \
  -c "update users set \"isSiteAdmin\" = false where email = 'them@example.com'"
```

**Acting as a user** hands you an access token that behaves as them, with a red banner across the app and a Stop button. It sets no refresh cookie, so it lapses when the access token expires (15 min) and your own session is still underneath. Everything you do is written to the audit log under your account, alongside theirs.

## Roles

Roles live on `SalonMembership`, not `User`: one person can be a customer at one salon and a designer at another.

| Role | Scope | Notes |
|---|---|---|
| Customer | any user | books and messages |
| Designer | per salon | owns services and hours; **never sees customer contact info** |
| Manager | per salon | runs the salon, can act as its designers |
| Site admin | `User.isSiteAdmin` | can act as anyone; every such action is audited |

Every mutating request writes an `AuditLog` row with `actorUserId` (real person) and `impersonatedUserId` (when acting as someone else).
