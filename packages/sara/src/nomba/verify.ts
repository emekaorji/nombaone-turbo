import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Inbound (Nomba → us) webhook signature verification.
 *
 * ── BYTE-CONFIRMED (2026-07-02, real prod payment_success webhook) ──────────
 * The scheme is HMAC-SHA256 (base64) over a COLON-JOINED field string, in this
 * exact order, with the values pulled from the NESTED payload and the trailing
 * field = the `nomba-timestamp` HEADER:
 *
 *   event_type : requestId : data.merchant.userId : data.merchant.walletId :
 *   data.transaction.transactionId : data.transaction.type : data.transaction.time :
 *   data.transaction.responseCode : <nomba-timestamp header>
 *
 * Headers observed: `nomba-signature` (== `nomba-sig-value`),
 * `nomba-signature-algorithm: HmacSHA256`, `nomba-signature-version: 1.0.0`,
 * `nomba-timestamp`. The earlier bug: fields were read TOP-LEVEL; Nomba nests them.
 * Distinct from the OUTBOUND `webhooks/sign.ts` (our raw-body-hex tenant deliveries).
 */
export type NombaSignatureScheme = 'raw_body_hex' | 'field_string_base64';

// Byte-confirmed: colon-joined nested fields + trailing nomba-timestamp header, HMAC-SHA256, base64.
export const NOMBA_SIGNATURE_SCHEME: NombaSignatureScheme = 'field_string_base64';

/**
 * The colon-joined field string Nomba signs (byte-confirmed order). Values are read
 * from the NESTED payload; the final field is the `nomba-timestamp` HEADER (it equals
 * `data.transaction.time` in practice, used as the fallback when the header is absent).
 */
export function buildFieldSigningString(
  payload: Record<string, unknown>,
  headerTimestamp?: string
): string {
  const p = payload as Record<string, unknown> & { data?: Record<string, unknown> };
  const d = (p.data ?? {}) as Record<string, unknown>;
  const merchant = (d.merchant ?? {}) as Record<string, unknown>;
  const txn = (d.transaction ?? {}) as Record<string, unknown>;
  const s = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
  return [
    s(p.event_type),
    s(p.requestId),
    s(merchant.userId),
    s(merchant.walletId),
    s(txn.transactionId),
    s(txn.type),
    s(txn.time),
    s(txn.responseCode),
    s(headerTimestamp ?? txn.time),
  ].join(':');
}

/** Compute the expected signature for the active scheme. */
export function computeNombaSignature(
  signatureKey: string,
  rawBody: string,
  payload?: Record<string, unknown>,
  headerTimestamp?: string
): string {
  const hmac = createHmac('sha256', signatureKey);
  if (NOMBA_SIGNATURE_SCHEME === 'field_string_base64') {
    return hmac.update(buildFieldSigningString(payload ?? {}, headerTimestamp), 'utf8').digest('base64');
  }
  return hmac.update(rawBody, 'utf8').digest('hex');
}

/**
 * T0 byte-confirm helper: compute the signature under EVERY candidate scheme so the
 * first real webhook can be matched against Nomba's actual `nomba-signature` and the
 * exact scheme pinned. Includes a header-timestamp-appended variant (the docs say
 * the field string is concatenated with a timestamp, which may be a header value).
 * Diagnostic only — not on the verification hot path.
 */
export function nombaSignatureCandidates(
  signatureKey: string,
  rawBody: string,
  payload: Record<string, unknown>,
  headerTimestamp?: string
): Record<string, string> {
  const field = buildFieldSigningString(payload); // trailing ts falls back to txn.time
  const fieldTs = buildFieldSigningString(payload, headerTimestamp); // trailing ts = header
  const h = (s: string, enc: 'hex' | 'base64'): string =>
    createHmac('sha256', signatureKey).update(s, 'utf8').digest(enc);
  return {
    raw_body_hex: h(rawBody, 'hex'),
    raw_body_base64: h(rawBody, 'base64'),
    field_string_base64: h(field, 'base64'),
    field_string_hex: h(field, 'hex'),
    field_ts_base64: h(fieldTs, 'base64'), // ← the byte-confirmed scheme
    field_ts_hex: h(fieldTs, 'hex'),
  };
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
  payload?: Record<string, unknown>,
  headerTimestamp?: string
): boolean {
  const expected = computeNombaSignature(signatureKey, rawBody, payload, headerTimestamp);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature ?? '', 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}
