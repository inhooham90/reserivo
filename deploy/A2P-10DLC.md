# A2P 10DLC campaign registration

What is filed with Twilio for the campaign, kept here so it can be diffed against
the two texts it has to agree with: the consent checkbox
(`apps/web/src/components/booking/sms-consent.tsx`) and the "Text messages"
section of the privacy policy (`apps/web/src/app/[locale]/privacy/page.tsx`).
Change one and change all three.

## Why the first submission was rejected (error 30909, September 2026)

> CTA Verification Issue: We were unable to verify your Call-to-Action (CTA) or
> message flow from the submitted information.

The opt-in was real and compliant, but unreachable. The checkbox lives on the
last step of a salon's booking page — pick stylist and service, pick a time,
*then* fill in details — under `/{slug}`, where `{slug}` is a particular salon.
A reviewer given `reserivo.com` lands on a marketing page for salon owners that
never mentions text messages and links to no booking page, so there was no path
from the submitted URL to the consent language. Nothing was wrong with the flow;
it simply could not be found.

**The fix is `https://reserivo.com/sms`** — public, no login, linked from the
footer of every public page and from the home page. It describes every opt-in
path in full and renders the same checkbox component the booking form uses, so
what a reviewer reads cannot drift from what a client sees.

## Campaign fields

**Campaign type:** Low Volume Mixed / Customer Care (appointment reminders).

**Campaign description**

> Reserivo is an online appointment booking service for hair and nail salons.
> Salons publish a public booking page; their clients book appointments on it.
> The only text messages sent are appointment reminders to a client who booked
> an appointment and asked for a reminder. No marketing, promotional or sales
> messages are sent.

**Call-to-Action / Message Flow**

> End users opt in on the web, at the final step of a salon's public booking
> page. The complete flow, and a reproduction of the consent checkbox itself, is
> published at https://reserivo.com/sms — public, no login or payment required.
>
> Step by step: (1) The client opens their salon's booking page, a public URL of
> the form https://reserivo.com/{salon}, shared by the salon on its own website,
> business cards or social profiles. No account is required. (2) The client
> selects a stylist and a service. (3) The client selects a date and time.
> (4) On the final step, "Your details", the client enters their name and email,
> and optionally a mobile number. (5) Directly below those fields is a single
> checkbox, never pre-ticked, which cannot be ticked until a mobile number has
> been entered. It reads: "Text me a reminder before my appointment. Reserivo
> appointment reminders only, never marketing. 1-2 messages per appointment.
> Message and data rates may apply. Reply STOP to unsubscribe, HELP for help.
> See our Terms and Privacy Policy." — where Terms and Privacy Policy link to
> https://reserivo.com/terms and https://reserivo.com/privacy. (6) The client
> presses "Confirm booking". Consent is not a condition of booking: the
> appointment is made whether or not the box is ticked, and the date and time of
> consent are stored against the client's record.
>
> This is the only opt-in path. Numbers are never bought, rented or imported,
> and a salon cannot add a number on a client's behalf. Mobile numbers and
> consent are not sold, rented or shared with third parties for their own
> marketing.

**Opt-in URL:** `https://reserivo.com/sms`
**Privacy policy:** `https://reserivo.com/privacy` (SMS terms under "Text messages")
**Terms:** `https://reserivo.com/terms`

**Opt-in keywords:** none — opt-in is web-only, via the checkbox above.

**Opt-out**

> Reply STOP to any message. Replying STOP ends messages immediately and clears
> the stored consent on the client's record, so nothing further is queued
> against it. A client can also untick the reminder box the next time they book,
> or ask the salon.

**Help**

> Reply HELP for help, or email james@reserivo.com.

**Message frequency:** 1-2 messages per appointment booked. Not recurring.

**Sample messages** (the exact format built in `RemindersService.smsBody`)

> Glow Salon: reminder, your Women's Cut with Mia is tomorrow (Thu, 2:30 PM). Reply STOP to opt out.

> Glow Salon: reminder, your Balayage with Mia is in 2h (Thu, 2:30 PM). Reply STOP to opt out.

## Before resubmitting

- [ ] `https://reserivo.com/sms` returns 200 and shows the checkbox.
- [ ] The checkbox wording on `/sms` matches this file and the privacy policy.
- [ ] `https://reserivo.com/terms` and `/privacy` return 200.
- [ ] Optionally, a live salon booking page a reviewer can walk end to end, cited
      in the Call-to-Action as a worked example.
