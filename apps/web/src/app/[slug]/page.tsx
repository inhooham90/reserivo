import type { Salon } from "@reserivo/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api-server";

type Props = { params: Promise<{ slug: string }> };

/** Public booking page. Phase 2 adds the service picker and availability. */
export default async function SalonPublicPage({ params }: Props) {
  const { slug } = await params;
  const salon = await serverApi<Salon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  if (!salon) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-3xl font-semibold tracking-tight">{salon.name}</h1>
      <p className="text-muted-foreground">Online booking is coming soon.</p>
    </main>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const salon = await serverApi<Salon>(`/salons/by-slug/${encodeURIComponent(slug)}`);
  return { title: salon ? `${salon.name} · Reserivo` : "Reserivo" };
}
