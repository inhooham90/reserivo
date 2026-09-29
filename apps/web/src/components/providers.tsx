"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";
import { isSetupKey } from "@/lib/salon-context";

export function Providers({ children }: { children: ReactNode }) {
  // One client per browser session; created lazily so SSR never shares it.
  const [queryClient] = useState(() => {
    const client: QueryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
      },
      mutationCache: new MutationCache({
        // Nearly any save can finish a setup step (hours, services, a bio, an
        // invitation), so the guide re-reads after every one rather than each
        // settings pane having to know the guide exists. It is one small GET.
        onSuccess: () => client.invalidateQueries({ predicate: (q) => isSetupKey(q.queryKey) }),
      }),
    });
    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
