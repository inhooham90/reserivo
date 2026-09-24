"use client";

import type { AuthResponse } from "@reserivo/shared";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("auth.verify");
  const common = useTranslations("common");

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
            {verify.isSuccess ? t("confirmed") : verify.isError || !token ? t("failed") : t("confirming")}
          </CardTitle>
          <CardDescription>
            {verify.isSuccess
              ? t("confirmedBody")
              : verify.isError || !token
                ? t("failedBody")
                : t("oneMoment")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          {verify.isError && (
            <p className="text-destructive">
              {verify.error instanceof ApiError ? verify.error.message : common("somethingWrong")}
            </p>
          )}
          {verify.isSuccess ? (
            <div className="flex gap-2">
              <Button nativeButton={false} render={<Link href="/appointments" />}>
                {t("seeAppointments")}
              </Button>
            </div>
          ) : (
            (verify.isError || !token) && (
              <p className="text-muted-foreground">
                {t.rich("freshOne", {
                  link: (chunks) => (
                    <Link href="/login" className="underline">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            )
          )}
        </CardContent>
      </Card>
    </main>
  );
}
