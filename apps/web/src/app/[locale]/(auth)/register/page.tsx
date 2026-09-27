"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { registerSchema, type RegisterInput } from "@reserivo/shared";
import { Link, useRouter } from "@/i18n/navigation";
import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { AuthCard, authLink, pillButton, pillInput } from "@/components/auth/auth-card";
import { PasswordInput } from "@/components/auth/password-input";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { useAuth, useRedirectIfSignedIn } from "@/lib/auth";
import { useNextPath } from "@/lib/use-next-path";

function RegisterForm() {
  const { register } = useAuth();
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const router = useRouter();
  const nextPath = useNextPath();
  const status = useRedirectIfSignedIn(nextPath);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await register(values);
      router.replace(nextPath);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : common("somethingWrong"));
    }
  });

  // Signed in already: the hook above is on its way to the dashboard.
  if (status === "authenticated") return null;

  return (
    <AuthCard title={t("register.title")} description={t("register.description")}>
      <form onSubmit={onSubmit} className="grid gap-6" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="name">{t("register.name")}</Label>
          <Input id="name" autoComplete="name" className={pillInput} {...form.register("name")} />
          <FieldError message={form.formState.errors.name?.message} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">{t("email")}</Label>
          <Input id="email" type="email" autoComplete="email" className={pillInput} {...form.register("email")} />
          <FieldError message={form.formState.errors.email?.message} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <PasswordInput id="password" autoComplete="new-password" {...form.register("password")} />
          <FieldError message={form.formState.errors.password?.message} />
        </div>
        <FieldError message={serverError ?? undefined} />
        <Button type="submit" className={pillButton} disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t("register.submitting") : t("register.submit")}
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-body">
        {t.rich("register.haveAccount", {
          link: (chunks) => (
            <Link href="/login" className={authLink}>
              {chunks}
            </Link>
          ),
        })}
      </p>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
