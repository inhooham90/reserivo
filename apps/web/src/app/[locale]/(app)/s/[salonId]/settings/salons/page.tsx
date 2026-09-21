import { redirect } from "@/i18n/navigation";

/**
 * Moved to the top-level /settings. Switching salons was never scoped to the
 * salon you are leaving, and the page has to open for an account with no salon
 * at all — which is the only way a first one gets created.
 *
 * Kept as a redirect so old links and bookmarks still land somewhere useful.
 * The locale has to be passed explicitly: this redirect runs on the server,
 * where there is no "current" locale to infer, and dropping it would bounce a
 * Korean visitor into English.
 */
export default async function LegacyYourSalonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: "/settings", locale });
}
