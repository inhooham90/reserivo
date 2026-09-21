# Reserivo — working notes for Claude

See README.md for how to run things. This file is the non-obvious stuff.

## Conventions

- **API is ESM.** `apps/api` has `"type": "module"` and `module: nodenext`; every relative import needs an explicit `.js` extension (`from './auth.service.js'`), including for `.ts` sources.
- **Validation is zod, shared.** Request/response schemas live in `packages/shared/src`. Controllers validate with `@Body(new ZodValidationPipe(schema))`. Do not add class-validator DTOs.
- **Tenancy goes through the guard.** Any route scoped to a salon takes `:salonId` and uses `@SalonRoles(...)`; services read `salonId` from `@Tenant()`, never from the body.
- **Public routes are explicit.** `JwtAuthGuard` is global; opt out with `@Public()`.
- **Audit is automatic.** `AuditInterceptor` logs every mutating request. Call `AuditService.record` directly only when you need a real before/after diff.
- **Designers never receive customer contact fields.** No select, DTO, or notification template that reaches a DESIGNER role may include customer `phone` or `email`. The public `/salons/by-slug` payload selects no user fields at all.
- **Roles are a set of capabilities.** `SalonMembership.roles: SalonRole[]` — `MANAGER` administers (team, salon hours, settings, customer contact info); `DESIGNER` is bookable (owns services and personal hours, listed on the booking page). A solo operator holds both; a front-desk manager only `MANAGER`. Bookable = `roles has DESIGNER` — there is no separate flag. Gaining `DESIGNER` seeds personal hours from the salon's (`seedMemberHours`); losing it or being removed is refused while upcoming appointments exist. Use `members.findDesigner()` wherever bookability is required. Managers act on anyone via `assertCanManageMember`; others only on themselves.
- **Hours are local minutes.** `AvailabilityRule`/`Exception` store minutes-from-midnight in `Salon.timezone`; exception dates are plain `YYYY-MM-DD`. Nothing is converted to UTC until a concrete slot is computed.
- **Two layers of hours.** `SalonHours`/`SalonHoursException` are the shop's opening hours — shared, manager-edited, seeded Mon–Sat 9–18 on creation. Every bookable member's `AvailabilityRule`s must fit inside them (`findOutsideSalonHours` rejects on save) and the engine intersects at runtime anyway (`effectiveWindows`). Manager-only members have no hours at all (409 on read/write).
- **Destructive migrations are hand-written.** `prisma migrate dev --create-only` refuses to run non-interactively when the diff drops columns; create the folder yourself, write SQL that preserves data, apply with `prisma migrate deploy`, then confirm with `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`.
- **Invites return the URL once.** Only the SHA-256 of the token is stored; the audit redactor already masks `token` params.
- **Double booking is prevented by the database.** `appointments_no_double_booking` is an EXCLUDE constraint on `(designerId, tstzrange(startAt, blockEndAt))` for PENDING/CONFIRMED rows. `blockEndAt` (= endAt + buffer) is a *stored* column because index expressions must be IMMUTABLE and `timestamptz + interval` is only STABLE. Always set it when writing appointments. `isDoubleBooking()` maps the violation to a 409.
- **A no-show is gated and reversible.** It can only be marked `NO_SHOW_GRACE_MIN` (15) minutes after the start — someone late is not absent — and it is the one final status that can go back to `CONFIRMED` (status-only; the exclusion constraint may refuse if the time was re-booked). Every other final state stays final. The staff UI adds a confirmation step on top of the API gate.
- **Past slots are never offered.** Staff availability uses `notBefore = now` (no lead time, but no past); the public path adds the salon's lead time on top. The staff calendar shades gone time and refuses placement there. Booking a past time is still possible through the raw API, so a retroactive walk-in record stays available to a future admin path.
- **The slot engine is pure.** `availability/slot-engine.ts` takes rules, exceptions, busy intervals and policies and returns slots; `SlotsService` does the I/O. Public booking is valid only if the requested `startAt` is one of the slots the engine would offer *right now* — that one check enforces hours, lead time, max advance, grid alignment and known conflicts. Staff bookings skip the engine and rely on the constraint alone.
- **All wall-clock ⇄ instant conversion goes through `packages/shared/src/time.ts`** (`localToUtc`, `utcToLocal`). Do not call `date-fns-tz` elsewhere in the API.
- **`@OptionalAuth()`** populates `req.user` when a token is present and leaves it `null` otherwise; used by public booking so signed-in customers get linked. Registration also claims guest `Customer` rows with the same email.
- **Staff see customer names; managers see contact fields.** `toStaffView(row, isManager)` / `toCustomer(row, includeContact)` are the only places that decide, and designers' calendars must never include `customer.email`/`phone`.
- **Notifications go through `NotificationsService.emit`** (fire-and-forget). Transport is chosen at boot: `ResendTransport` when `RESEND_API_KEY` is set, otherwise `LogTransport`. Templates live in `notifications/templates.ts`; a message aimed at a designer carries the customer's display name only, and relay emails never include the chat body — they are nudges with a link.
- **The relay never reveals who typed.** `Message.actorUserId` is the real author; `sentAsMembershipId` is the thread's designer. `threadMine` (customer view) exposes `fromName` only; `threadStaff` adds `writtenBy` when a manager wrote as the designer. Customers can open a thread only with a designer at a salon that has them on record (they booked); staff can open one only with customers who have an account (`Customer.userId`).
- **CRM visibility.** Notes and tags are the salon's shared knowledge — every staff member reads and edits them. Name/email/phone are managers-only to read *and* write (`CustomersService.update` enforces it).
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
- Compose passes unset variables as **empty strings** (`${VAR:-}`), so optional env vars must accept `""` as absent — see `RESEND_API_KEY` in `config/env.ts`. A plain `z.string().min(1).optional()` crashes the api at boot.
- Headless screenshots: `msedge --headless=new --user-data-dir=<tmp> --screenshot=… --blink-settings=preferredColorScheme=1` (1 = light, 0 = dark). Without its own `--user-data-dir` it silently hands off to the running Edge and writes nothing.
- `apps/api/.env` is for host-side tooling (tests, prisma CLI). Inside compose the same vars come from `compose.yaml`.

## Roadmap

Phase 0 Foundations ✅ → 1 Salon setup (invites, services, hours) ✅ → 2 Booking core (slot engine, exclusion constraint, public booking, staff calendar) ✅ → 3 CRM + message relay + Resend email ✅ (availability engine, exclusion constraint) → 3 CRM + message relay → 4 Admin console (act-as) → 5 Growth (reminders, no-shows, Stripe deposits).
