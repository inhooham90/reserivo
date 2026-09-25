import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

/**
 * The product was called Reserivo until September 2026 and renamed Morrri,
 * because the old name was too close to an existing business. The old domain
 * stays attached to this app so every link already out there keeps working:
 * booking links printed on salon cards (`reserivo.com/{slug}`), and the
 * confirmation, reset and unsubscribe links in emails already sent. Each is
 * sent to the same path on the new domain with a permanent redirect.
 *
 * The API keeps `api.reserivo.com` attached for the same reason, and must not
 * redirect: mail clients POST one-click unsubscribes there and do not follow a
 * redirect for a POST.
 */
const OLD_HOSTS = new Set(["reserivo.com", "www.reserivo.com"]);
const NEW_ORIGIN = "https://morrri.com";

export default function middleware(request: NextRequest) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  if (host && OLD_HOSTS.has(host)) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(`${NEW_ORIGIN}${pathname}${search}`, 301);
  }
  return intl(request);
}

export const config = {
  /**
   * Everything except Next's internals and anything with a file extension.
   *
   * The public booking page is `/{slug}` at the root, so this deliberately
   * matches single-segment paths — the middleware is what decides whether a
   * first segment is a locale or a salon. It never sees `/api`, which belongs
   * to the separate API app, not to this one.
   */
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
