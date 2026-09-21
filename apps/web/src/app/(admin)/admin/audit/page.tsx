"use client";

import type { AuditPage } from "@reserivo/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

export default function AuditLogPage() {
  return (
    <Suspense>
      <AuditLog />
    </Suspense>
  );
}

/** Who did what, and — when someone was acting as another user — who really did it. */
function AuditLog() {
  const params = useSearchParams();
  const salonId = params.get("salonId") ?? "";
  const [entityType, setEntityType] = useState("");
  const [impersonatedOnly, setImpersonatedOnly] = useState(false);

  const log = useInfiniteQuery({
    queryKey: ["admin", "audit", salonId, entityType, impersonatedOnly],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams({ limit: "50" });
      if (salonId) qs.set("salonId", salonId);
      if (entityType) qs.set("entityType", entityType);
      if (impersonatedOnly) qs.set("impersonatedOnly", "true");
      if (pageParam) qs.set("cursor", pageParam);
      return api<AuditPage>(`/admin/audit?${qs}`);
    },
    getNextPageParam: (last) => last.nextCursor,
  });

  const entries = log.data?.pages.flatMap((p) => p.entries) ?? [];

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-xl">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every change, newest first.{" "}
          {salonId && (
            <>
              Filtered to one salon.{" "}
              <Link href="/admin/audit" className="underline">
                Show all
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="al-entity">Entity</Label>
          <Input
            id="al-entity"
            className="w-48"
            placeholder="salons, appointments…"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value.trim())}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={impersonatedOnly} onChange={(e) => setImpersonatedOnly(e.target.checked)} />
          Acting as someone else only
        </label>
      </div>

      {log.isPending && <p className="text-muted-foreground">Loading…</p>}
      {entries.length === 0 && log.isSuccess && <p className="text-muted-foreground">Nothing recorded yet.</p>}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">When</th>
              <th className="px-4 py-2 font-medium">Who</th>
              <th className="px-4 py-2 font-medium">Action</th>
              <th className="px-4 py-2 font-medium">Where</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id} className={e.impersonated ? "bg-destructive/5" : undefined}>
                <td className="whitespace-nowrap px-4 py-2 align-top text-xs text-muted-foreground">
                  {new Date(e.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </td>
                <td className="px-4 py-2 align-top">
                  {e.actor ? (
                    <Link href={`/admin/users/${e.actor.id}`} className="underline">
                      {e.actor.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {e.impersonated && (
                    <span className="block text-xs text-destructive">acting as {e.impersonated.name}</span>
                  )}
                </td>
                <td className="px-4 py-2 align-top">
                  <span className="font-mono text-xs">{e.action}</span>
                  {e.entityType && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {e.entityType}
                      {e.entityId ? ` · ${e.entityId.slice(0, 8)}` : ""}
                    </span>
                  )}
                  {e.after != null && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-muted-foreground">payload</summary>
                      <pre className="mt-1 max-w-md overflow-x-auto rounded bg-muted p-2 text-[11px]">
                        {JSON.stringify(e.after, null, 2)}
                      </pre>
                    </details>
                  )}
                </td>
                <td className="px-4 py-2 align-top text-xs">
                  {e.salon ? (
                    <Link href={`/admin/salons/${e.salon.id}`} className="underline">
                      {e.salon.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  {e.ip && <span className="block text-muted-foreground">{e.ip}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {log.hasNextPage && (
        <Button variant="outline" className="justify-self-start" disabled={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
          {log.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      )}
      {entries.length > 0 && !log.hasNextPage && <p className="text-xs text-muted-foreground">End of the log.</p>}
      <Badge variant="outline" className="justify-self-start">
        {entries.length} shown
      </Badge>
    </div>
  );
}
