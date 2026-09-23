import { Link } from "@/i18n/navigation";
import { PublicFooter } from "@/components/legal/public-footer";
import { Button } from "@/components/ui/button";
import { LEGAL } from "@/lib/legal";

/**
 * Marketing landing for salon owners. Customers arrive via /{slug} links instead.
 *
 * It says more than a landing page strictly needs because it is also the page
 * a carrier opens when reviewing the A2P 10DLC campaign: a reviewer who cannot
 * tell what the business does, or find the messaging program, rejects the
 * campaign for it (error 30919). Hence the plain description of the service,
 * the text-reminder section linking to /sms, and the operator's legal name and
 * address on the page rather than only inside the legal documents.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col py-16">
      <div className="px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
          Online booking your salon and your stylists will both love.
        </h1>
        <p className="max-w-md text-muted-foreground">
          Give every designer their own schedule and services, keep client contact details private, and manage it all
          from one place.
        </p>
        <div className="flex gap-3">
          <Button nativeButton={false} render={<Link href="/register" />}>Get started</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Sign in
          </Button>
        </div>
      </div>

      <section className="mt-20 grid gap-3">
        <h2 className="text-2xl">What {LEGAL.product} is</h2>
        <p className="leading-relaxed text-muted-foreground">
          {LEGAL.product} is appointment booking software for hair and nail salons in the United States. A salon signs
          up, adds its stylists, services and opening hours, and gets a booking page of its own at{" "}
          <span className="text-foreground">reserivo.com/your-salon</span> to share with clients. Clients book on that
          page — no account needed — and the salon manages the day from one calendar.
        </p>
        <p className="leading-relaxed text-muted-foreground">
          We sell software to salons. We are not a salon, and we do not take a cut of a booking.
        </p>
      </section>

      <section className="mt-14 grid gap-6 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <h3 className="font-medium">A page per salon</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your stylists, your services, your prices and your hours, at an address you can print on a card.
          </p>
        </div>
        <div className="grid gap-1.5">
          <h3 className="font-medium">One calendar</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Every chair on one screen, with double bookings caught before they happen and walk-ins added by hand.
          </p>
        </div>
        <div className="grid gap-1.5">
          <h3 className="font-medium">Clients you keep</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Visit history, notes and tags stay with the salon, and clients message you without either side swapping
            phone numbers.
          </p>
        </div>
      </section>

      <section className="mt-14 grid gap-3">
        <h2 className="text-2xl">Appointment reminders</h2>
        <p className="leading-relaxed text-muted-foreground">
          Every booking gets a confirmation by email straight away, and a reminder before the appointment. A client who
          gives a mobile number while booking can also tick a box to get that reminder as a text message — appointment
          reminders only, never marketing, and never without asking. The whole program, including the exact wording of
          the opt-in, is set out at{" "}
          <Link href="/sms" className="text-foreground underline">
            reserivo.com/sms
          </Link>
          .
        </p>
      </section>

      <section className="mt-14 grid gap-3">
        <h2 className="text-2xl">Who operates {LEGAL.product}</h2>
        <p className="leading-relaxed text-muted-foreground">
          {LEGAL.product} is operated by {LEGAL.legalName}, {LEGAL.address}. Email{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="text-foreground underline">
            {LEGAL.supportEmail}
          </a>{" "}
          with a question about the service, an account or a message you received.
        </p>
      </section>

      </div>
      <div className="mt-20">
        <PublicFooter />
      </div>
    </main>
  );
}
