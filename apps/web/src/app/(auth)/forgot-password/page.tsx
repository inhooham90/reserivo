"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@reserivo/shared";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await api<void>("/auth/forgot-password", { method: "POST", json: values });
      setSent(true);
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  });

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            {sent ? "Check your inbox." : "We’ll email you a link to choose a new one."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            // Deliberately the same message whether or not the address exists.
            <div className="grid gap-3 text-sm">
              <p>If there’s an account for that address, a link is on its way. It works once and expires in an hour.</p>
              <Link href="/login" className="underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <div className="grid gap-1.5">
                <Label htmlFor="fp-email">Email</Label>
                <Input id="fp-email" type="email" autoComplete="email" {...form.register("email")} />
                <FieldError message={form.formState.errors.email?.message} />
              </div>
              <FieldError message={serverError ?? undefined} />
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Sending…" : "Email me a link"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                <Link href="/login" className="underline">
                  Back to sign in
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
