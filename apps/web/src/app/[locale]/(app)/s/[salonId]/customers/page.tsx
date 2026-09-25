"use client";

import type { Customer, CustomerDetail, Thread, UpdateCustomerInput } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Link, useRouter } from "@/i18n/navigation";
import { Suspense, useState } from "react";
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
import { cn } from "cn";

export default function CustomersPage() {
  return (
    <Suspense>
      <Customers />
    </Suspense>
  );
}

/** The salon's CRM: search on the left, one customer's record on the right. */
function Customers() {
  const { salon, isManager } = useSalon();
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get("c");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");

  const list = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "customers", "list", q, tag],
    queryFn: () => api<Customer[]>(`/salons/${salon.id}/customers?q=${encodeURIComponent(q)}${tag ? `&tag=${encodeURIComponent(tag)}` : ""}&limit=100`),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <aside className="grid gap-3 self-start">
        {/* Managers only: emailing clients needs their addresses, which designers never see. */}
        {isManager && (
          <Button variant="outline" nativeButton={false} render={<Link href={`/s/${salon.id}/customers/campaigns`} />}>
            Email your clients
          </Button>
        )}
        <Input placeholder={isManager ? "Search name, phone or email…" : "Search by name…"} value={q} onChange={(e) => setQ(e.target.value)} />
        <Input placeholder="Filter by tag" value={tag} onChange={(e) => setTag(e.target.value.trim().toLowerCase())} />
        {list.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
        {list.data?.length === 0 && <p className="text-sm text-muted-foreground">No customers match.</p>}
        <ul className="divide-y rounded-xl border bg-card">
          {list.data?.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => router.replace(`/s/${salon.id}/customers?c=${c.id}`)}
                className={cn("grid w-full gap-0.5 px-4 py-3 text-left transition-colors hover:bg-accent", c.id === open && "bg-accent")}
              >
                <span className="text-sm font-medium">{c.name}</span>
                <span className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                  {c.email ?? c.phone ?? (c.hasAccount ? "Has account" : "No account")}
                  {c.tags.map((t) => (
                    <Badge key={t} variant="outline" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>{open ? <CustomerRecord key={open} id={open} /> : <p className="text-sm text-muted-foreground">Select a customer.</p>}</section>
    </div>
  );
}

function CustomerRecord({ id }: { id: string }) {
  const { salon, members, me, isManager } = useSalon();
  const f = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const designers = members.filter((m) => m.roles.includes("DESIGNER"));
  const [designerId, setDesignerId] = useState(me?.roles.includes("DESIGNER") ? me.id : (designers[0]?.id ?? ""));

  const detail = useQuery({
    queryKey: [...salonKeys.salon(salon.id), "customers", id],
    queryFn: () => api<CustomerDetail>(`/salons/${salon.id}/customers/${id}`),
  });

  const save = useMutation({
    mutationFn: (input: UpdateCustomerInput) => api<Customer>(`/salons/${salon.id}/customers/${id}`, { method: "PATCH", json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...salonKeys.salon(salon.id), "customers"] }),
  });

  const message = useMutation({
    mutationFn: () => api<Thread>(`/salons/${salon.id}/conversations`, { method: "POST", json: { customerId: id, designerId } }),
    onSuccess: (t) => router.push(`/s/${salon.id}/messages?c=${t.conversationId}`),
  });

  if (detail.isPending) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (detail.isError) return <p className="text-sm text-destructive">Could not load this customer.</p>;
  const c = detail.data;

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              {c.name}
              {c.hasAccount ? <Badge variant="secondary">Has account</Badge> : <Badge variant="outline">No account</Badge>}
            </CardTitle>
            <CardDescription>
              {isManager ? [c.email, c.phone].filter(Boolean).join(" · ") || "No contact details on file" : "Contact details are visible to managers only."}
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isManager && designers.length > 1 && (
              <select className="h-8 rounded-md border border-input bg-transparent px-2 text-xs" value={designerId} onChange={(e) => setDesignerId(e.target.value)}>
                {designers.map((d) => (
                  <option key={d.id} value={d.id}>
                    as {d.displayName}
                  </option>
                ))}
              </select>
            )}
            <Button size="sm" disabled={!c.hasAccount || !designerId || message.isPending} onClick={() => message.mutate()}>
              Message
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!c.hasAccount && (
            <p className="text-xs text-muted-foreground">
              The relay reaches customers through their Morrri account. This customer hasn’t created one yet.
            </p>
          )}
          <FieldError message={message.error instanceof ApiError ? message.error.message : undefined} />
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Visits" value={String(c.stats.visits)} />
            <Stat label="Spent" value={f.cents(c.stats.spentCents)} />
            <Stat
              label="Avg tip"
              value={c.stats.avgTipPct === null ? "—" : `${c.stats.avgTipPct}%`}
              hint={
                c.stats.tippedVisits === 0
                  ? "No tips recorded"
                  : `${f.cents(c.stats.tipCents)} over ${c.stats.tippedVisits} visit${c.stats.tippedVisits === 1 ? "" : "s"}`
              }
            />
            <Stat label="No-shows" value={String(c.stats.noShows)} />
            <Stat label="Upcoming" value={String(c.stats.upcoming)} />
          </dl>
          <NotesAndTags customer={c} onSave={(input) => save.mutate(input)} saving={save.isPending} error={save.error instanceof ApiError ? save.error.message : undefined} />
          {isManager && <ContactForm customer={c} onSave={(input) => save.mutate(input)} saving={save.isPending} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>
            {c.stats.firstVisitAt ? `Client since ${f.inTz(c.stats.firstVisitAt, salon.timezone, "monthYear")}.` : "No completed visits yet."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {c.history.length === 0 && <p className="text-sm text-muted-foreground">No appointments.</p>}
          <ul className="divide-y text-sm">
            {c.history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{f.inTz(h.startAt, salon.timezone, "dateTimeWithYear")}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {h.serviceName} with {h.designerName} · {f.cents(h.priceCents)}
                    {h.tipCents !== null && ` + ${f.cents(h.tipCents)} tip`}
                  </span>
                </span>
                <Badge variant={h.status === "CONFIRMED" ? "default" : "outline"}>{f.status(h.status)}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg">{value}</dd>
      {/* An average off one visit is noise, so always say what it is built on. */}
      {hint && <dd className="text-xs text-muted-foreground">{hint}</dd>}
    </div>
  );
}

function NotesAndTags({
  customer,
  onSave,
  saving,
  error,
}: {
  customer: CustomerDetail;
  onSave: (input: UpdateCustomerInput) => void;
  saving: boolean;
  error?: string;
}) {
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [tags, setTags] = useState(customer.tags.join(", "));
  const dirty = notes !== (customer.notes ?? "") || tags !== customer.tags.join(", ");

  return (
    <div className="grid gap-3 border-t pt-4">
      <div className="grid gap-1.5">
        <Label htmlFor="cust-notes">Notes</Label>
        <Textarea id="cust-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, preferences, how they take their coffee…" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="cust-tags">Tags</Label>
        <Input id="cust-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="vip, color, referral" />
      </div>
      <FieldError message={error} />
      <Button
        size="sm"
        className="justify-self-start"
        disabled={!dirty || saving}
        onClick={() =>
          onSave({
            notes: notes.trim() || null,
            tags: Array.from(new Set(tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))),
          })
        }
      >
        {saving ? "Saving…" : "Save notes & tags"}
      </Button>
    </div>
  );
}

function ContactForm({ customer, onSave, saving }: { customer: CustomerDetail; onSave: (input: UpdateCustomerInput) => void; saving: boolean }) {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const dirty = name !== customer.name || email !== (customer.email ?? "") || phone !== (customer.phone ?? "");

  return (
    <div className="grid gap-3 border-t pt-4">
      <p className="text-xs text-muted-foreground">Contact details — managers only.</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
      </div>
      <Button
        size="sm"
        variant="outline"
        className="justify-self-start"
        disabled={!dirty || saving}
        onClick={() => onSave({ name: name.trim(), email: email.trim() || null, phone: phone.trim() || null })}
      >
        Save contact details
      </Button>
    </div>
  );
}
