import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { SmsConsent } from "@/components/booking/sms-consent";
import { LegalPage } from "@/components/legal/legal-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LEGAL } from "@/lib/legal";
import { pillInputSm } from "@/lib/v3";

/** A numbered step: the counter is drawn in a small ink circle. */
const step =
  "relative pl-12 [counter-increment:step] before:absolute before:top-0 before:left-0 before:grid before:size-8 before:place-items-center before:rounded-full before:bg-foreground before:text-sm before:font-semibold before:text-background before:content-[counter(step)]";
/** A sample text, drawn as a received message. */
const bubble =
  "max-w-[46ch] rounded-2xl rounded-bl-sm bg-card px-4 py-3 text-[15px] leading-[1.5] text-foreground shadow-[inset_0_0_0_1px_var(--border)]";

export const metadata: Metadata = {
  title: `Text message program · ${LEGAL.product}`,
  description: `How ${LEGAL.product} text reminders work: who opts in, how, what we send, and how to stop them.`,
};

/**
 * The page a carrier is given as the Call-to-Action URL for A2P 10DLC review.
 *
 * The real opt-in lives on the last step of a business's booking page, which is
 * three clicks into a flow under /{slug} — a reviewer handed the site root
 * cannot find it, which is exactly how the first campaign was rejected. This
 * page is public, needs no account, and shows the same checkbox component the
 * booking form renders, so what a reviewer reads is what a client sees.
 */
export default function SmsPage() {
  return (
    <LegalPage doc="sms" title="Text message program">
      <p>
        {LEGAL.product} is an online booking service for small businesses that take appointments, operated by{" "}
        {LEGAL.legalName}. Businesses use it to publish a booking page; their clients use that page to book
        appointments. Text messages are used for one thing only: reminding a client about an appointment they booked.
      </p>
      <p>
        <strong>We never send marketing, promotional or sales text messages.</strong>
      </p>

      <h2>Who receives messages</h2>
      <p>
        Only a client who booked an appointment with a business on {LEGAL.product}, gave a mobile number while booking,
        and ticked the reminder box described below. There is no other way onto the list: we do not buy, rent or import
        numbers, and a business cannot add a number on a client’s behalf.
      </p>

      <h2>How a client opts in</h2>
      <p>The opt-in is a single unticked checkbox on the last step of a business’s booking page. The full path is:</p>
      <ol className="mt-6 grid gap-4 [counter-reset:step]">
        <li className={step}>
          The client opens the business’s booking page — a public URL of the form{" "}
          <strong>https://morrri.com/&#123;business&#125;</strong>, shared by the business (for example on its own
          website, a business card or a social profile). No account or login is required.
        </li>
        <li className={step}>They choose a team member and a service from the business’s menu.</li>
        <li className={step}>They choose a date and time from the available slots.</li>
        <li className={step}>
          They reach <strong>“Your details”</strong>, the final step, and enter their name and email. A mobile number
          is optional.
        </li>
        <li className={step}>
          Below those fields is the reminder checkbox shown here. It is <strong>never pre-ticked</strong>, and it
          cannot be ticked at all until a mobile number has been entered.
        </li>
        <li className={step}>
          They press <strong>Confirm booking</strong>. The appointment is booked either way — consent is not a
          condition of booking, and nothing about the appointment changes if the box is left unticked.
        </li>
      </ol>

      <h3>The opt-in as the client sees it</h3>
      <p>
        This is the live checkbox component from the booking form, reproduced here with a sample number filled in.
        Nothing on this page submits anything.
      </p>
      <div className="mt-6 grid gap-5 rounded-lg bg-butter p-6 md:p-8">
        <p className="text-base font-semibold text-foreground">Your details</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="demo-email">Email</Label>
            <Input id="demo-email" className={pillInputSm} defaultValue="jane@example.com" readOnly />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="demo-phone">Phone (optional)</Label>
            <Input id="demo-phone" className={pillInputSm} type="tel" defaultValue="+1 212 555 0148" readOnly />
          </div>
        </div>
        <SmsConsent checked={false} hasPhone />
      </div>

      <h2>The consent language, in full</h2>
      <blockquote className="mt-6 rounded-lg bg-lavender px-6 py-5 text-lg leading-[1.6] text-foreground md:px-8 md:py-6">
        “Text me a reminder before my appointment. {LEGAL.product} appointment reminders only, never marketing. 1–2
        messages per appointment. Message and data rates may apply. Reply STOP to unsubscribe, HELP for help. See our
        Terms and Privacy Policy.”
      </blockquote>
      <p>
        “Terms” and “Privacy Policy” are links to{" "}
        <Link href="/terms" className="underline">
          morrri.com/terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline">
          morrri.com/privacy
        </Link>
        .
      </p>

      <h2>What we send</h2>
      <p>
        Appointment reminders only, sent by the business the client booked with. One to two messages per appointment,
        typically one the day before and, if the business has chosen it, one a couple of hours ahead. Messages are only
        ever sent in connection with an appointment the recipient booked themselves; there is no recurring or ongoing
        campaign.
      </p>
      <p>Sample messages, exactly as sent:</p>
      <div className="mt-4 rounded-lg bg-muted p-5 md:p-6">
        <ul className="grid gap-3">
        <li className={bubble}>
          Glow Salon (via Morrri): reminder, your Women’s Cut with Mia is tomorrow (Thu 2:30 PM). Reply STOP to opt out.
        </li>
        <li className={bubble}>
          Glow Salon (via Morrri): reminder, your Balayage with Mia is in 2h (Thu 2:30 PM). Reply STOP to opt out.
        </li>
      </ul>
      </div>

      <h2>Frequency, rates, and how to stop</h2>
      <ul>
        <li>Message frequency: 1–2 messages per appointment booked.</li>
        <li>Message and data rates may apply.</li>
        <li>
          Reply <strong>STOP</strong> to any message to end them immediately. Replying STOP also clears the stored
          consent on the client’s record, so nothing further is queued against it.
        </li>
        <li>
          Reply <strong>HELP</strong> for help, or email{" "}
          <a href={`mailto:${LEGAL.supportEmail}`} className="underline">
            {LEGAL.supportEmail}
          </a>
          .
        </li>
        <li>A client can also untick the reminder box the next time they book, or ask the business directly.</li>
      </ul>

      <h2>How the number is handled</h2>
      <p>
        <strong>
          We do not sell, rent or share mobile numbers, or the fact that a client consented to messages, with third
          parties for their own marketing.
        </strong>{" "}
        A number is passed to our messaging provider for the sole purpose of delivering the reminders the client asked
        for. The date and time of consent are recorded against the client’s record at that business. The full detail
        is in the{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>{" "}
        under “Text messages”.
      </p>
    </LegalPage>
  );
}
