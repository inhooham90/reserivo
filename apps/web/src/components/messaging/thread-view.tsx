"use client";

import type { Message } from "@reserivo/shared";
import { useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

/**
 * A conversation as a column of bubbles plus a composer. Used by both sides of
 * the relay; `viewer` decides which bubbles sit on the right and what the
 * composer promises about identity.
 */
export function ThreadView({
  messages,
  viewer,
  sendingAs,
  onSend,
  sending,
  error,
}: {
  messages: Message[];
  viewer: "customer" | "staff";
  /** Staff only: the display name the customer will see on the reply. */
  sendingAs?: string;
  onSend: (body: string) => void;
  sending: boolean;
  error?: string;
}) {
  const [body, setBody] = useState("");
  const isOwn = (m: Message) => (viewer === "customer" ? m.sender === "CUSTOMER" : m.sender === "STAFF");

  const submit = () => {
    const text = body.trim();
    if (!text || sending) return;
    onSend(text);
    setBody("");
  };

  return (
    <div className="grid gap-4">
      <ol className="grid gap-2">
        {messages.length === 0 && <li className="text-sm text-muted-foreground">No messages yet.</li>}
        {messages.map((m) => (
          <li key={m.id} className={cn("flex", isOwn(m) ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                isOwn(m) ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={cn("mt-1 text-[11px]", isOwn(m) ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {m.fromName}
                {m.writtenBy ? ` · written by ${m.writtenBy}` : ""}
                {" · "}
                {new Date(m.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Textarea
          rows={3}
          placeholder="Write a message…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
          }}
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {viewer === "staff" && sendingAs ? `Sent as ${sendingAs}. ` : ""}
            Ctrl/⌘+Enter to send. Contact details are never shared.
          </p>
          <Button type="submit" size="sm" disabled={sending || !body.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
        <FieldError message={error} />
      </form>
    </div>
  );
}
