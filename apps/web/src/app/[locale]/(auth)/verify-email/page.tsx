"use client";

import type { AuthResponse } from "@reserivo/shared";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}

/** Landing for the emailed confirmation link. Confirms on arrival and signs them in. */
function VerifyEmail() {
  const token = useSearchParams().get("token") ?? "";
  const { acceptSession } = useAuth();

  const verify = useMutation({
    mutationFn: () => api<AuthResponse>("/auth/verify-email", { method: "POST", json: { token } }),
    onSuccess: (result) => acceptSession(result),
  });

  // Fire once on arrival; mutate is stable and the guard keeps Strict Mode's
  // double-invoke from spending the single-use token twice.
  const { mutate, isIdle } = verify;
  useEffect(() => {
    if (token && isIdle) mutate();
  }, [token, isIdle, mutate]);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            {verify.isSuccess ? "Email confirmed" : verify.isError || !token ? "That link didn’t work" : "Confirming your email…"}
          </CardTitle>
          <CardDescription>
            {verify.isSuccess
              ? "Any bookings you made as a guest with this address are now on your account."
              : verify.isError || !token
                ? "Confirmation links work once and expire after a day."
                : "One moment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {verify.isError && (
            <p className="text-destructive">
              {verify.error instanceof ApiError ? verify.error.message : "Something went wrong."}
            </p>
          )}
          {verify.isSuccess ? (
            <div className="flex gap-2">
              <Button nativeButton={false} render={<Link href="/appointments" />}>
                See my appointments
              </Button>
            </div>
          ) : (
            (verify.isError || !token) && (
              <p className="text-muted-foreground">
                Sign in and we’ll offer to send a fresh one.{" "}
                <Link href="/login" className="underline">
                  Sign in
                </Link>
              </p>
            )
          )}
        </CardContent>
      </Card>
    </main>
  );
}
