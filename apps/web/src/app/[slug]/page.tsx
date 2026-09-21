import type { PublicSalon } from "@reserivo/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";
import { PublicFooter } from "@/components/legal/public-footer";
import { serverApi } from "@/lib/api-server";
import { summarizeHours } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

/**
 * Public booking page. Server-rendered shell (SEO, fast first paint); the
 * flow itself is a client island. Every color is a token so a salon's own
 * accent can override --primary later.
 */
export default async function SalonPublicPage({ params }: Props) {
  const { slug } = await params;
  const salon = await serverApi<PublicSalon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  if (!salon) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      <header className="grid gap-2">
        <h1 className="text-4xl">{salon.name}</h1>
        {salon.hours.length > 0 && <p className="text-sm text-muted-foreground">{summarizeHours(salon.hours)}</p>}
        <p className="text-muted-foreground">Choose a service to see available times.</p>
      </header>
      <BookingFlow salon={salon} />
      <PublicFooter />
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const salon = await serverApi<PublicSalon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  return { title: salon ? `Book at ${salon.name} · Reserivo` : "Reserivo" };
}
