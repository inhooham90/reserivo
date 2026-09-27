"use client";

import type { AuthResponse } from "@reserivo/shared";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useEffect } from "react";
import { AuthCard, authLink, pillButton } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
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

  const failed = verify.isError || !token;

  return (
    <AuthCard
      title={verify.isSuccess ? t("confirmed") : failed ? t("failed") : t("confirming")}
      description={verify.isSuccess ? t("confirmedBody") : failed ? t("failedBody") : t("oneMoment")}
    >
      <div className="grid gap-6 text-base">
        {verify.isError && (
          <p className="text-destructive">
            {verify.error instanceof ApiError ? verify.error.message : common("somethingWrong")}
          </p>
        )}
        {verify.isSuccess ? (
          <div>
            <Button nativeButton={false} className={pillButton} render={<Link href="/appointments" />}>
              {t("seeAppointments")}
            </Button>
          </div>
        ) : (
          failed && (
            <p className="text-body">
              {t.rich("freshOne", {
                link: (chunks) => (
                  <Link href="/login" className={authLink}>
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          )
        )}
      </div>
    </AuthCard>
  );
}
