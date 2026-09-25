/**
 * Everything the Terms and Privacy pages need to name.
 *
 * It lives in shared rather than in the web app because the API needs it too:
 * CAN-SPAM requires a physical postal address in the footer of every marketing
 * email, and that address has to be the same one the legal pages print. Two
 * copies would eventually mean a footer that contradicts the privacy policy.
 *
 * These details also appear in the SMS opt-in disclosure and must agree with
 * what is filed with Twilio — see deploy/A2P-10DLC.md.
 */
export const LEGAL = {
  product: 'Morrri',
  /** The company that operates the service. */
  legalName: 'Akkija',
  address: '500 7th Ave, 8th Floor, New York, NY 10018',
  supportEmail: 'james@morrri.com',
  jurisdiction: 'the State of New York, United States',
  /** Shown at the top of both documents; bump when the text changes. */
  lastUpdated: '24 September 2026',
  /** Named in the privacy policy, because a reader is entitled to know. */
  processors: [
    { name: 'Resend', purpose: 'sending email' },
    { name: 'Twilio', purpose: 'sending text messages' },
  ],
} as const;
