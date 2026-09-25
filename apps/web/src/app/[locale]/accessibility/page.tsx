import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: `Accessibility · ${LEGAL.product}`,
  description: `${LEGAL.product}'s accessibility commitment, what we have done, what we know still falls short, and how to reach us.`,
};

/**
 * The accessibility statement. It is linked from PublicFooter on every public
 * page, like Terms and Privacy.
 *
 * Keep "Known limitations" honest and current. A statement that claims full
 * conformance while a known gap exists is worse than none, because it is the
 * first thing anyone checks. When a limitation is fixed, remove it here in the
 * same change, and bump LEGAL.lastUpdated.
 */
export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility">
      <p>
        {LEGAL.product} should work for everyone who books an appointment or runs a salon with it, including people
        who use a screen reader, a keyboard instead of a mouse, magnification, or voice control. {LEGAL.legalName}{" "}
        is responsible for the accessibility of the {LEGAL.product} website and app.
      </p>

      <h2>Our standard</h2>
      <p>
        We aim to meet the{" "}
        <a href="https://www.w3.org/TR/WCAG22/">Web Content Accessibility Guidelines (WCAG) 2.2</a> at Level AA. That
        is the standard referred to by the U.S. Department of Justice and by most accessibility laws around the world.
      </p>

      <h2>What we have done</h2>
      <ul>
        <li>
          Every pair of text and background colours is measured against the WCAG contrast ratios, in both light and
          dark mode, and re-measured whenever a colour changes
        </li>
        <li>Every control can be reached and used from the keyboard, with a clearly visible focus outline</li>
        <li>A “Skip to main content” link is the first thing the Tab key reaches on every page</li>
        <li>Form fields have labels a screen reader announces, and errors are written out in words</li>
        <li>Pages are organised with headings and landmarks, so they can be navigated by section</li>
        <li>Animations are turned off when your device asks for reduced motion</li>
        <li>The site follows your device’s light or dark setting, and text can be enlarged without losing content</li>
        <li>
          Booking pages and sign-in are available in English, Korean, Chinese and Spanish, and each page declares its
          language so screen readers pronounce it correctly
        </li>
      </ul>
      <p>
        We check pages with automated testing tools and by hand. Our most recent review was on{" "}
        {LEGAL.lastUpdated}.
      </p>

      <h2>Known limitations</h2>
      <p>We know about these, and are working on them:</p>
      <ul>
        <li>
          <strong>Choosing a time on the salon calendar.</strong> Staff can click an empty time on the calendar to
          start a booking. That shortcut needs a mouse or touch screen. The “New appointment” button does the same
          thing from the keyboard.
        </li>
        <li>
          <strong>Languages.</strong> Some screens for salon staff, the text-message consent wording, and our legal
          pages are in English only for now.
        </li>
        <li>
          <strong>What salons write.</strong> Each salon writes its own service names and descriptions. We give them
          plain-text fields, but we do not review what they write.
        </li>
      </ul>

      <h2>If something does not work for you</h2>
      <p>
        Tell us, and we will help. Email{" "}
        <a href={`mailto:${LEGAL.supportEmail}?subject=Accessibility`}>{LEGAL.supportEmail}</a> with the page you were
        on and what went wrong. If you cannot book an appointment through a salon’s booking page, include the salon’s
        name and the time you want, and we will help you make the booking. We aim to reply within five business
        days.
      </p>
      <p>
        This page covers the {LEGAL.product} website. Questions about access to a salon’s premises, such as steps,
        parking or seating, are for the salon itself.
      </p>
      <p>
        See also our <Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPage>
  );
}
