import { createHmac, timingSafeEqual } from 'node:crypto';

/** Stripe's default: an event older than five minutes is refused, which stops a captured request being replayed. */
export const SIGNATURE_TOLERANCE_SECONDS = 300;

/**
 * Verifies a `Stripe-Signature` header the way Stripe's SDKs do: HMAC-SHA256
 * of `${t}.${rawBody}` under the endpoint's whsec_ secret, compared in
 * constant time against every `v1` entry (there are two while a secret is
 * being rolled). The body must be the exact bytes received: re-serialising
 * parsed JSON changes whitespace and breaks the signature.
 */
export function verifyStripeSignature(
  rawBody: Buffer,
  header: string | undefined,
  secret: string,
  nowSeconds: number,
  tolerance = SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  if (!header) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const [key, value] = part.split('=', 2);
    if (key === 't') timestamp = Number(value);
    else if (key === 'v1' && value) signatures.push(value);
  }
  if (timestamp === null || !Number.isFinite(timestamp) || signatures.length === 0) return false;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  return signatures.some((sig) => {
    const given = Buffer.from(sig, 'hex');
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
