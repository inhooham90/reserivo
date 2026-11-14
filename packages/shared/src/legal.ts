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
  supportEmail: 'team@morrri.com',
  jurisdiction: 'the State of New York, United States',
  /** Shown at the top of both documents; bump when the text changes. */
  lastUpdated: '26 September 2026',
  /** Named in the privacy policy, because a reader is entitled to know. */
  processors: [
    { name: 'Resend', purpose: 'sending email' },
    { name: 'Twilio', purpose: 'sending text messages' },
  ],
} as const;

/**
 * Whether the text-reminder program is offered at all. Off until the A2P 10DLC
 * campaign is approved, because texting from an unregistered number gets
 * filtered by US carriers, and asking clients to opt in to texts that never
 * arrive misleads them.
 *
 * Off means: no consent checkbox in booking, no "Text reminders" link in the
 * footer or on the home page, /sms says the program is not offered yet, the
 * API records no new consent (a withdrawal still counts) and sends no texts
 * even with Twilio configured. Terms and Privacy keep their SMS sections.
 *
 * Turn it on *before* re-submitting the campaign: the reviewer has to find
 * /sms and the live checkbox (see deploy/A2P-10DLC.md).
 */
export const SMS_PROGRAM_ENABLED = false;
