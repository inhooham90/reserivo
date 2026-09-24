"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@reserivo/shared";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("forgot.title")}</CardTitle>
          <CardDescription>
            {sent ? t("forgot.checkInbox") : t("forgot.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            // Deliberately the same message whether or not the address exists.
            <div className="grid gap-3 text-sm">
              <p>{t("forgot.sent")}</p>
              <Link href="/login" className="underline">
                {t("forgot.back")}
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <div className="grid gap-1.5">
                <Label htmlFor="fp-email">{t("email")}</Label>
                <Input id="fp-email" type="email" autoComplete="email" {...form.register("email")} />
                <FieldError message={form.formState.errors.email?.message} />
              </div>
              <FieldError message={serverError ?? undefined} />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t("forgot.submitting") : t("forgot.submit")}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="underline">
                  {t("forgot.back")}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
