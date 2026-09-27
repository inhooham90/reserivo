"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@reserivo/shared";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { AuthCard, authLink, pillButton, pillInput } from "@/components/auth/auth-card";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api<void>("/auth/forgot-password", { method: "POST", json: values });
      setSent(true);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : common("somethingWrong"));
    }
  });

  return (
    <AuthCard title={t("forgot.title")} description={sent ? t("forgot.checkInbox") : t("forgot.description")}>
      {sent ? (
        // Deliberately the same message whether or not the address exists.
        <div className="grid gap-6">
          <p className="text-base text-body">{t("forgot.sent")}</p>
          <p>
            <Link href="/login" className={authLink}>
              {t("forgot.back")}
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-6" noValidate>
          <div className="grid gap-2">
            <Label htmlFor="fp-email">{t("email")}</Label>
            <Input id="fp-email" type="email" autoComplete="email" className={pillInput} {...form.register("email")} />
            <FieldError message={form.formState.errors.email?.message} />
          </div>
          <FieldError message={serverError ?? undefined} />
          <Button type="submit" className={pillButton} disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t("forgot.submitting") : t("forgot.submit")}
          </Button>
          <p className="text-center">
            <Link href="/login" className={authLink}>
              {t("forgot.back")}
            </Link>
          </p>
        </form>
      )}
    </AuthCard>
  );
}
