import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Inbound (Nomba → us) webhook signature verification.
 *
 * T0 (2026-06-30) confirmed the SCHEME FAMILY from the Nomba docs: HMAC-SHA256
 * over a COLON-JOINED field string concatenated with a timestamp — i.e. the
 * `field_string_base64` path, NOT the team-doc raw-body-hex. So that is the
 * default now (defaulting to raw-body-hex would have failed every inbound
 * signature in production — F1).
 *   ⚠ STILL TO PIN from a recorded live sample (needs a funded sandbox txn → a
 *   public callback to capture the headers): the EXACT field order, the digest
 *   encoding (the docs mention both hex and base64), and the `nomba-signature`
 *   companion header names. The field list below is the documented order.
 * Distinct from the OUTBOUND `webhooks/sign.ts` (our raw-body-hex tenant deliveries).
 */
export type NombaSignatureScheme = 'raw_body_hex' | 'field_string_base64';

// T0-confirmed family (colon-joined fields + timestamp, HMAC-SHA256). Exact field
// order / encoding ⚠ still to byte-confirm from a recorded sample.
export const NOMBA_SIGNATURE_SCHEME: NombaSignatureScheme = 'field_string_base64';

/** The public-docs colon-joined field string, in the documented field order. */
export function buildFieldSigningString(payload: Record<string, unknown>): string {
  const get = (k: string): string => {
    const v = payload[k];
    return v === undefined || v === null ? '' : String(v);
  };
  return [
    'event_type',
    'requestId',
    'userId',
    'walletId',
    'transactionId',
    'transactionType',
    'transactionTime',
    'transactionResponseCode',
    'timestamp',
  ]
    .map(get)
    .join(':');
}

/** Compute the expected signature for the active scheme. */
export function computeNombaSignature(
  signatureKey: string,
  rawBody: string,
  payload?: Record<string, unknown>
): string {
  const hmac = createHmac('sha256', signatureKey);
  if (NOMBA_SIGNATURE_SCHEME === 'field_string_base64') {
    return hmac.update(buildFieldSigningString(payload ?? {}), 'utf8').digest('base64');
  }
  return hmac.update(rawBody, 'utf8').digest('hex');
}

/**
 * Constant-time verification of an inbound `nomba-signature`. Returns false (never
 * throws) on any malformed input; length-mismatch short-circuits before
 * `timingSafeEqual` (which requires equal-length buffers) without leaking timing.
 */
export function verifyNombaSignature(
  signatureKey: string,
  providedSignature: string,
  rawBody: string,
  payload?: Record<string, unknown>
): boolean {
  const expected = computeNombaSignature(signatureKey, rawBody, payload);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature ?? '', 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
