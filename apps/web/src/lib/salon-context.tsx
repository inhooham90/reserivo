"use client";

import type { Member, Salon } from "@reserivo/shared";
import { createContext, useContext } from "react";

/** Everything a page inside /s/[salonId] needs about where it is and who is looking. */
export interface SalonContextValue {
  salon: Salon;
  members: Member[];
  /** The current user's membership in this salon; null for a site admin with none. */
  me: Member | null;
  isManager: boolean;
}

export const SalonContext = createContext<SalonContextValue | null>(null);

export function useSalon(): SalonContextValue {
  const ctx = useContext(SalonContext);
  if (!ctx) throw new Error("useSalon must be used inside the salon layout");
  return ctx;
}

export const salonKeys = {
  salon: (id: string) => ["salons", id] as const,
  members: (id: string) => ["salons", id, "members"] as const,
  invitations: (id: string) => ["salons", id, "invitations"] as const,
  services: (id: string) => ["salons", id, "services"] as const,
  availability: (id: string, memberId: string) => ["salons", id, "availability", memberId] as const,
  hours: (id: string) => ["salons", id, "hours"] as const,
};
