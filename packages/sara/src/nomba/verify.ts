import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Inbound (Nomba → us) webhook signature verification.
 *
 * ⚠ UNCONFIRMED (T0): the signing scheme diverges between sources and must be
 * pinned against a live sandbox webhook before this ships live:
 *   • team doc      → HMAC-SHA256 over the RAW body, hex
 *   • public docs   → HMAC-SHA256 over a COLON-JOINED field string
 *                     (event_type:requestId:userId:walletId:transactionId:
 *                      transactionType:transactionTime:transactionResponseCode:timestamp),
 *                     Base64
 * We default to the team-doc scheme and expose both; T0 flips `NOMBA_SIGNATURE_SCHEME`
 * to whichever the sandbox's `nomba-signature` actually matches. This is distinct
 * from the OUTBOUND `webhooks/sign.ts` (our raw-body-hex deliveries to tenants).
 */
export type NombaSignatureScheme = 'raw_body_hex' | 'field_string_base64';

// ⚠ UNCONFIRMED — pin in T0 from a recorded sandbox sample.
export const NOMBA_SIGNATURE_SCHEME: NombaSignatureScheme = 'raw_body_hex';

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
