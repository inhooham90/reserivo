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

/** Split view: threads on the left (designers: theirs; managers: everyone's), the open thread on the right. */
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
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="grid gap-3 self-start">
        {isManager && designers.length > 1 && (
          <select
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            value={designerFilter}
            onChange={(e) => setDesignerFilter(e.target.value)}
          >
            <option value="">All designers</option>
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
        <ul className="divide-y rounded-xl border bg-card">
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

      <section>
        {!open && <p className="text-sm text-muted-foreground">Select a conversation.</p>}
        {open && (
          <Card>
            <CardHeader>
              <CardTitle>{current?.customer.name ?? "Conversation"}</CardTitle>
              <CardDescription>
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
            <CardContent>
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
