"use client";

import type { CustomerConversation } from "@reserivo/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

/** The customer's inbox across every salon they have booked with. */
export default function MessagesPage() {
  const convs = useQuery({
    queryKey: ["me", "conversations"],
    queryFn: () => api<CustomerConversation[]>("/me/conversations"),
    refetchInterval: 15_000,
  });

  return (
    <div className="grid gap-4">
      <h1 className="text-xl">Messages</h1>
      {convs.isPending && <p className="text-muted-foreground">Loading…</p>}
      {convs.data?.length === 0 && (
        <p className="text-muted-foreground">
          No conversations yet. Open one from an appointment under{" "}
          <Link href="/appointments" className="underline">
            My appointments
          </Link>
          .
        </p>
      )}
      <ul className="divide-y rounded-xl border bg-card">
        {convs.data?.map((c) => (
          <li key={c.id}>
            <Link href={`/messages/${c.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-accent">
              <span className="grid gap-0.5">
                <span className="flex items-center gap-2 font-medium">
                  {c.designer.displayName}
                  <span className="text-sm text-muted-foreground">· {c.salon.name}</span>
                  {c.unread > 0 && <Badge>{c.unread}</Badge>}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {c.lastMessage ? `${c.lastMessage.sender === "CUSTOMER" ? "You: " : ""}${c.lastMessage.body}` : "Say hello"}
                </span>
              </span>
              {c.lastMessage && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(c.lastMessage.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
