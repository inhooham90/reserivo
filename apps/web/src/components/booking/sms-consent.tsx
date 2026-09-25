import { Link } from "@/i18n/navigation";
import { cn } from "cn";

/**
 * The SMS opt-in, as one component, because the same markup has to appear in
 * two places: the last step of the booking flow, and /sms — the page carriers
 * are given as proof of the consent flow during A2P 10DLC review. Two copies
 * would eventually disagree, and a reviewer comparing them finds the mismatch.
 *
 * Always rendered, so the opt-in is plainly visible to anyone reading the page,
 * and only enabled once there is a number to send to. Never pre-ticked: consent
 * has to be given, not withdrawn. The wording carries the disclosures US
 * carriers expect, and must stay in step with what is filed with them and with
 * the "Text messages" section of the privacy policy.
 */
export function SmsConsent({
  checked,
  onChange,
  hasPhone,
  disabled,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  hasPhone: boolean;
  /** Set on the /sms illustration, where the box is shown but not operable. */
  disabled?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input
        type="checkbox"
        className="mt-1"
        checked={checked}
        disabled={disabled ?? !hasPhone}
        readOnly={!onChange}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
      />
      <span className={cn(!hasPhone && "text-muted-foreground")}>
        Text me a reminder before my appointment.
        <span className="block text-xs text-muted-foreground">
          {!hasPhone && "Add a mobile number above to turn this on. "}
          Morrri appointment reminders only, never marketing. 1–2 messages per appointment. Message and data rates
          may apply. Reply STOP to unsubscribe, HELP for help. See our{" "}
          <Link href="/terms" target="_blank" className="underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="underline">
            Privacy Policy
          </Link>
          .
        </span>
      </span>
    </label>
  );
}
