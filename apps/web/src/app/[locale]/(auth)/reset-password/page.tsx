"use client";

import { passwordSchema, type AuthResponse } from "@reserivo/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const { acceptSession } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    try {
      const result = await api<AuthResponse>("/auth/reset-password", { method: "POST", json: { token, password } });
      // The reset signed us in and ended every other session; land on the app.
      acceptSession(result);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setBusy(false);
    }
  };

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>This also signs out anywhere else you’re logged in.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="grid gap-3 text-sm">
              <p className="text-destructive">This link is missing its token. Request a new one.</p>
              <Link href="/forgot-password" className="underline">
                Send another link
              </Link>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="rp-password">New password</Label>
                <Input
                  id="rp-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <FieldError message={error ?? undefined} />
              </div>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Set new password"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/forgot-password" className="underline">
                  Link expired? Send another
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
