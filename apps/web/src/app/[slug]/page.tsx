import type { PublicSalon } from "@reserivo/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api-server";
import { formatCents, formatDuration } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

/**
 * Public booking page. Storefront mood: bigger type, more air. Every color here
 * is a token so a salon's own accent can override --primary later.
 * Phase 2 adds slot picking.
 */
export default async function SalonPublicPage({ params }: Props) {
  const { slug } = await params;
  const salon = await serverApi<PublicSalon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  if (!salon) notFound();

  const withServices = salon.designers.filter((d) => d.services.length > 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="grid gap-2">
        <h1 className="text-4xl">{salon.name}</h1>
        <p className="text-muted-foreground">Choose a stylist and a service. Online booking opens soon.</p>
      </header>

      {withServices.length === 0 && (
        <p className="text-muted-foreground">This salon is still setting up its menu.</p>
      )}

      {withServices.map((d) => (
        <section key={d.id} className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="text-2xl">{d.displayName}</h2>
            {d.bio && <p className="max-w-prose text-muted-foreground">{d.bio}</p>}
          </div>
          <ul className="divide-y rounded-xl border bg-card">
            {d.services.map((s) => (
              <li key={s.id} className="flex items-baseline justify-between gap-4 px-5 py-4">
                <div className="grid gap-0.5">
                  <span className="font-medium">{s.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(s.durationMin)}
                    {s.category ? ` · ${s.category}` : ""}
                    {s.description ? ` — ${s.description}` : ""}
                  </span>
                </div>
                <span className="shrink-0 tabular-nums">{formatCents(s.priceCents)}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const salon = await serverApi<PublicSalon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  return { title: salon ? `${salon.name} · Reserivo` : "Reserivo" };
}
