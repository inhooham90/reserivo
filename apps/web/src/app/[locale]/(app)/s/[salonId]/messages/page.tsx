"use client";

import type { Message, StaffConversation, Thread } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ThreadView } from "@/components/messaging/thread-view";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { salonKeys, useSalon } from "@/lib/salon-context";
import { cn } from "cn";

export default function StaffMessagesPage() {
  return (
    <Suspense>
      <StaffMessages />
    </Suspense>
  );
}

/**
 * Split view: threads on the left (designers: theirs; managers: everyone's), the open thread on the right.
 * From lg up it fills the screen (data-fill-viewport) so the thread scrolls inside itself like a
 * messenger. Below lg there is room for one pane: an open thread replaces the list, gets a way back
 * to it, and sits in a one-screen box (data-thread-box) that ThreadView scrolls into view.
 */
function StaffMessages() {
  const { salon, members, me, isManager } = useSalon();
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("c");
  const [designerFilter, setDesignerFilter] = useState("");
  const queryClient = useQueryClient();
  const designers = members.filter((m) => m.roles.includes("DESIGNER"));

  const convs = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "conversations", designerFilter],
    queryFn: () => api<StaffConversation[]>(`/salons/${salon.id}/conversations${designerFilter ? `?designerId=${designerFilter}` : ""}`),
    refetchInterval: 15_000,
  });
  const thread = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "conversations", "thread", open],
    queryFn: () => api<Thread>(`/salons/${salon.id}/conversations/${open}`),
    enabled: Boolean(open),
    refetchInterval: 5_000,
  });
  const current = convs.data?.find((c) => c.id === open);

  const send = useMutation({
    mutationFn: (body: string) => api<Message>(`/salons/${salon.id}/conversations/${open}/messages`, { method: "POST", json: { body } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...salonKeys.salon(salon.id), "conversations"] }),
  });

  return (
    <div data-fill-viewport className="grid gap-4 lg:h-full lg:min-h-0 lg:grid-cols-[320px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
      <aside className={cn("min-h-0 flex-col gap-3", open ? "hidden lg:flex" : "flex")}>
        {isManager && designers.length > 1 && (
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={designerFilter}
            onChange={(e) => setDesignerFilter(e.target.value)}
          >
            <option value="">All team members</option>
            {designers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.displayName}
              </option>
            ))}
          </select>
        )}
        {convs.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {convs.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No conversations yet. Start one from a customer’s page under{" "}
            <Link href={`/s/${salon.id}/customers`} className="underline">
              Customers
            </Link>
            .
          </p>
        )}
        <ul className="min-h-0 divide-y overflow-y-auto rounded-xl border bg-card">
          {convs.data?.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => router.replace(`/s/${salon.id}/messages?c=${c.id}`)}
                className={cn("grid w-full gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent", c.id === open && "bg-accent")}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {c.customer.name}
                  {c.unread > 0 && <Badge>{c.unread}</Badge>}
                </span>
                <span className="text-xs text-muted-foreground">
                  {isManager ? `with ${c.designer.displayName} · ` : ""}
                  {c.lastMessage ? c.lastMessage.body : "No messages yet"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section className={cn("min-h-0 flex-col gap-3", open ? "flex" : "hidden lg:flex")}>
        {!open && <p className="text-sm text-muted-foreground">Select a conversation.</p>}
        {open && (
          <div className="flex shrink-0 items-center justify-between gap-3 text-sm lg:hidden">
            <button type="button" onClick={() => router.replace(`/s/${salon.id}/messages`)} className="text-muted-foreground underline">
              ← All conversations
            </button>
            {/* The card's description (which carries this link) is hidden on phones to give the thread room. */}
            {current && (
              <Link href={`/s/${salon.id}/customers?c=${current.customer.id}`} className="underline md:hidden">
                Customer record
              </Link>
            )}
          </div>
        )}
        {open && (
          <Card data-thread-box className="h-[calc(100dvh-3rem)] lg:h-auto lg:min-h-0 lg:flex-1">
            <CardHeader className="shrink-0">
              <CardTitle>{current?.customer.name ?? "Conversation"}</CardTitle>
              <CardDescription className="hidden md:block">
                {current && (
                  <>
                    Thread with {current.designer.displayName}.{" "}
                    {current.designer.id !== me?.id && isManager && "Your replies appear to the customer as " + current.designer.displayName + "."}
                    {" "}
                    <Link href={`/s/${salon.id}/customers?c=${current.customer.id}`} className="underline">
                      Open customer record
                    </Link>
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              {thread.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
              {thread.isError && <p className="text-sm text-destructive">You don’t have access to this conversation.</p>}
              {thread.data && (
                <ThreadView
                  messages={thread.data.messages}
                  viewer="staff"
                  sendingAs={current?.designer.displayName}
                  onSend={(body) => send.mutate(body)}
                  sending={send.isPending}
                  error={send.error instanceof ApiError ? send.error.message : undefined}
                />
              )}
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
