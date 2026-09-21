import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for `next/link` and the `next/navigation`
 * helpers that build URLs. **Import `Link`, `useRouter`, `usePathname` and
 * `redirect` from here, never from Next directly** — Next's own versions drop
 * the locale prefix, which silently throws a Korean visitor back into English
 * on the first click.
 *
 * `useParams`, `useSearchParams` and `notFound` read the current request
 * rather than building URLs, so they still come from `next/navigation`.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
