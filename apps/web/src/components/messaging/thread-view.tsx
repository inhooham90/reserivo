"use client";

import type { Message } from "@reserivo/shared";
import { useLayoutEffect, useRef, useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "cn";

/**
 * A conversation as a column of bubbles plus a composer. Used by both sides of
 * the relay; `viewer` decides which bubbles sit on the right and what the
 * composer promises about identity.
 *
 * Laid out like a messenger: it fills its parent's height, only the bubbles
 * scroll, the composer stays put, and the list stays pinned to the newest
 * message unless the reader has scrolled up into the history. The parent is
 * the screen left under the header from lg up (the page opts in with
 * `data-fill-viewport`); below lg, where the headers stack too tall to leave
 * room, it is a box one screen high that opening the thread scrolls into view.
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

  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);

  // Below lg the page scrolls; bring the one-screen thread box fully into view on open.
  useLayoutEffect(() => {
    if (window.matchMedia("(max-width: 1023.98px)").matches) rootRef.current?.closest("[data-thread-box]")?.scrollIntoView({ block: "end" });
  }, []);
  // Starts true so the first render lands on the latest message.
  const pinned = useRef(true);
  const last = messages.at(-1);
  // Keyed on the newest id, not the array: the 5s poll returns a fresh array
  // with the same messages, and that must not yank someone reading history.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (pinned.current || (last && isOwn(last))) {
      list.scrollTop = list.scrollHeight;
      pinned.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  const submit = () => {
    const text = body.trim();
    if (!text || sending) return;
    onSend(text);
    setBody("");
  };

  return (
    <div ref={rootRef} className="flex min-h-0 flex-1 flex-col gap-4">
      <ol
        ref={listRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        // tabIndex so keyboard users can scroll the history; the label names the region for them.
        tabIndex={0}
        aria-label="Messages"
        className="-mx-1 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-1 outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        {messages.length === 0 && <li className="mt-auto text-sm text-muted-foreground">No messages yet.</li>}
        {messages.map((m, i) => (
          // mt-auto on the first bubble sits a short thread at the bottom, beside the composer, as chat apps do.
          <li key={m.id} className={cn("flex", isOwn(m) ? "justify-end" : "justify-start", i === 0 && "mt-auto")}>
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
        className="grid shrink-0 gap-2"
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
