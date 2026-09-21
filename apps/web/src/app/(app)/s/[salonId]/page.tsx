"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** The salon's home is its schedule. */
export default function SalonIndexPage() {
  const { salonId } = useParams<{ salonId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/s/${salonId}/calendar`);
  }, [salonId, router]);

  return <p className="text-muted-foreground">Opening the schedule…</p>;
}
