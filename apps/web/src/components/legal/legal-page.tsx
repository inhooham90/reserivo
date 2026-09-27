import Image from "next/image";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { AuthNav } from "@/components/auth/auth-nav";
import { PublicFooter } from "@/components/legal/public-footer";
import { Link } from "@/i18n/navigation";
import { LEGAL } from "@/lib/legal";
import { navGroup, navItem } from "@/lib/v3";
import { cn } from "cn";

export type LegalDoc = "terms" | "privacy" | "accessibility" | "sms";

const DOCS: { key: LegalDoc; href: string }[] = [
  { key: "terms", href: "/terms" },
  { key: "privacy", href: "/privacy" },
  { key: "accessibility", href: "/accessibility" },
  { key: "sms", href: "/sms" },
];

const container = "mx-auto w-full max-w-[calc(1200px+5rem)] px-6 md:px-10";

/*
 * Prose rules target the document's *direct* children, so a panel a page drops
 * in (the /sms opt-in demo, the sample texts) keeps its own spacing. Inline
 * marks (strong, links) apply at any depth.
 */
const prose = cn(
  "min-w-0 max-w-[68ch] text-[17px] leading-[1.7] text-body",
  "[&>p:first-child]:text-lg [&>p:first-child]:text-foreground",
  "[&>h2]:mt-14 [&>h2]:scroll-mt-8 [&>h2]:text-[28px] [&>h2]:leading-[1.25] [&>h2]:text-foreground",
  "[&>h3]:mt-8 [&>h3]:text-xl [&>h3]:leading-[1.3] [&>h3]:text-foreground",
  "[&>p]:mt-4",
  "[&>ul]:mt-4 [&>ul]:grid [&>ul]:list-disc [&>ul]:gap-2 [&>ul]:pl-5 [&>ul]:marker:text-muted-foreground",
  "[&>ul>li]:pl-1",
  "[&_strong]:font-semibold [&_strong]:text-foreground",
  "[&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:decoration-border [&_a]:underline-offset-3 [&_a]:transition-colors [&_a:hover]:decoration-foreground",
);

/**
 * Shared shell for Terms, Privacy, Accessibility and the /sms program page, on
 * the Morrri v3 design (DESIGN.md): white page, serif title, one readable
 * column. The pages supply only their prose, which this component must never
 * rewrite; legal and consent wording is fixed (see DESIGN.md "Don'ts" and the
 * SMS notes in CLAUDE.md).
 *
 * "On this page" is built from the document's own <h2>s on the server, which
 * also gives each one an anchor id, so no page has to keep a list in step.
 */
export function LegalPage({ doc, title, children }: { doc: LegalDoc; title: string; children: ReactNode }) {
  const t = useTranslations("footer");
  const { body, toc } = withAnchors(children);

  return (
    <div className="theme-morrri flex flex-1 flex-col">
      <header className={cn(container, "flex items-center justify-between gap-4 pt-8 pb-6")}>
        <Link href="/" className="shrink-0 rounded-sm leading-none outline-none focus-visible:ring-3 focus-visible:ring-ring">
          <Image src="/images/morrri-wordmark.png" alt={LEGAL.product} width={74} height={18} priority />
        </Link>
        <AuthNav className="bg-muted shadow-[inset_0_0_0_1px_var(--border)]" />
      </header>

      <main id="main" tabIndex={-1} className={cn(container, "flex-1 pb-16 outline-none")}>
        <div className="grid items-end gap-6 border-b border-border pt-4 pb-10 md:grid-cols-[minmax(0,1fr)_auto] md:pt-10">
          <div className="min-w-0">
            {/* From sm up only: on a phone the pill would scroll the current item out of view, and the footer links all four. */}
            <nav aria-label="Legal documents" className={cn(navGroup, "mb-10 hidden sm:inline-flex")}>
              {DOCS.map(({ key, href }) => (
                <Link key={key} href={href} aria-current={key === doc ? "page" : undefined} className={navItem(key === doc)}>
                  {t(key)}
                </Link>
              ))}
            </nav>
            <h1 className="text-[40px] leading-[1.05] text-balance md:text-[56px]">{title}</h1>
            <p className="mt-4 text-base text-muted-foreground">Last updated {LEGAL.lastUpdated}</p>
          </div>
          {/* Decorative: the document is the content. One Mona per page. */}
          <Image
            src="/images/mona-magnifier.png"
            alt=""
            width={720}
            height={715}
            sizes="200px"
            className="hidden h-auto w-[160px] md:block lg:w-[200px]"
          />
        </div>

        <div className="grid gap-10 pt-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16 lg:pt-14">
          {toc.length > 1 && (
            <aside className="min-w-0">
              {/* Collapsed on small screens so the document starts near the top. */}
              <details className="group rounded-lg bg-muted lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-5 py-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  On this page
                  <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <Contents toc={toc} className="px-5 pb-5" />
              </details>
              <nav aria-label="On this page" className="sticky top-8 hidden lg:block">
                <p className="text-sm font-medium text-foreground">On this page</p>
                <Contents toc={toc} className="mt-3" />
              </nav>
            </aside>
          )}

          <article className={cn(prose, toc.length <= 1 && "lg:col-start-2")}>
            {body}
            <p className="mt-16! rounded-lg bg-lavender px-6 py-5 text-base text-foreground md:px-8">
              Questions? Email <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
            </p>
          </article>
        </div>
      </main>

      <PublicFooter className="max-w-[calc(1200px+5rem)] md:px-10" />
    </div>
  );
}

function Contents({ toc, className }: { toc: Anchor[]; className?: string }) {
  return (
    <ol className={cn("grid gap-0.5 border-l border-border", className)}>
      {toc.map(({ id, text }) => (
        <li key={id}>
          <a
            href={`#${id}`}
            className="-ml-px block border-l border-transparent py-1.5 pl-4 text-sm leading-snug text-muted-foreground transition-colors outline-none hover:border-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring"
          >
            {text}
          </a>
        </li>
      ))}
    </ol>
  );
}

type Anchor = { id: string; text: string };

/** Gives every top-level <h2> a stable id and returns the list for the contents. */
function withAnchors(children: ReactNode): { body: ReactNode; toc: Anchor[] } {
  const toc: Anchor[] = [];
  const seen = new Map<string, number>();
  const body = Children.map(children, (child) => {
    if (!isValidElement(child) || child.type !== "h2") return child;
    const el = child as ReactElement<{ id?: string; children?: ReactNode }>;
    const text = textOf(el.props.children).trim();
    const base = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const id = el.props.id ?? (n ? `${base}-${n + 1}` : base);
    toc.push({ id, text });
    return cloneElement(el, { id });
  });
  return { body, toc };
}

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}
