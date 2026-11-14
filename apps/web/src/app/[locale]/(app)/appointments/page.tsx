"use client";

import type { CustomerAppointment, Thread } from "@reserivo/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { BusinessContact } from "@/components/business-contact";
import { FieldError } from "@/components/field-error";
import { RateDesigner } from "@/components/rating/rate-designer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useFormat } from "@/lib/use-format";
import { cn } from "cn";

/**
 * The customer's own bookings across every business. Each one opens to show
 * the details and how to reach the business, because changing a time means
 * contacting them: there is self-service cancel inside the window, but no
 * self-service reschedule.
 */
export default function MyAppointmentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const message = useMutation({
    mutationFn: (a: CustomerAppointment) =>
      api<Thread>("/me/conversations", { method: "POST", json: { salonId: a.salon.id, designerId: a.designerId } }),
    onSuccess: (t) => router.push(`/messages/${t.conversationId}`),
  });
  const appts = useQuery({ queryKey: ["me", "appointments"], queryFn: () => api<CustomerAppointment[]>("/me/appointments") });
  const cancel = useMutation({
    mutationFn: (id: string) => api<CustomerAppointment>(`/me/appointments/${id}/cancel`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me", "appointments"] }),
  });
  const [open, setOpen] = useState<string | null>(null);

  // Captured once per mount: "upcoming" must not flip mid-render as the clock ticks.
  const [now] = useState(() => Date.now());
  const upcoming = appts.data?.filter((a) => new Date(a.startAt).getTime() >= now && a.status !== "CANCELLED") ?? [];
  const past = appts.data?.filter((a) => !upcoming.includes(a)) ?? [];
  const unverified = user ? !user.emailVerified : false;

  const row = (a: CustomerAppointment, isPast: boolean) => (
    <Reservation
      key={a.id}
      appt={a}
      past={isPast}
      open={open === a.id}
      onToggle={() => setOpen(open === a.id ? null : a.id)}
      onMessage={() => message.mutate(a)}
      messaging={message.isPending}
      onCancel={() => {
        if (confirm("Cancel this appointment?")) cancel.mutate(a.id);
      }}
      cancelling={cancel.isPending && cancel.variables === a.id}
      cancelError={
        cancel.isError && cancel.variables === a.id
          ? cancel.error instanceof ApiError
            ? cancel.error.message
            : "Could not cancel"
          : undefined
      }
    />
  );

  return (
    <div className="grid gap-8">
      {unverified && user && <ConfirmEmailNotice email={user.email} />}

      <section className="grid gap-3">
        <h1 className="text-xl">Upcoming</h1>
        {appts.isPending && <p className="text-muted-foreground">Loading…</p>}
        {appts.data && upcoming.length === 0 && (
          <p className="text-muted-foreground">
            {unverified
              ? "Nothing to show yet. Bookings made with your email appear here once you confirm it."
              : "Nothing booked. Open a business’s booking link to make an appointment, or "}
            {!unverified && (
              <>
                <Link href="/settings" className="underline">
                  set up your own business
                </Link>
                .
              </>
            )}
          </p>
        )}
        {upcoming.map((a) => row(a, false))}
      </section>

      {past.length > 0 && (
        <section className="grid gap-3">
          <h2 className="text-lg text-muted-foreground">Past</h2>
          {past.map((a) => row(a, true))}
        </section>
      )}
    </div>
  );
}

/**
 * Until the address is confirmed, nothing is matched to the account by email
 * (see ownedBy() in the API), so bookings made as a guest, or before signing
 * up, stay hidden. Saying so here, where people look for them, keeps it from
 * reading as lost bookings.
 */
function ConfirmEmailNotice({ email }: { email: string }) {
  const resend = useMutation({ mutationFn: () => api<void>("/auth/verify-email/resend", { method: "POST" }) });
  return (
    <section data-component="ConfirmEmailNotice" aria-labelledby="confirm-title" className="grid gap-2 rounded-lg bg-butter p-5">
      <h2 id="confirm-title" className="font-sans text-base font-semibold tracking-normal">
        Confirm your email to see all your bookings
      </h2>
      <p className="text-sm text-body">
        Bookings made with <span className="font-medium text-foreground">{email}</span> appear here once you confirm that
        address. Check your inbox for the link we sent.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" disabled={resend.isPending || resend.isSuccess} onClick={() => resend.mutate()}>
          {resend.isPending ? "Sending…" : resend.isSuccess ? "Sent. Check your inbox." : "Send the link again"}
        </Button>
        <FieldError message={resend.error instanceof ApiError ? resend.error.message : undefined} />
      </div>
    </section>
  );
}

function Reservation({
  appt: a,
  past,
  open,
  onToggle,
  onMessage,
  messaging,
  onCancel,
  cancelling,
  cancelError,
}: {
  appt: CustomerAppointment;
  past: boolean;
  open: boolean;
  onToggle: () => void;
  onMessage: () => void;
  messaging: boolean;
  onCancel: () => void;
  cancelling: boolean;
  cancelError?: string;
}) {
  const f = useFormat();
  const detailsId = `appt-${a.id}`;
  const hasContact = Boolean(a.salon.phone || a.salon.address);

  return (
    <article data-component="Reservation" className={cn("rounded-lg border bg-card", open && "shadow-sm")}>
      {/* The whole summary is the toggle: "click the reservation" is what people try first. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring"
      >
        <span className="grid gap-0.5">
          <span className={cn("font-medium", !past && "text-lg")}>
            {f.inTz(a.startAt, a.salon.timezone, past ? "dateTimeWithYear" : "dateTimeLong")}
          </span>
          <span className="text-sm text-muted-foreground">
            {a.serviceName} with {a.designerName} · {a.salon.name}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {(past || a.status !== "CONFIRMED") && <Badge variant="outline">{f.status(a.status)}</Badge>}
          <ChevronDown aria-hidden className={cn("size-5 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div id={detailsId} className="grid gap-5 border-t px-4 py-4 md:grid-cols-2">
          <dl className="grid content-start gap-2 text-sm">
            <Detail label="Service">{a.serviceName}</Detail>
            <Detail label="With">{a.designerName}</Detail>
            <Detail label="Price">{f.cents(a.priceCents)} · pay at the business</Detail>
            {!past && (
              <Detail label="Cancelling">
                {a.cancellableUntil
                  ? `Free online until ${f.inTz(a.cancellableUntil, a.salon.timezone)}`
                  : "Too close to the time to cancel online. Contact the business."}
              </Detail>
            )}
            {a.notes && <Detail label="Your note">{a.notes}</Detail>}
          </dl>

          <div className="grid content-start gap-2 text-sm">
            <p className="font-medium">
              <Link href={`/${a.salon.slug}`} className="underline underline-offset-4">
                {a.salon.name}
              </Link>
            </p>
            {hasContact ? (
              <>
                {!past && <p className="text-muted-foreground">To change the time, call or visit the business.</p>}
                <BusinessContact phone={a.salon.phone} address={a.salon.address} />
              </>
            ) : (
              <p className="text-muted-foreground">This business hasn’t added a phone number or address. Send them a message instead.</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-2">
            {past && a.status === "COMPLETED" && <RateDesigner designerId={a.designerId} designerName={a.designerName} />}
            <Button size="sm" variant="secondary" disabled={messaging} onClick={onMessage}>
              {/* Full name on purpose: a given name cannot be split off reliably — Korean and
                  Chinese names are not space-separated, so .split(" ")[0] returns the whole name. */}
              Message {a.designerName}
            </Button>
            {past && (
              <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/${a.salon.slug}`} />}>
                Book again
              </Button>
            )}
            {!past && a.cancellableUntil && (
              <Button size="sm" variant="outline" disabled={cancelling} onClick={onCancel}>
                Cancel appointment
              </Button>
            )}
          </div>
          {cancelError && (
            <div className="md:col-span-2">
              <FieldError message={cancelError} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
