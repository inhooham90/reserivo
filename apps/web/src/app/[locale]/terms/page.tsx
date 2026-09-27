import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Terms of Service · ${LEGAL.product}`,
  description: `The terms on which ${LEGAL.product} is provided to businesses and their clients.`,
};

export default function TermsPage() {
  return (
    <LegalPage doc="terms" title="Terms of Service">
      <p>
        These terms cover your use of {LEGAL.product}, an online booking service for small businesses that take
        appointments, operated by {LEGAL.legalName}. By creating an account or booking an appointment through{" "}
        {LEGAL.product}, you agree to them.
      </p>

      <h2>1. What {LEGAL.product} is</h2>
      <p>
        {LEGAL.product} is software. It gives a business a public booking page, a calendar, a record of its clients,
        and a way to message them. We provide the software; we do not provide the services a business offers.
      </p>

      <h2>2. Bookings are between the client and the business</h2>
      <p>
        When you book an appointment, your agreement is with the business — the service, the price, the cancellation
        policy and the result are theirs. {LEGAL.legalName} is not a party to it. Questions about an appointment should
        go to the business.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>
          You must be at least 16 to hold an account or book an appointment yourself. A parent or guardian may book
          for someone younger
        </li>
        <li>Give accurate information and keep it up to date</li>
        <li>Keep your password to yourself; you are responsible for what happens under your account</li>
        <li>Tell us promptly if you think someone else has access</li>
      </ul>

      <h2>4. If you run a business on {LEGAL.product}</h2>
      <p>You are responsible for:</p>
      <ul>
        <li>The accuracy of your services, prices, hours and policies</li>
        <li>
          Having a lawful basis to hold your clients’ information, and answering their requests about it — the client
          records in your business are yours
        </li>
        <li>
          Contacting clients only as sections 6 and 7 allow — texts only where the client asked for them, email only
          to your own clients and never after they unsubscribe
        </li>
        <li>Your own obligations to your clients, including anything you promise them</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <ul>
        <li>Do not use {LEGAL.product} unlawfully, or to harass anyone</li>
        <li>
          Do not send spam through the platform. A business may email its own clients under section 7; it may not email
          people it has no relationship with, buy or rent a list, or send to anyone who has unsubscribed
        </li>
        <li>Do not try to reach another business’s data, or interfere with the service or its security</li>
        <li>Do not scrape, resell or rebrand the service without our written agreement</li>
      </ul>

      {/*
        These are the SMS program terms a carrier looks for when it opens the
        Terms URL filed with the A2P 10DLC campaign — frequency, rates, STOP,
        HELP, carrier non-liability. They must agree with the consent checkbox
        and the privacy policy; see deploy/A2P-10DLC.md.
      */}
      <h2>6. Text messages</h2>
      <p>
        {LEGAL.product} sends appointment reminders by text. The program is operated by {LEGAL.legalName} on behalf of
        the business you booked with, and messages identify both.
      </p>
      <p>
        <strong>Opting in.</strong> Reminders are sent only to clients who gave a mobile number while booking and
        ticked the reminder box on the booking page, which is never pre-ticked. Consent is not a condition of booking
        or of any service: your appointment is made whether or not you tick it.
      </p>
      <p>
        <strong>What is sent, and how often.</strong> Appointment reminders only — never marketing, promotions or
        sales. One to two messages per appointment you book. This is not a recurring subscription; messages stop when
        your appointments do.
      </p>
      <p>
        <strong>Cost.</strong> Message and data rates may apply. {LEGAL.product} does not charge for reminders, but
        your mobile carrier may charge you to receive them, according to your plan.
      </p>
      <p>
        <strong>Stopping them.</strong> Reply <strong>STOP</strong> to any message to end them immediately; we also
        clear the consent held on your record. Reply <strong>HELP</strong> for help, or email{" "}
        <a href={`mailto:${LEGAL.supportEmail}`} className="underline">
          {LEGAL.supportEmail}
        </a>
        . You can also untick the reminder box the next time you book, or ask the business.
      </p>
      <p>
        <strong>Delivery.</strong> Carriers do not guarantee delivery, and neither do we. {LEGAL.legalName} is not
        liable for a reminder that arrives late or not at all, and a missed reminder does not change the terms of your
        appointment with the business.
      </p>
      <p>
        How your number is handled is set out in our{" "}
        <Link href="/privacy" className="underline">
          Privacy Policy
        </Link>
        ; the program is described in full at{" "}
        <Link href="/sms" className="underline">
          morrri.com/sms
        </Link>
        . We do not sell, rent or share mobile numbers, or the fact that you consented, with third parties for their
        own marketing.
      </p>
      <p>
        <strong>If you run a business:</strong> the <em>text messaging</em> features of {LEGAL.product} may not be used
        for marketing, and you may not add a client’s number on their behalf. We may suspend texting for an account
        that breaks this. Email is different and is covered by section 7.
      </p>

      <h2>7. Email to your clients</h2>
      <p>
        A business on {LEGAL.product} may email the clients it holds records for — an offer, a change of hours, news.
        Unlike text messages, this is email the client can stop at any time rather than something they had to ask for
        first.
      </p>
      <p>
        <strong>Who may be emailed.</strong> Only clients of your own business who gave an email address and have not
        unsubscribed. You may not import or buy a list, and you may not email someone who left.
      </p>
      <p>
        <strong>Unsubscribing.</strong> Every campaign carries an unsubscribe link and {LEGAL.legalName}’s postal
        address, added by us and not removable. We honour an unsubscribe immediately and centrally: once someone
        unsubscribes from your business, no campaign of yours can reach them again. It does not stop their booking
        confirmations or appointment reminders, which are not marketing.
      </p>
      <p>
        <strong>If you run a business:</strong> the content is yours and so is the responsibility for it — including
        having a lawful basis to contact your clients and honouring anything you promise them. There is a limit on how
        many clients one business may email in a day, because every business shares the same sending reputation. We may
        suspend email for an account that generates complaints, and we may refuse a campaign.
      </p>

      <h2>8. Fees</h2>
      <p>
        {LEGAL.product} is currently provided free of charge while the service is in its early stage. If we introduce
        fees we will give account holders notice beforehand, and you may stop using the service rather than accept
        them.
      </p>

      <h2>9. Availability and changes</h2>
      <p>
        We aim to keep {LEGAL.product} running and to give notice of planned downtime, but we do not guarantee
        uninterrupted service. We may add, change or withdraw features as the product develops.
      </p>

      <h2>10. No warranty</h2>
      <p>
        {LEGAL.product} is provided “as is”, without warranties of any kind so far as the law allows. We do not
        warrant that it will be free of errors or interruptions.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the extent the law allows, {LEGAL.legalName} is not liable for indirect or consequential losses, lost
        profits, lost bookings, or loss of data. Nothing here excludes liability that cannot lawfully be excluded.
      </p>

      <h2>12. Ending it</h2>
      <p>
        You may stop using {LEGAL.product} at any time. We may suspend or close an account that breaches these terms,
        and will explain why where we can.
      </p>

      <h2>13. Changes to these terms</h2>
      <p>
        We will post any change here and update the date at the top. Significant changes will be sent to account
        holders directly.
      </p>

      <h2>14. Governing law</h2>
      <p>These terms are governed by the laws of {LEGAL.jurisdiction}.</p>
      {/*
        Sections 15 onward were added after 1–14, and appended rather than
        inserted so that "section 6" and "section 7" keep pointing at the SMS
        and email terms: the A2P 10DLC filing and section 4 both cite them.
      */}
      <h2>15. Your content, and ours</h2>
      <p>
        What you put into {LEGAL.product} stays yours: a business’s name, services, descriptions and notes, the messages
        you write, and the emails a business sends its clients. You allow us to store, display and deliver it only so far
        as we need to run the service for you, and you confirm you have the right to use it.
      </p>
      <p>
        The {LEGAL.product} name, the software and the design of the site belong to {LEGAL.legalName}. These terms
        let you use the service; they do not give you any other right in it.
      </p>
      <h2>16. Copyright complaints</h2>
      <p>
        If you believe something on {LEGAL.product} infringes your copyright, email{" "}
        <a href={`mailto:${LEGAL.supportEmail}?subject=Copyright`}>{LEGAL.supportEmail}</a> with:
      </p>
      <ul>
        <li>The work you believe is infringed</li>
        <li>Where the material is on {LEGAL.product}, such as the page’s address</li>
        <li>Your name, postal address, phone number and email</li>
        <li>A statement that you believe in good faith the use is not authorised by you, your agent or the law</li>
        <li>
          A statement, under penalty of perjury, that your notice is accurate and that you own the copyright or may
          act for its owner
        </li>
        <li>Your physical or electronic signature</li>
      </ul>
      <p>
        We will remove material we find infringing, and tell the person who posted it. We close the accounts of
        people who infringe repeatedly.
      </p>
      <h2>17. Open-source software</h2>
      <p>
        {LEGAL.product} is built with open-source software and typefaces. Their licences and copyright notices are
        listed in our <a href="/third-party-notices.txt">third-party notices</a>.
      </p>
      <h2>18. Accessibility</h2>
      <p>
        We aim to meet WCAG 2.2 Level AA. Our <Link href="/accessibility">accessibility statement</Link> explains what
        we have done, what we know still falls short, and how to get help if something does not work for you.
      </p>

      <h2>Contact</h2>
      <p>
        {LEGAL.legalName}, {LEGAL.address}. Email{" "}
        <a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a>. See also our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
