import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

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
