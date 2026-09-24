/**
 * The company facts the Terms, Privacy and /sms pages render from.
 *
 * The values moved to @reserivo/shared because the API needs the postal
 * address for the CAN-SPAM footer on campaign email. This re-export stays so
 * every `import { LEGAL } from "@/lib/legal"` keeps working.
 */
export { LEGAL } from "@reserivo/shared";
