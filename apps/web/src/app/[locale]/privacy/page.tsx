import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Privacy Policy · ${LEGAL.product}`,
  description: `How ${LEGAL.product} collects, uses and protects personal information.`,
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {LEGAL.product} is an online booking service for hair and nail salons, operated by {LEGAL.legalName}. This
        policy explains what personal information we handle, why, and what you can do about it.
      </p>

      <h2>Two kinds of people use {LEGAL.product}</h2>
      <p>
        <strong>Salon staff</strong> hold an account with us — managers and designers who run a salon on the platform.
      </p>
      <p>
        <strong>Salon clients</strong> book appointments through a salon’s booking page. If you are a client, the salon
        you booked with decides how your information is used; we hold and process it on their behalf and act on their
        instructions.
      </p>

      <h2>What we collect</h2>
      <h3>From salon staff</h3>
      <ul>
        <li>Name, email address and a password, which is stored only as a cryptographic hash — we never see it</li>
        <li>An optional phone number</li>
        <li>Which salons you work in and your role in each</li>
        <li>IP address and browser details when you sign in or change something, kept as a security and audit record</li>
      </ul>
      <h3>From salon clients</h3>
      <ul>
        <li>Name, email address, and an optional mobile number, given when booking</li>
        <li>Your appointments — times, services and prices</li>
        <li>Notes you add when booking, and notes the salon keeps about you</li>
        <li>Messages exchanged with the salon through {LEGAL.product}</li>
        <li>Star ratings you give a designer after a visit. They are only ever shown as an average, never with your name</li>
        <li>Whether you agreed to text reminders, and when</li>
        <li>
          Whether you unsubscribed from a salon’s emails, from every salon’s promotions, or from all our email, and
          when
        </li>
      </ul>

      <h2>Text messages</h2>
      <h3>How you opt in</h3>
      <p>
        Text reminders are optional and off unless you ask for them. When you book on a salon’s booking page, the last
        step asks for your name, email and — optionally — a mobile number. If you give a mobile number, you may tick a
        box that is never pre-ticked, reading:
      </p>
      <p>
        “Text me a reminder before my appointment. {LEGAL.product} appointment reminders only, never marketing. 1–2
        messages per appointment. Message and data rates may apply. Reply STOP to unsubscribe, HELP for help. See our
        Terms and Privacy Policy.”
      </p>
      <p>
        You can finish booking without giving a number or ticking the box, and nothing about the appointment changes
        either way. Consent is recorded against your record at that salon, with the date and time.
      </p>

      <h3>What we send</h3>
      <p>
        Appointment reminders only — typically one the day before and one a couple of hours ahead, depending on what
        the salon has chosen. One to two messages per appointment. We never send marketing by text.
      </p>

      <h3>How you stop them</h3>
      <p>
        Reply <strong>STOP</strong> to any message and they end immediately; reply <strong>HELP</strong> for help. You
        can also untick the reminder box next time you book, or ask the salon. When you reply STOP we clear the consent
        on your record as well, so nothing is queued against it.
      </p>

      <h3>Who sees your number</h3>
      <p>
        <strong>
          We do not sell, rent or share mobile numbers, or the fact that you consented to messages, with third parties
          for their own marketing.
        </strong>{" "}
        Your number is passed to our messaging provider for the sole purpose of delivering the reminders you asked
        for. Within a salon, contact details are visible to its managers only.
      </p>

      <h2>Email from the salon</h2>
      <p>
        Separately from booking confirmations and reminders, the salon you booked with may email you about the salon —
        an offer, a change of opening hours, news. Only salons you have a record with can do this; nobody buys or
        rents a list, and {LEGAL.product} never emails you on its own behalf about anything other than your account.
      </p>
      <p>
        <strong>How you stop it.</strong> Every one of those emails carries an unsubscribe link at the bottom, along
        with our postal address. One click stops that salon’s emails, immediately and for good, and you never need an
        account or a password to do it. The page the link opens lets you go further if you want to:
      </p>
      <ul>
        <li>
          <strong>Promotions from every salon on {LEGAL.product}</strong>, including salons you book with later. We
          keep that choice against your email address, so it applies wherever you book.
        </li>
        <li>
          <strong>Every email from {LEGAL.product}</strong>, including confirmations, changes and reminders for
          appointments you book. Sign-in and password-reset emails you ask for are still sent, because without them
          you could not get back into your account.
        </li>
      </ul>
      <p>
        Unsubscribing from one salon, or from every salon’s promotions, does <strong>not</strong> stop confirmations,
        changes or reminders for appointments you book. Those are part of the booking, not marketing, and you would
        not want to lose them. Text reminders are separate: reply STOP to any of them.
      </p>
      <p>
        <strong>We do not sell, rent or share email addresses with third parties for their own marketing.</strong> Your
        address goes to our email provider for the sole purpose of delivering the message.
      </p>

      <h2>Cookies and browser storage</h2>
      <p>
        We use only what the service needs to work. There are no advertising cookies, no analytics or tracking
        scripts, and nothing that follows you to other websites.
      </p>
      <ul>
        <li>
          <strong>Sign-in cookie.</strong> Keeps you signed in. It can only be read by our servers, and it expires,
          or is removed when you sign out.
        </li>
        <li>
          <strong>Language cookie.</strong> Remembers the language you chose, so the next page is in it too.
        </li>
        <li>
          <strong>Your last salon.</strong> For salon staff, your browser remembers which salon you last opened, so
          signing in takes you back to its schedule. It stays on your device and is never sent to us.
        </li>
      </ul>
      <p>
        Because nothing here is used for advertising or tracking, there is nothing to opt out of. Blocking these
        cookies will stop sign-in and the language choice from working.
      </p>

      <h2>Why we use it</h2>
      <ul>
        <li>To take and manage bookings, and to show salons their schedule</li>
        <li>To send booking confirmations, changes and reminders</li>
        <li>
          To let the salon you booked with email you about the salon itself, until you unsubscribe — see “Email from
          the salon” above
        </li>
        <li>To let clients and salons message each other without exchanging personal contact details</li>
        <li>To keep accounts secure and investigate misuse</li>
        <li>To meet our legal and accounting obligations</li>
      </ul>

      <h2>Contact details stay inside the salon</h2>
      <p>
        {LEGAL.product} is built so a client’s email address and phone number are visible only to that salon’s
        managers. Designers see a client’s name and the salon’s own notes, and message clients through the platform
        rather than directly. This is a deliberate design choice, not only a policy.
      </p>

      <h2>Who else sees it</h2>
      <p>Service providers who help us run {LEGAL.product}:</p>
      <ul>
        {LEGAL.processors.map((p) => (
          <li key={p.name}>
            {p.name} — {p.purpose}
          </li>
        ))}
        <li>Our hosting and database provider, which stores the service’s data</li>
      </ul>
      <p>
        They may only use it to provide that service to us. <strong>We do not sell personal information.</strong> We
        may also disclose information if the law requires it, or to protect the rights and safety of people using the
        service.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Account and booking records are kept while the salon uses {LEGAL.product}, and afterwards only for as long as
        we need them for legal, tax or accounting reasons. Security and audit records are kept so we can investigate
        problems after the fact.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Ask for a copy of the information we hold about you, or ask us to correct or delete it</li>
        <li>Withdraw consent to text reminders at any time</li>
        <li>
          Unsubscribe from one salon’s emails, from every salon’s promotions, or from all our email, at any time, using
          the link in any of them
        </li>
        <li>
          Not be treated differently for using any of these rights
        </li>
        <li>
          If you are a salon client, you can also ask the salon directly — it is their record, and we will help them
          act on your request
        </li>
      </ul>
      <p>
        Email <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> and we will respond as quickly as we
        can. We may need to confirm it is you before acting on a request, and you may ask someone to make a request
        for you.
      </p>
      <p>
        Some U.S. states, such as California, give their residents these rights by law. We do not sell personal
        information or share it for targeted advertising, so there is no sale or sharing to opt out of. We do not use
        personal information to make decisions about you that have legal or similarly significant effects.
      </p>

      <h2>Security</h2>
      <p>
        Passwords are hashed with Argon2 and never stored in a readable form. Traffic is encrypted in transit. Access
        to client contact details is limited to a salon’s managers, and changes are recorded in an audit log.
      </p>

      <h2>Children</h2>
      <p>
        {LEGAL.product} is not intended for children under 16, and we do not knowingly collect their information. A
        parent or guardian may book on a child’s behalf.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes we will update the date at the top, and tell account holders directly when the change
        is significant.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL.legalName}, {LEGAL.address}. Email{" "}
        <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>.
      </p>
    </LegalPage>
  );
}
