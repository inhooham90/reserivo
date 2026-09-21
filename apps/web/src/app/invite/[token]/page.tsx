"use client";

import type { AcceptInvitationResponse, InvitationPreview } from "@reserivo/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { rolesLabel } from "@/lib/format";

/** Landing for an invite link. Public to read; accepting needs a session with the invited email. */
export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { status, user } = useAuth();
  const router = useRouter();
  const next = encodeURIComponent(`/invite/${token}`);

  const preview = useQuery({
    queryKey: ["invite", token],
    queryFn: () => api<InvitationPreview>(`/invitations/${token}`),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () => api<AcceptInvitationResponse>(`/invitations/${token}/accept`, { method: "POST" }),
    onSuccess: (r) => router.replace(`/s/${r.salonId}`),
  });

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md">
        {preview.isPending && <CardContent className="text-muted-foreground">Loading…</CardContent>}
        {preview.isError && (
          <CardHeader>
            <CardTitle>This invite is not available</CardTitle>
            <CardDescription>
              {preview.error instanceof ApiError ? preview.error.message : "The link may be wrong, used, or expired."}
            </CardDescription>
          </CardHeader>
        )}
        {preview.data && (
          <>
            <CardHeader>
              <CardTitle>Join {preview.data.salonName}</CardTitle>
              <CardDescription>
                You have been invited as {rolesLabel(preview.data.roles).toLowerCase()}. This invite is for{" "}
                <span className="font-medium text-foreground">{preview.data.email}</span>.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {status === "loading" && <p className="text-sm text-muted-foreground">Checking your session…</p>}
              {status === "anonymous" && (
                <div className="flex gap-2">
                  <Button nativeButton={false} render={<Link href={`/login?next=${next}`} />}>
                    Sign in to accept
                  </Button>
                  <Button variant="outline" nativeButton={false} render={<Link href={`/register?next=${next}`} />}>
                    Create account
                  </Button>
                </div>
              )}
              {status === "authenticated" && user && (
                <>
                  {user.email !== preview.data.email && (
                    <p className="text-sm text-muted-foreground">
                      You are signed in as {user.email}. Sign in with the invited email to accept.
                    </p>
                  )}
                  <FieldError message={accept.error instanceof ApiError ? accept.error.message : undefined} />
                  <Button onClick={() => accept.mutate()} disabled={accept.isPending || user.email !== preview.data.email}>
                    {accept.isPending ? "Joining…" : `Join as ${user.name}`}
                  </Button>
                </>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </main>
  );
}
