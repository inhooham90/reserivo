# Deploying Reserivo to Heroku

Two Heroku apps built from the Dockerfiles already in this repo: `reserivo-api`
and `reserivo-web`, plus Heroku Postgres. Roughly $19/month — two Basic dynos at
$7 and an `essential-0` database at $5.

Everything below is idempotent. Re-running a step is never destructive except
where it says otherwise.

## Before you start

- `heroku login` (the CLI is installed; you are not currently logged in)
- Docker running
- A Resend-verified sending domain. Use a subdomain such as `send.reserivo.com`
  so it cannot affect Google Workspace mail on `reserivo.com`
- DNS for `reserivo.com` is at **Namecheap**, not Google Admin

## 1. Create the apps

```bash
heroku create reserivo-api --stack container
heroku create reserivo-web --stack container
heroku addons:create heroku-postgresql:essential-0 -a reserivo-api
```

The add-on sets `DATABASE_URL` on the API app. Never set it by hand — Heroku
rotates the credentials in it.

## 2. Configure the API

Generate the two signing secrets fresh and never reuse them between
environments. Rotating either signs everyone out.

```bash
heroku config:set -a reserivo-api \
  NODE_ENV=production \
  DATABASE_SSL=no-verify \
  JWT_ACCESS_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')" \
  JWT_REFRESH_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("base64url"))')" \
  WEB_URL=https://reserivo.com \
  CORS_ORIGIN=https://reserivo.com \
  SITE_ADMIN_EMAILS=james@akkija.com \
  RESEND_API_KEY=re_your_key_here \
  EMAIL_FROM='Reserivo <noreply@send.reserivo.com>'
```

**Do not set `PORT`.** Heroku assigns it per dyno and the app reads it.

`DATABASE_SSL=no-verify` is required: Heroku Postgres demands TLS but presents a
certificate signed by its own CA, which Node will not trust. This encrypts the
traffic without verifying the certificate. It is the accepted trade on Heroku
because the hop stays inside their network. The default is `off`, so nothing
silently downgrades anywhere else.

Text reminders stay off until all three Twilio values are set, and the app is
happy that way:

```bash
heroku config:set -a reserivo-api \
  TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+1...
```

## 3. Configure the web app

```bash
heroku config:set -a reserivo-web \
  NODE_ENV=production \
  API_URL_INTERNAL=https://api.reserivo.com
```

`API_URL_INTERNAL` is what server components call. On Heroku the two apps are
separate, so it is the public API origin rather than an internal hostname.

## 4. Custom domains

```bash
heroku domains:add api.reserivo.com -a reserivo-api
heroku domains:add reserivo.com     -a reserivo-web
heroku domains:add www.reserivo.com -a reserivo-web
```

Each command prints a DNS target ending in `herokudns.com`. In Namecheap's
Advanced DNS, add:

| Type  | Host  | Value                          |
|-------|-------|--------------------------------|
| CNAME | `api` | the API app's DNS target       |
| CNAME | `www` | the web app's DNS target       |
| ALIAS | `@`   | the web app's DNS target       |

A root domain cannot be a CNAME; Namecheap's **ALIAS Record** type is the way
round it and works on their BasicDNS.

**Leave the existing MX and TXT records alone.** `reserivo.com` is a Google
Workspace alias domain and mail to it breaks if those go.

Certificates are automatic once DNS resolves:

```bash
heroku certs:auto -a reserivo-api
heroku certs:auto -a reserivo-web
```

## 5. Deploy

```bash
API_ORIGIN=https://api.reserivo.com ./deploy/heroku-deploy.sh
```

The API dyno runs `prisma migrate deploy` before starting the server, so the
schema comes up to date on its own. The script releases the API first for that
reason.

The API origin is compiled into the browser bundle, so switching it later means
rebuilding the web image, not just changing a config var.

## 6. Check it worked

```bash
heroku logs --tail -a reserivo-api     # expect the migrations, then "API listening"
curl -sS https://api.reserivo.com/health
```

Then in a browser: sign up, create a salon, open its public booking page, and
confirm the verification email arrives.

## 7. Turn on backups before real bookings exist

```bash
heroku pg:backups:schedule DATABASE_URL --at '04:00 America/New_York' -a reserivo-api
heroku pg:backups:schedules -a reserivo-api
```

Take one manually before any risky change: `heroku pg:backups:capture -a reserivo-api`.

## Rolling back

```bash
heroku releases -a reserivo-api
heroku rollback -a reserivo-api
```

Rollback reverts the **code**, not the database. A release that added a
migration stays migrated, which is fine because every migration so far is
additive. Before shipping one that drops or rewrites a column, capture a backup
first and assume rollback will not save you.

## Gotchas

- **Attestations.** Heroku's registry rejects the manifest lists buildx attaches
  by default. The deploy script passes `--provenance=false --sbom=false
  --platform linux/amd64`; do not drop those flags.
- **Migrations run at dyno boot.** Fine at one dyno. If you ever scale past one,
  move them to a release-phase image instead, or two dynos will race.
- **Dyno filesystems are ephemeral.** Nothing is written to disk, so this costs
  nothing today. Keep it that way.
- **The `web` process type.** Both apps release a process literally named `web`.
  That is Heroku's name for the internet-facing dyno, not a reference to our web
  app.
- **Rate limiting depends on `trust proxy`**, which is on in production. Without
  it every request would look like it came from Heroku's router and the whole
  internet would share one bucket.
