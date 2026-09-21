# Deploying Reserivo to Heroku

Two Heroku apps built from the Dockerfiles already in this repo, `reserivo-api`
and `reserivo-web`, plus Heroku Postgres. Roughly $19/month: two Basic dynos at
$7 and an `essential-0` database at $5.

**This is live on its custom domains.** Every step below is done, including
DNS, certificates and backups. It is kept as the record of how the stack is
put together and how to rebuild it.

| | |
|---|---|
| Web | https://reserivo.com (and www) |
| API | https://api.reserivo.com |
| Heroku origins | `reserivo-web-95d8b262c913`, `reserivo-api-e04c6a11001e` |

Email is live: Resend is configured and sending as `noreply@reserivo.com`.
Text reminders are still off until Twilio is registered.

Everything below is idempotent. Re-running a step is never destructive except
where it says otherwise.

> **Shell.** Commands are written for **PowerShell**, because that is what this
> project is developed on. PowerShell is not bash: `\` is not a line
> continuation (the backtick is), and an unquoted comma turns one argument into
> an array. Both bite on `heroku config:set`, so the commands below avoid them
> entirely. If you prefer bash, Git Bash is installed and the usual `\` and
> `$(...)` forms work there.

## Before you start

- `heroku login`
- Docker running
- A Resend-verified sending domain. **`reserivo.com` itself is the verified
  one**, not a subdomain: Resend signs with DKIM at
  `resend._domainkey.reserivo.com` and uses `send.reserivo.com` only as the
  bounce return path, which it sets up itself. Google Workspace mail is
  unaffected because the apex carries no SPF record of its own
- DNS for `reserivo.com` is at **Namecheap**, not Google Admin

## 1. Create the apps

```powershell
heroku create reserivo-api --stack container
heroku create reserivo-web --stack container
heroku addons:create heroku-postgresql:essential-0 -a reserivo-api
```

The add-on sets `DATABASE_URL` on the API app. Never set it by hand — Heroku
rotates the credentials in it.

## 2. Configure the API

Build the list first, then pass it in one go. This is the reliable way to do it
in PowerShell: every value is quoted, so commas and slashes stay literal, and
there are no line-continuation characters to get wrong.

```powershell
$acc = node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
$ref = node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

$vars = @(
  "NODE_ENV=production",
  "DATABASE_SSL=no-verify",
  "JWT_ACCESS_SECRET=$acc",
  "JWT_REFRESH_SECRET=$ref",
  "WEB_URL=https://reserivo.com",
  "CORS_ORIGIN=https://reserivo.com,https://www.reserivo.com",
  "SITE_ADMIN_EMAILS=james@akkija.com",
  "RESEND_API_KEY=re_your_key_here",
  "EMAIL_FROM=Reserivo <noreply@reserivo.com>"
)

heroku config:set -a reserivo-api @vars
```

Generate the two signing secrets fresh and never reuse them between
environments. Rotating either signs everyone out.

**Do not set `PORT`.** Heroku assigns it per dyno and the app reads it.

`CORS_ORIGIN` is a comma-separated allowlist and must name **every** origin a
browser will load the app from. Miss `www` and the site looks fine until
someone types it, then every API call fails. `WEB_URL` stays a single canonical
origin because it builds the invite links people receive.

`DATABASE_SSL=no-verify` is required. Heroku Postgres demands TLS but presents a
certificate signed by its own CA, which Node will not trust. This encrypts the
traffic without verifying the certificate. It is the accepted trade on Heroku
because the hop stays inside their network. The default is `off`, so nothing
silently downgrades anywhere else.

Without `RESEND_API_KEY` the app boots fine and writes every email to the log
instead of sending it, so account confirmation and password reset silently do
nothing. The boot log says which it picked: `Email via Resend` or
`No RESEND_API_KEY — notifications are logged only`.

`EMAIL_FROM` **must be on a domain verified in Resend** or every send is
rejected with a 403. The production key is send-only, so it cannot list
domains — the only way to find out which are verified is to attempt a send. A
rejected attempt delivers nothing, so probing is safe:

```powershell
$body = @{ from = "Reserivo <noreply@reserivo.com>"; to = @("you@example.com"); subject = "check"; text = "check" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri https://api.resend.com/emails -Body $body -ContentType application/json -Headers @{ Authorization = "Bearer $env:RESEND_API_KEY" }
```

Text reminders stay off until all three Twilio values are set, and the app is
happy that way:

```powershell
heroku config:set -a reserivo-api TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM_NUMBER=+1...
```

## 3. Configure the web app

```powershell
heroku config:set -a reserivo-web NODE_ENV=production API_URL_INTERNAL=https://api.reserivo.com
```

`API_URL_INTERNAL` is what server components call. On Heroku the two apps are
separate, so it is the public API origin rather than an internal hostname.

## 4. Custom domains

The three domains are **already added to Heroku**:

```powershell
heroku domains:add api.reserivo.com -a reserivo-api
heroku domains:add reserivo.com -a reserivo-web
heroku domains:add www.reserivo.com -a reserivo-web
```

### The Namecheap records

Namecheap → Domain List → **reserivo.com** → Manage → **Advanced DNS** → Host
Records. Every target is unique to its hostname; they are not interchangeable.

| Type            | Host  | Value                                                          | TTL       |
|-----------------|-------|----------------------------------------------------------------|-----------|
| ALIAS Record    | `@`   | `shrouded-date-wddud7nwy26fs7oobbnhwnew.herokudns.com`         | Automatic |
| CNAME Record    | `www` | `fluffy-pear-ag5mahj9uo2nishg2b24o413.herokudns.com`           | Automatic |
| CNAME Record    | `api` | `cylindrical-mayflower-k5gfadg9r54dnju25v7n9nmq.herokudns.com` | Automatic |

A root domain cannot be a CNAME. Namecheap's **ALIAS Record** type is the way
round it and works on their BasicDNS, which is what this domain uses
(`pdns1/pdns2.registrar-servers.com`).

### Delete these if present

Namecheap adds them to new domains and both will fight the records above:

- **CNAME `www` → `parkingpage.namecheap.com`**
- **URL Redirect Record on `@`**

Also turn off any Domain Parking on the domain.

### Do not touch these

`reserivo.com` is a Google Workspace alias domain. Mail to it dies if these
go, and Google may un-verify the domain:

| Type | Host | Value                                                                 |
|------|------|-----------------------------------------------------------------------|
| MX   | `@`  | `1 smtp.google.com`                                                   |
| TXT  | `@`  | `google-site-verification=C2GXEfisVKykn-ohOFva6KXElwGU4sULlyRkjsbBThU` |

Resend will ask for its own records on a `send` subdomain. Those are additive
and safe to add in the same sitting.

### After DNS resolves

Certificates are issued automatically, then the app has to be told its real
origins. The web image must be rebuilt because the API origin is compiled into
the browser bundle.

```powershell
heroku certs:auto:enable -a reserivo-api
heroku certs:auto:enable -a reserivo-web

heroku config:set -a reserivo-api WEB_URL=https://reserivo.com
heroku config:set -a reserivo-web API_URL_INTERNAL=https://api.reserivo.com

.\deploy\heroku-deploy.ps1 -ApiOrigin https://api.reserivo.com
```

`CORS_ORIGIN` already lists both `reserivo.com` and `www.reserivo.com`, so it
needs no change.

## 5. Deploy

```powershell
.\deploy\heroku-deploy.ps1 -ApiOrigin https://reserivo-api-e04c6a11001e.herokuapp.com
```

In bash: `API_ORIGIN=... ./deploy/heroku-deploy.sh`.

Once `api.reserivo.com` resolves, pass that as `-ApiOrigin` instead and
re-run. The web image has to be rebuilt for the switch because the API origin
is compiled into the browser bundle.

The API dyno runs `prisma migrate deploy` before starting the server, so the
schema comes up to date on its own. The script releases the API first for that
reason.

## 6. Check it worked

```powershell
heroku logs --tail -a reserivo-api     # expect the migrations, then "API listening"
curl.exe -sS https://api.reserivo.com/health
```

Use `curl.exe`, not `curl` — in PowerShell the bare name is an alias for
`Invoke-WebRequest`, which takes different arguments.

Then in a browser: sign up, create a salon, open its public booking page, and
confirm the verification email arrives.

## 7. Turn on backups before real bookings exist

```powershell
heroku pg:backups:schedule DATABASE_URL --at "04:00 America/New_York" -a reserivo-api
heroku pg:backups:schedules -a reserivo-api
```

Take one manually before any risky change:
`heroku pg:backups:capture -a reserivo-api`.

## Rolling back

```powershell
heroku releases -a reserivo-api
heroku rollback -a reserivo-api
```

Rollback reverts the **code**, not the database. A release that added a
migration stays migrated, which is fine because every migration so far is
additive. Before shipping one that drops or rewrites a column, capture a backup
first and assume rollback will not save you.

## Gotchas

- **A missing certificate looks like a CORS bug.** Before ACM issued, the
  browser fell back to `http://reserivo.com`, which is not in `CORS_ORIGIN`
  and never will be. The symptom was an `OPTIONS` preflight returning 204 with
  no `Access-Control-Allow-Origin` header and no `POST` following it, which
  reads as "I cannot create an account". Fix the certificate, never widen the
  allowlist to plain http.
- **Split the app across two herokuapp.com subdomains and sessions break.**
  `herokuapp.com` is on the Public Suffix List, so `reserivo-web-*` and
  `reserivo-api-*` are different *sites* and the refresh cookie
  (`SameSite=Lax`) is dropped. `reserivo.com` and `api.reserivo.com` share a
  registrable domain, so the custom domains are what make login actually work.

- **PowerShell parsing.** Unquoted commas become arrays and `\` is not a line
  continuation, which is why step 2 builds an array and splats it. If you hit
  `Missing argument in parameter list`, that is what happened.
- **`error from registry: unsupported`.** Heroku's registry is fussy in three
  ways and gives this one error for all of them. The decisive one is that
  Docker Desktop's containerd image store writes **OCI manifests** and Heroku
  only accepts Docker Schema 2 — the push uploads every layer, then fails on the
  manifest. The scripts build straight to the registry with
  `--output type=image,oci-mediatypes=false,push=true`, plus
  `--provenance=false --sbom=false` (no attestations) and
  `--platform linux/amd64`. Do not drop any of it, and do not split it back
  into `docker build` then `docker push` — that re-exports the image and
  loses the media type.
- **Native stderr aborts PowerShell scripts.** `docker` and `heroku` write
  notices to stderr, and Windows PowerShell turns those into terminating errors
  when stderr is redirected under `$ErrorActionPreference = "Stop"`. A
  "heroku update available" notice was enough to kill a good deploy. The script
  relaxes the preference around native calls and checks `$LASTEXITCODE`
  instead.
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
