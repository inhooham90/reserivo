/**
 * Everything the Terms and Privacy pages need to name. Kept in one place
 * because these details appear in both documents and in the SMS opt-in
 * disclosure, and must agree with what is filed with Twilio.
 *
 * TODO before launch: replace legalName, address and jurisdiction with the
 * registered company details, and confirm the support inbox exists.
 */
export const LEGAL = {
  product: "Reserivo",
  /** The company that operates the service. */
  legalName: "Akkija",
  address: "— registered address to be added —",
  supportEmail: "james@reserivo.com",
  jurisdiction: "the State of California, United States",
  /** Shown at the top of both documents; bump when the text changes. */
  lastUpdated: "21 September 2026",
  /** Named in the privacy policy, because a reader is entitled to know. */
  processors: [
    { name: "Resend", purpose: "sending email" },
    { name: "Twilio", purpose: "sending text messages" },
  ],
} as const;
