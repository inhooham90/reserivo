"use client";

import { liveEventSchema, type UnreadCounts } from "@reserivo/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_URL, api, getAccessToken, refresh } from "@/lib/api";

export const unreadKey = ["me", "unread"] as const;

/** Unread badge counts. Live events refresh it; the slow poll only catches a dropped stream. */
export function useUnread(enabled = true) {
  return useQuery({
    queryKey: unreadKey,
    queryFn: () => api<UnreadCounts>("/me/unread"),
    enabled,
    refetchInterval: 60_000,
  });
}

/**
 * Holds the live stream open while the person is signed in, and turns each
 * event into a refetch of whatever it touches: the badge, the inbox list and
 * any open thread (whose refetch also marks it read, since it is on screen).
 *
 * fetch, not EventSource: EventSource cannot send an Authorization header,
 * and the access token lives only in memory. A 401 means the token expired,
 * so it refreshes and reconnects; anything else reconnects with backoff.
 */
export function useLiveUpdates(enabled: boolean) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    let attempt = 0;

    const onEvent = (raw: string) => {
      const parsed = liveEventSchema.safeParse(JSON.parse(raw));
      if (!parsed.success || parsed.data.type !== "message") return;
      const { salonId } = parsed.data;
      void queryClient.invalidateQueries({ queryKey: unreadKey });
      void queryClient.invalidateQueries({ queryKey: ["me", "conversations"] });
      if (salonId) void queryClient.invalidateQueries({ queryKey: ["salons", salonId, "conversations"] });
    };

    const connect = async (): Promise<void> => {
      while (!abort.signal.aborted) {
        try {
          const res = await fetch(`${API_URL}/me/events`, {
            headers: { Authorization: `Bearer ${getAccessToken() ?? ""}`, Accept: "text/event-stream" },
            credentials: "include",
            signal: abort.signal,
          });
          if (res.status === 401) {
            if (!(await refresh())) return; // Signed out; the app shell handles that.
            continue;
          }
          if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
          attempt = 0;
          // Anything that arrived while disconnected is picked up by refetching once.
          void queryClient.invalidateQueries({ queryKey: unreadKey });

          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let buffer = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += value;
            // Events are separated by a blank line; only `data:` lines matter here.
            let cut: number;
            while ((cut = buffer.indexOf("\n\n")) >= 0) {
              const block = buffer.slice(0, cut);
              buffer = buffer.slice(cut + 2);
              const data = block
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trimStart())
                .join("\n");
              if (data) {
                try {
                  onEvent(data);
                } catch {
                  // A malformed event is ignored, never fatal to the stream.
                }
              }
            }
          }
        } catch {
          if (abort.signal.aborted) return;
        }
        // Closed or failed: wait 1s, 2s, 4s… up to 30s, then try again.
        attempt += 1;
        await new Promise((r) => setTimeout(r, Math.min(30_000, 1_000 * 2 ** (attempt - 1))));
      }
    };

    void connect();
    return () => abort.abort();
  }, [enabled, queryClient]);
}
