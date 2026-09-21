import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Terms of Service · ${LEGAL.product}`,
  description: `The terms on which ${LEGAL.product} is provided to salons and their clients.`,
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms cover your use of {LEGAL.product}, an online booking service for hair and nail salons operated by{" "}
        {LEGAL.legalName}. By creating an account or booking an appointment through {LEGAL.product}, you agree to them.
      </p>

      <h2>1. What {LEGAL.product} is</h2>
      <p>
        {LEGAL.product} is software. It gives a salon a public booking page, a calendar, a record of its clients, and a
        way to message them. We provide the software; we do not provide salon services.
      </p>

      <h2>2. Bookings are between the client and the salon</h2>
      <p>
        When you book an appointment, your agreement is with the salon — the service, the price, the cancellation
        policy and the result are theirs. {LEGAL.legalName} is not a party to it. Questions about an appointment should
        go to the salon.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>Give accurate information and keep it up to date</li>
        <li>Keep your password to yourself; you are responsible for what happens under your account</li>
        <li>Tell us promptly if you think someone else has access</li>
      </ul>

      <h2>4. If you run a salon on {LEGAL.product}</h2>
      <p>You are responsible for:</p>
      <ul>
        <li>The accuracy of your services, prices, hours and policies</li>
        <li>
          Having a lawful basis to hold your clients’ information, and answering their requests about it — the client
          records in your salon are yours
        </li>
        <li>Only sending messages to clients who have agreed to receive them</li>
        <li>Your own obligations to your clients, including anything you promise them</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <ul>
        <li>Do not use {LEGAL.product} unlawfully, or to harass anyone</li>
        <li>Do not send spam or unsolicited marketing through the platform</li>
        <li>Do not try to reach another salon’s data, or interfere with the service or its security</li>
        <li>Do not scrape, resell or rebrand the service without our written agreement</li>
      </ul>

      <h2>6. Text messages</h2>
      <p>
        Text reminders are sent only to clients who opted in when booking. The messaging features of {LEGAL.product}{" "}
        may not be used for marketing. We may suspend messaging for an account that breaks this.
      </p>

      <h2>7. Fees</h2>
      <p>
        {LEGAL.product} is currently provided free of charge while the service is in its early stage. If we introduce
        fees we will give account holders notice beforehand, and you may stop using the service rather than accept
        them.
      </p>

      <h2>8. Availability and changes</h2>
      <p>
        We aim to keep {LEGAL.product} running and to give notice of planned downtime, but we do not guarantee
        uninterrupted service. We may add, change or withdraw features as the product develops.
      </p>

      <h2>9. No warranty</h2>
      <p>
        {LEGAL.product} is provided “as is”, without warranties of any kind so far as the law allows. We do not
        warrant that it will be free of errors or interruptions.
      </p>

      <h2>10. Limitation of liability</h2>
      <p>
        To the extent the law allows, {LEGAL.legalName} is not liable for indirect or consequential losses, lost
        profits, lost bookings, or loss of data. Nothing here excludes liability that cannot lawfully be excluded.
      </p>

      <h2>11. Ending it</h2>
      <p>
        You may stop using {LEGAL.product} at any time. We may suspend or close an account that breaches these terms,
        and will explain why where we can.
      </p>

      <h2>12. Changes to these terms</h2>
      <p>
        We will post any change here and update the date at the top. Significant changes will be sent to account
        holders directly.
      </p>

      <h2>13. Governing law</h2>
      <p>These terms are governed by the laws of {LEGAL.jurisdiction}.</p>

      <h2>Contact</h2>
      <p>
        {LEGAL.legalName}, {LEGAL.address}. Email{" "}
        <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>. See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
