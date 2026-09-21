/**
 * Everything the Terms and Privacy pages need to name. Kept in one place
 * because these details appear in both documents and in the SMS opt-in
 * disclosure, and must agree with what is filed with Twilio.
 */
export const LEGAL = {
  product: "Reserivo",
  /** The company that operates the service. */
  legalName: "Akkija",
  address: "500 7th Ave, 8th Floor, New York, NY 10018",
  supportEmail: "james@reserivo.com",
  jurisdiction: "the State of New York, United States",
  /** Shown at the top of both documents; bump when the text changes. */
  lastUpdated: "21 September 2026",
  /** Named in the privacy policy, because a reader is entitled to know. */
  processors: [
    { name: "Resend", purpose: "sending email" },
    { name: "Twilio", purpose: "sending text messages" },
  ],
} as const;
