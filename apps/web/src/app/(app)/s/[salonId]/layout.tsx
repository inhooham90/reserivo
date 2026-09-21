"use client";

import type { Member, Salon } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SalonContext, salonKeys } from "@/lib/salon-context";
import { cn } from "cn";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/calendar", label: "Calendar" },
  { href: "/customers", label: "Customers" },
  { href: "/messages", label: "Messages" },
  { href: "/team", label: "Team" },
  { href: "/services", label: "Services" },
  { href: "/hours", label: "Hours" },
  { href: "/settings", label: "Settings" },
] as const;

export default function SalonLayout({ children }: { children: ReactNode }) {
  const { salonId } = useParams<{ salonId: string }>();
  const pathname = usePathname();
  const { user } = useAuth();

  const salon = useQuery({ queryKey: salonKeys.salon(salonId), queryFn: () => api<Salon>(`/salons/${salonId}`) });
  const members = useQuery({
    queryKey: salonKeys.members(salonId),
    queryFn: () => api<Member[]>(`/salons/${salonId}/members`),
  });

  if (salon.isPending || members.isPending) return <p className="text-muted-foreground">Loading…</p>;
  if (salon.isError || members.isError) {
    return <p className="text-destructive">You do not have access to this salon.</p>;
  }

  const me = members.data.find((m) => m.userId === user?.id) ?? null;
  const isManager = me ? me.roles.includes("MANAGER") : Boolean(user?.isSiteAdmin);
  const base = `/s/${salonId}`;

  return (
    <SalonContext.Provider value={{ salon: salon.data, members: members.data, me, isManager }}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl">{salon.data.name}</h1>
            <p className="text-sm text-muted-foreground">
              Booking page:{" "}
              <Link href={`/${salon.data.slug}`} className="underline" target="_blank">
                /{salon.data.slug}
              </Link>{" "}
              · {salon.data.timezone}
            </p>
          </div>
          <nav className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
            {TABS.map((t) => {
              const href = base + t.href;
              const active = t.href === "" ? pathname === base : pathname.startsWith(href);
              return (
                <Link
                  key={t.href}
                  href={href}
                  className={cn(
                    "rounded-md px-3 py-1.5 transition-colors",
                    active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {children}
      </div>
    </SalonContext.Provider>
  );
}
