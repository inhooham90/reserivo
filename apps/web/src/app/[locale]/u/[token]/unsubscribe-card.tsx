"use client";

import type { UnsubscribeScope, UnsubscribeState } from "@reserivo/shared";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { FieldError } from "@/components/field-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api, ApiError } from "@/lib/api";
import { LEGAL } from "@/lib/legal";
import { cn } from "cn";

type Choice = Exclude<UnsubscribeScope, "NONE">;

/** Narrowest first. Each includes the one before, which is why this is a radio group and not checkboxes. */
const CHOICES: readonly Choice[] = ["SALON", "MARKETING", "ALL"];

/**
 * Unsubscribes from this salon on arrival, then offers to go wider or undo.
 *
 * Acting first is deliberate: somebody who clicked "unsubscribe" has already
 * told us what they want, and making them click again to be heard is the dark
 * pattern this page exists to avoid. The narrowest scope is what is applied,
 * because it is the least anyone could have meant; the wider ones need a
 * second, explicit choice. The undo is there for the accidental click.
 */
export function UnsubscribeCard({ token }: { token: string }) {
  const t = useTranslations("unsubscribe");
  const [choice, setChoice] = useState<Choice>("SALON");

  const arrive = useMutation({
    mutationFn: () => api<UnsubscribeState>(`/public/unsubscribe/${token}`, { method: "POST" }),
    // Reopening an old email lands on whatever was chosen last time, not on the default.
    onSuccess: (s) => s.scope !== "NONE" && setChoice(s.scope),
  });
  const save = useMutation({
    mutationFn: (scope: UnsubscribeScope) =>
      api<UnsubscribeState>(`/public/unsubscribe/${token}/scope`, { method: "POST", json: { scope } }),
  });

  useEffect(() => {
    arrive.mutate();
    // Once, on arrival. The token is the whole identity of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const state = save.data ?? arrive.data;

  if (arrive.error instanceof ApiError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1} className="font-heading text-2xl">{t("expiredTitle")}</CardTitle>
          <CardDescription>{t("expiredBody")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!state) {
    return <p className="text-center text-sm text-muted-foreground">{t("oneMoment")}</p>;
  }

  const vars = { salon: state.salonName, product: LEGAL.product };
  const unchanged = choice === state.scope;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1} className="font-heading text-2xl">{t(`title.${state.scope}`, vars)}</CardTitle>
        <CardDescription>{t(`summary.${state.scope}`, vars)}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(choice);
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-medium">{t("legend")}</legend>
            {CHOICES.map((c) => (
              <label
                key={c}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
                  choice === c ? "border-primary bg-accent/50" : "border-input hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name="scope"
                  value={c}
                  checked={choice === c}
                  onChange={() => setChoice(c)}
                  className="mt-1 accent-primary"
                />
                <span className="grid gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {t(`option.${c}.label`, vars)}
                    {c === "SALON" && <Badge variant="secondary">{t("recommended")}</Badge>}
                  </span>
                  <span className="text-sm text-muted-foreground">{t(`option.${c}.hint`, vars)}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <FieldError message={save.isError ? t("saveFailed") : undefined} />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={unchanged || save.isPending}>
              {save.isPending ? t("saving") : state.scope === "NONE" ? t("unsubscribe") : t("save")}
            </Button>
            {state.scope !== "NONE" && (
              <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => save.mutate("NONE")}>
                {t("undo")}
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
