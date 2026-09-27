"use client";

import { passwordSchema, type AuthResponse } from "@reserivo/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";
import { AuthCard, authLink, pillButton } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
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
  const t = useTranslations("auth.reset");
  const common = useTranslations("common");
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
      setError(err instanceof ApiError ? err.message : common("somethingWrong"));
      setBusy(false);
    }
  };

  return (
    <AuthCard title={t("title")} description={t("description")}>
      {!token ? (
        <div className="grid gap-6">
          <p className="text-base text-destructive">{t("missingToken")}</p>
          <p>
            <Link href="/forgot-password" className={authLink}>
              {t("sendAnother")}
            </Link>
          </p>
        </div>
      ) : (
        <form
          className="grid gap-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="rp-password">{t("newPassword")}</Label>
            <PasswordInput
              id="rp-password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldError message={error ?? undefined} />
          </div>
          <Button type="submit" className={pillButton} disabled={busy}>
            {busy ? t("submitting") : t("submit")}
          </Button>
          <p className="text-center">
            <Link href="/forgot-password" className={authLink}>
              {t("expired")}
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
