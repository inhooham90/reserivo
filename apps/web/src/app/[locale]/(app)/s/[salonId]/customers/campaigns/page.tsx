"use client";

import {
  CAMPAIGN_DAILY_RECIPIENT_CAP,
  type AudiencePreview,
  type Campaign,
  type CreateCampaignInput,
} from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { FieldError } from "@/components/field-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api";
import { useFormat } from "@/lib/use-format";
import { salonKeys, useSalon } from "@/lib/salon-context";

/** How long ago a client last came in. Null is "everyone on the list". */
const WINDOWS = [
  { label: "Everyone", days: null },
  { label: "Visited in the last 3 months", days: 90 },
  { label: "Visited in the last year", days: 365 },
] as const;

export default function CampaignsPage() {
  const { salon, isManager } = useSalon();

  // The API refuses a designer anyway; this keeps them from filling in a form
  // that was never going to send.
  if (!isManager) {
    return <p className="text-sm text-muted-foreground">Only managers can email clients.</p>;
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-1">
        <Link href={`/s/${salon.id}/customers`} className="justify-self-start text-sm text-muted-foreground underline">
          ← Customers
        </Link>
        <h1 className="text-2xl">Email your clients</h1>
        <p className="max-w-prose text-sm text-muted-foreground">
          Goes to clients who have an email address and have not unsubscribed. Every message carries an unsubscribe
          link and our postal address, which the law requires and you cannot remove.
        </p>
      </div>
      <Composer />
      <History />
    </div>
  );
}

function Composer() {
  const { salon } = useSalon();
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("");
  const [days, setDays] = useState<number | null>(null);
  // Sending cannot be undone, so the button asks twice — the same shape the
  // calendar uses for no-show and complete.
  const [confirming, setConfirming] = useState(false);

  const query = new URLSearchParams();
  if (tag) query.set("tag", tag);
  if (days) query.set("visitedWithinDays", String(days));

  const audience = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "campaigns", "audience", tag, days],
    queryFn: () => api<AudiencePreview>(`/salons/${salon.id}/campaigns/audience?${query.toString()}`),
  });

  const send = useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      api<Campaign>(`/salons/${salon.id}/campaigns`, { method: "POST", json: input }),
    onSuccess: () => {
      setSubject("");
      setBody("");
      setConfirming(false);
      void queryClient.invalidateQueries({ queryKey: [...salonKeys.salon(salon.id), "campaigns"] });
    },
  });

  const err = send.error instanceof ApiError ? send.error : null;
  const fieldError = (path: string) => err?.issues.find((i) => i.path === path)?.message;
  const total = audience.data?.total ?? 0;
  const overAllowance = total > (audience.data?.remainingToday ?? 0);
  const ready = subject.trim().length > 0 && body.trim().length > 0 && total > 0 && !overAllowance;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New email</CardTitle>
        <CardDescription>Plain text. Keep it short — people read these on a phone.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirming) {
              setConfirming(true);
              return;
            }
            send.mutate({
              subject: subject.trim(),
              body: body.trim(),
              audience: { ...(tag ? { tag } : {}), ...(days ? { visitedWithinDays: days } : {}) },
            });
          }}
        >
          <div className="grid gap-3">
            <Label>Who it goes to</Label>
            <div className="flex flex-wrap gap-2">
              {WINDOWS.map((w) => (
                <Button
                  key={w.label}
                  type="button"
                  size="sm"
                  variant={days === w.days ? "default" : "outline"}
                  onClick={() => {
                    setDays(w.days);
                    setConfirming(false);
                  }}
                >
                  {w.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cm-tag">Only clients tagged (optional)</Label>
              <Input
                id="cm-tag"
                value={tag}
                placeholder="e.g. vip"
                onChange={(e) => {
                  setTag(e.target.value.trim().toLowerCase());
                  setConfirming(false);
                }}
              />
            </div>
            <p className="text-sm" aria-live="polite">
              {audience.isPending ? (
                <span className="text-muted-foreground">Counting…</span>
              ) : total === 0 ? (
                <span className="text-muted-foreground">Nobody matches that yet.</span>
              ) : (
                <>
                  <span className="font-medium">
                    {total} {total === 1 ? "client" : "clients"}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    — {audience.data?.sampleNames.join(", ")}
                    {total > (audience.data?.sampleNames.length ?? 0) && " and others"}
                  </span>
                </>
              )}
            </p>
            {overAllowance && (
              <p className="text-sm text-destructive">
                Only {audience.data?.remainingToday} of today’s {CAMPAIGN_DAILY_RECIPIENT_CAP} emails are left. Narrow
                the audience or try tomorrow.
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cm-subject">Subject</Label>
            <Input
              id="cm-subject"
              value={subject}
              maxLength={150}
              onChange={(e) => {
                setSubject(e.target.value);
                setConfirming(false);
              }}
            />
            <FieldError message={fieldError("subject")} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cm-body">Message</Label>
            <Textarea
              id="cm-body"
              rows={8}
              value={body}
              maxLength={5000}
              onChange={(e) => {
                setBody(e.target.value);
                setConfirming(false);
              }}
            />
            <FieldError message={fieldError("body")} />
            <p className="text-xs text-muted-foreground">
              An unsubscribe link and our postal address are added to the bottom of every message.
            </p>
          </div>

          {err && !err.issues.length && <FieldError message={err.message} />}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={!ready || send.isPending}>
              {send.isPending ? "Sending…" : confirming ? `Yes — email ${total} ${total === 1 ? "client" : "clients"}` : "Send"}
            </Button>
            {confirming && (
              <Button type="button" variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            )}
            {confirming && <p className="text-sm text-muted-foreground">This cannot be undone.</p>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function History() {
  const { salon } = useSalon();
  const f = useFormat();
  const list = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "campaigns", "list"],
    queryFn: () => api<Campaign[]>(`/salons/${salon.id}/campaigns`),
  });

  if (list.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!list.data?.length) return <p className="text-sm text-muted-foreground">Nothing sent yet.</p>;

  return (
    <section className="grid gap-3">
      <h2 className="text-lg">Sent</h2>
      <ul className="divide-y rounded-xl border bg-card">
        {list.data.map((c) => (
          <li key={c.id} className="grid gap-1 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-medium">{c.subject}</span>
              {c.status !== "SENT" && <Badge variant="outline">Sending…</Badge>}
              {c.failedCount > 0 && <Badge variant="outline">{c.failedCount} failed</Badge>}
            </div>
            <span className="text-xs text-muted-foreground">
              {c.sentCount} of {c.recipientCount} delivered · {f.inTz(c.createdAt, salon.timezone)}
              {c.sentByName && ` · ${c.sentByName}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
