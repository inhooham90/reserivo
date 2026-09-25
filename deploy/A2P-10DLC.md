# A2P 10DLC campaign registration

What is filed with Twilio for the campaign, kept here so it can be diffed against
the texts it has to agree with: the consent checkbox
(`apps/web/src/components/booking/sms-consent.tsx`), the "Text messages"
section of the privacy policy, section 6 of the terms, and the message body
built in `RemindersService.smsBody`. Change one and change them all.

**The product was renamed from Reserivo to Morrri in September 2026**, before the
campaign was resubmitted, because the old name was too close to an existing
business. Everything below is written for the new name. The brand on file is
the legal entity (Akkija and its EIN), which the rename does not touch; if
Morrri is registered as a DBA, add it to the brand. Resubmit only once
`https://morrri.com` is live, because the reviewer opens every URL here.

## Why the first submission was rejected (error 30909, September 2026)

> CTA Verification Issue: We were unable to verify your Call-to-Action (CTA) or
> message flow from the submitted information.

The opt-in was real and compliant, but unreachable. The checkbox lives on the
last step of a salon's booking page — pick stylist and service, pick a time,
*then* fill in details — under `/{slug}`, where `{slug}` is a particular salon.
A reviewer given `morrri.com` lands on a marketing page for salon owners that
never mentions text messages and links to no booking page, so there was no path
from the submitted URL to the consent language. Nothing was wrong with the flow;
it simply could not be found.

**The fix is `https://morrri.com/sms`** — public, no login, linked from the
home page and from the footer of the home page and every salon booking page. It describes every opt-in
path in full and renders the same checkbox component the booking form uses, so
what a reviewer reads cannot drift from what a client sees.

## Campaign fields

**Campaign type:** Low Volume Mixed if under ~6,000 messages/day, otherwise
Customer Care. Appointment reminders fit either.

**Declarations:** no embedded links, no embedded phone numbers, no age-gated
content, no direct lending, no affiliate marketing. All true of the bodies in
`RemindersService.smsBody` — adding a link to a reminder later makes the filing
wrong.

**Campaign description**

> Morrri is an online appointment booking service for hair and nail salons.
> Salons publish a public booking page; their clients book appointments on it.
> The only text messages sent are appointment reminders to a client who booked
> an appointment and asked for a reminder. No marketing, promotional or sales
> messages are sent.

**Call-to-Action / Message Flow**

> End users opt in on the web, at the final step of a salon's public booking
> page. The complete flow, and a reproduction of the consent checkbox itself, is
> published at https://morrri.com/sms — public, no login or payment required.
>
> Step by step: (1) The client opens their salon's booking page, a public URL of
> the form https://morrri.com/{salon}, shared by the salon on its own website,
> business cards or social profiles. No account is required. (2) The client
> selects a stylist and a service. (3) The client selects a date and time.
> (4) On the final step, "Your details", the client enters their name and email,
> and optionally a mobile number. (5) Directly below those fields is a single
> checkbox, never pre-ticked, which cannot be ticked until a mobile number has
> been entered. It reads: "Text me a reminder before my appointment. Morrri
> appointment reminders only, never marketing. 1-2 messages per appointment.
> Message and data rates may apply. Reply STOP to unsubscribe, HELP for help.
> See our Terms and Privacy Policy." — where Terms and Privacy Policy link to
> https://morrri.com/terms and https://morrri.com/privacy. (6) The client
> presses "Confirm booking". Consent is not a condition of booking: the
> appointment is made whether or not the box is ticked, and the date and time of
> consent are stored against the client's record.
>
> This is the only opt-in path. Numbers are never bought, rented or imported,
> and a salon cannot add a number on a client's behalf. Mobile numbers and
> consent are not sold, rented or shared with third parties for their own
> marketing.

**Opt-in URL:** `https://morrri.com/sms`
**Privacy policy:** `https://morrri.com/privacy` (SMS terms under "Text messages")
**Terms:** `https://morrri.com/terms`

**Opt-in keywords:** none — opt-in is web-only, via the checkbox above.

**Opt-out**

> Reply STOP to any message. Replying STOP ends messages immediately and clears
> the stored consent on the client's record, so nothing further is queued
> against it. A client can also untick the reminder box the next time they book,
> or ask the salon.

**Help**

> Reply HELP for help, or email james@morrri.com.

**Message frequency:** 1-2 messages per appointment booked. Not recurring.

**Sample messages** (the exact format built in `RemindersService.smsBody`)

> Glow Salon (via Morrri): reminder, your Women's Cut with Mia is tomorrow (Thu, 2:30 PM). Reply STOP to opt out.

> Glow Salon (via Morrri): reminder, your Balayage with Mia is in 2h (Thu, 2:30 PM). Reply STOP to opt out.

## Why the messages say "(via Morrri)"

Morrri is a platform: it texts on behalf of many salons, but the campaign is
registered to one brand. A reviewer comparing a sample message against the
registered brand has to find the brand in it, and `Glow Salon: reminder, …`
does not contain it. The two clean answers are to send under Morrri's brand
and name Morrri in the body, or to register every salon as its own brand and
campaign — a brand, an EIN and a campaign per salon. We took the first.

It costs 15 characters against a 160-character segment. Overflow into a second
segment was already possible with a long enough salon, service and designer
name; this makes it likelier without introducing it. If it starts costing real
money, truncate in `smsBody` rather than dropping the brand.

## Brand, not just campaign

The campaign sits under a brand, and a campaign cannot outrun a brand's
problems:

- Legal name, EIN and address must match the IRS CP-575 character for
  character. `lib/legal.ts` is what the website shows; it has to agree.
- An unvetted brand is throughput-capped whatever the campaign says.
- Verify the brand status is approved before resubmitting the campaign, or the
  campaign is reviewed against a brand that is not ready.

## After approval

Approval routes nothing by itself. The numbers still have to be attached to the
Messaging Service the campaign is linked to.

## Before resubmitting

- [ ] `https://morrri.com/sms` returns 200 and shows the checkbox.
- [ ] `https://morrri.com/terms` and `/privacy` return 200, and the home page
      describes the business and links to `/sms`.
- [ ] The consent wording is identical in all four places: the `SmsConsent`
      component, the privacy policy's "Text messages", terms section 6, and this
      file.
- [ ] The sample messages above match what `RemindersService.smsBody` builds,
      including "(via Morrri)".
- [ ] Brand status is approved, with legal name, EIN and address matching the
      CP-575.
- [ ] Optionally, a live salon booking page a reviewer can walk end to end,
      cited in the Call-to-Action as a worked example.
