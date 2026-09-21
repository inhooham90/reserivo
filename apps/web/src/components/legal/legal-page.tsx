import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL } from "@/lib/legal";

/**
 * Shared shell for the Terms and Privacy pages: one readable column with
 * consistent spacing, so each document only has to supply its prose.
 */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-6 py-12">
      <Link href="/" className="text-sm text-muted-foreground underline">
        ← {LEGAL.product}
      </Link>
      <h1 className="mt-4 text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Last updated {LEGAL.lastUpdated}</p>
      <div
        className={[
          "mt-8",
          "[&_h2]:mt-10 [&_h2]:text-xl",
          "[&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-medium",
          "[&_p]:mt-3 [&_p]:leading-relaxed",
          "[&_ul]:mt-3 [&_ul]:grid [&_ul]:gap-1.5 [&_ul]:pl-5",
          "[&_li]:list-disc",
          "[&_strong]:font-semibold",
        ].join(" ")}
      >
        {children}
      </div>
      <p className="mt-12 text-sm text-muted-foreground">
        Questions? Email{" "}
        <a href={`mailto:${LEGAL.supportEmail}`} className="underline">
          {LEGAL.supportEmail}
        </a>
        .
      </p>
    </main>
  );
}
