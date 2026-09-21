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
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <div>
        <Link href="/messages" className="text-sm text-muted-foreground underline">
          ← All messages
        </Link>
        <h1 className="mt-2 text-xl">{meta ? `${meta.designer.displayName} · ${meta.salon.name}` : "Conversation"}</h1>
      </div>
      {thread.isPending && <p className="text-muted-foreground">Loading…</p>}
      {thread.isError && <p className="text-destructive">This conversation is not available.</p>}
      {thread.data && (
        <ThreadView
          messages={thread.data.messages}
          viewer="customer"
          onSend={(body) => send.mutate(body)}
          sending={send.isPending}
          error={send.error instanceof ApiError ? send.error.message : undefined}
        />
      )}
    </div>
  );
}
