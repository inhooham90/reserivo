"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginInput } from "@reserivo/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { LEGAL } from "@/lib/legal";
import { useAuth } from "@/lib/auth";
import { useNextPath } from "@/lib/use-next-path";

function LoginForm() {
  const { login } = useAuth();
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const router = useRouter();
  const nextPath = useNextPath();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await login(values);
      router.replace(nextPath);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : common("somethingWrong"));
    }
  });

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{t("login.title")}</CardTitle>
          <CardDescription>{t("login.description", { product: LEGAL.product })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              <FieldError message={form.formState.errors.email?.message} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
              <FieldError message={form.formState.errors.password?.message} />
            </div>
            <FieldError message={serverError ?? undefined} />
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("login.submitting") : t("login.submit")}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/forgot-password" className="underline">
                {t("login.forgot")}
              </Link>
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {t.rich("login.newHere", {
                link: (chunks) => (
                  <Link href="/register" className="underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
