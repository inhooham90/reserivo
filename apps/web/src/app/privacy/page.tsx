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
        <li>Whether you agreed to text reminders, and when</li>
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

      <h2>Why we use it</h2>
      <ul>
        <li>To take and manage bookings, and to show salons their schedule</li>
        <li>To send booking confirmations, changes and reminders</li>
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
          If you are a salon client, you can also ask the salon directly — it is their record, and we will help them
          act on your request
        </li>
      </ul>
      <p>
        Email <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a> and we will respond as quickly as we
        can.
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
