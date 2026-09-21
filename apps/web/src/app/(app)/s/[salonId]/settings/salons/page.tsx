import { redirect } from "next/navigation";

/**
 * Moved to the top-level /settings. Switching salons was never scoped to the
 * salon you are leaving, and the page has to open for an account with no salon
 * at all — which is the only way a first one gets created.
 *
 * Kept as a redirect so old links and bookmarks still land somewhere useful.
 */
export default function LegacyYourSalonsPage() {
  redirect("/settings");
}
