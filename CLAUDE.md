# Reserivo — working notes for Claude

See README.md for how to run things. This file is the non-obvious stuff.

## Conventions

- **API is ESM.** `apps/api` has `"type": "module"` and `module: nodenext`; every relative import needs an explicit `.js` extension (`from './auth.service.js'`), including for `.ts` sources.
- **Validation is zod, shared.** Request/response schemas live in `packages/shared/src`. Controllers validate with `@Body(new ZodValidationPipe(schema))`. Do not add class-validator DTOs.
- **Tenancy goes through the guard.** Any route scoped to a salon takes `:salonId` and uses `@SalonRoles(...)`; services read `salonId` from `@Tenant()`, never from the body.
- **Public routes are explicit.** `JwtAuthGuard` is global; opt out with `@Public()`.
- **Audit is automatic.** `AuditInterceptor` logs every mutating request. Call `AuditService.record` directly only when you need a real before/after diff.
- **Designers never receive customer contact fields.** No select, DTO, or notification template that reaches a DESIGNER role may include customer `phone` or `email`. The public `/salons/by-slug` payload selects no user fields at all.
- **Any member can own services and hours.** "Designer" in `Service.designerId` / availability means a `SalonMembership` of either role — owner-stylists are the norm. `acceptsBookings=false` hides a member from the booking page. Managers act on anyone via `assertCanManageMember`; others only on themselves.
- **Hours are local minutes.** `AvailabilityRule`/`Exception` store minutes-from-midnight in `Salon.timezone`; exception dates are plain `YYYY-MM-DD`. Nothing is converted to UTC until a concrete slot is computed.
- **Invites return the URL once.** Only the SHA-256 of the token is stored; the audit redactor already masks `token` params.
- **Prisma 7.** Config is `apps/api/prisma.config.ts`; client is the `prisma-client` generator with the `pg` adapter. Regenerate with `npm run -w api prisma:generate` after schema edits.
- **shadcn/ui v4 is on Base UI, not Radix.** There is no `asChild`; compose with `render={<Link href="…" />}`. Components are in `apps/web/src/components/ui`.
- **Timestamps are UTC `timestamptz`.** `Salon.timezone` (IANA) is for rendering only.

## Styling

- **Tokens, not colors.** All color/radius/font decisions live as CSS variables in `apps/web/src/app/globals.css`. Components use `bg-primary`, `text-muted-foreground`, etc. Never a raw hex/oklch in a page or component.
- **Direction: warm & editorial.** Warm off-white ground, warm charcoal text, one muted terracotta accent, 0.5rem radius. Body/UI font is Geist (`font-sans`); headings use Fraunces via `font-heading`.
- **Dark mode follows the OS** (`prefers-color-scheme`). There is no manual toggle; if one is added, switch the `dark` custom variant to class-based and add `next-themes`.
- **Two moods, one system.** The dashboard is a dense tool. The public booking page `/{slug}` is a storefront: larger type, more whitespace, and it must keep working when `--primary` is overridden per salon (future salon branding). Don't hard-code brand color on that route.

## Gotchas

- `.npmrc` sets `legacy-peer-deps=true` to dodge an npm 10 arborist crash (`edgesOut` of null) on this dependency graph. Keep it until the host npm is upgraded.
- Postgres is published on host port **5433**; a native Postgres service holds 5432 on this machine.
- After editing `packages/shared`, restart the `api` container; the `shared` service rebuilds `dist/` but Nest does not re-resolve it.
- **Windows bind mounts emit no inotify events**, so every watcher in compose polls: `api` and `shared` set `TSC_WATCHFILE`/`TSC_WATCHDIRECTORY`, and `web` runs `next dev --webpack` with `WATCHPACK_POLLING` because Turbopack cannot poll. On Linux/WSL you can drop `--webpack` for faster builds. Moving the repo into the WSL filesystem is the real fix.
- Headless screenshots: `msedge --headless=new --user-data-dir=<tmp> --screenshot=… --blink-settings=preferredColorScheme=1` (1 = light, 0 = dark). Without its own `--user-data-dir` it silently hands off to the running Edge and writes nothing.
- `apps/api/.env` is for host-side tooling (tests, prisma CLI). Inside compose the same vars come from `compose.yaml`.

## Roadmap

Phase 0 Foundations ✅ → 1 Salon setup (invites, services, hours) ✅ → 2 Booking core (availability engine, exclusion constraint) → 3 CRM + message relay → 4 Admin console (act-as) → 5 Growth (reminders, no-shows, Stripe deposits).
