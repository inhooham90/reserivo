"use client";

import type { CustomerConversation, Message, Thread } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { ThreadView } from "@/components/messaging/thread-view";
import { api, ApiError } from "@/lib/api";

export default function ConversationPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const queryClient = useQueryClient();

  const thread = useQuery({
    queryKey: ["me", "conversations", conversationId],
    queryFn: () => api<Thread>(`/me/conversations/${conversationId}`),
    refetchInterval: 5_000,
  });
  const convs = useQuery({ queryKey: ["me", "conversations"], queryFn: () => api<CustomerConversation[]>("/me/conversations") });
  const meta = convs.data?.find((c) => c.id === conversationId);

  const send = useMutation({
    mutationFn: (body: string) => api<Message>(`/me/conversations/${conversationId}/messages`, { method: "POST", json: { body } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me", "conversations"] });
    },
  });

  return (
    // Fills the screen from lg up; below it the thread gets a one-screen box scrolled into view (see ThreadView).
    <div data-fill-viewport className="mx-auto flex w-full max-w-2xl flex-col gap-4 lg:min-h-0 lg:flex-1">
      <div className="shrink-0">
        <Link href="/messages" className="text-sm text-muted-foreground underline">
          ← All messages
        </Link>
        <h1 className="mt-2 text-xl">{meta ? `${meta.designer.displayName} · ${meta.salon.name}` : "Conversation"}</h1>
      </div>
      {thread.isPending && <p className="text-muted-foreground">Loading…</p>}
      {thread.isError && <p className="text-destructive">This conversation is not available.</p>}
      {thread.data && (
        <div data-thread-box className="flex h-[calc(100dvh-3rem)] flex-col lg:h-auto lg:min-h-0 lg:flex-1">
          <ThreadView
            messages={thread.data.messages}
            viewer="customer"
            onSend={(body) => send.mutate(body)}
            sending={send.isPending}
            error={send.error instanceof ApiError ? send.error.message : undefined}
          />
        </div>
      )}
    </div>
  );
}
