import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LEGAL } from "@/lib/legal";
import { UnsubscribeCard } from "./unsubscribe-card";

type Props = { params: Promise<{ locale: string; token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "unsubscribe" });
  return {
    title: t("metaTitle", { product: LEGAL.product }),
    description: t("metaDescription", { product: LEGAL.product }),
    // A mail client should not follow this into an index.
    robots: { index: false, follow: false },
  };
}

/**
 * Where the unsubscribe link in a campaign lands.
 *
 * No account, no login, and nothing here identifies the person — a salon name
 * and three choices. Anyone who has the link already has the address it
 * belongs to, but there is no reason for the page to confirm anything further.
 *
 * The one-click header in the email points at the API's POST route directly,
 * because RFC 8058 requires a mail client to be able to unsubscribe without
 * ever opening a browser. This page is for the reader who clicks the visible
 * link instead, which is why it can afford wider choices and an undo.
 */
export default async function UnsubscribePage({ params }: Props) {
  const { token } = await params;
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-16 outline-none">
      <UnsubscribeCard token={token} />
    </main>
  );
}
