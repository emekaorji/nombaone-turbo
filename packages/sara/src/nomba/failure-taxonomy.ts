/**
 * The ONE translation from Nomba's free-text failure signal to a stable internal
 * reason. Dunning (06) branches on THIS enum, never on raw `gatewayMessage`. The
 * full enumerated `gatewayMessage` set (beyond the ones below) is a T0 sandbox
 * item; the mapper starts from the confirmed values and falls through to
 * `unknown` (which 06 treats conservatively — retry on the normal cadence).
 */
export type PaymentFailureReason =
  | 'insufficient_funds'
  | 'expired_card'
  | 'token_expired'
  | 'hard_decline'
  | 'do_not_honor'
  | 'mandate_suspended'
  | 'processor_unavailable'
  | 'otp_required'
  // Push-rail (send_invoice) dunning entry: the invoice sailed past its due date
  // with no payer action. Not a charge failure — nothing was charged.
  | 'invoice_overdue'
  | 'unknown';

/**
 * Map a Nomba `gatewayMessage` (and optional response code) to a
 * `PaymentFailureReason`. Order matters — more specific matches first.
 */
export function mapGatewayMessage(gatewayMessage?: string, _code?: string): PaymentFailureReason {
  const m = (gatewayMessage ?? '').toLowerCase().trim();
  if (!m) return 'unknown';

  if (m.includes('otp') || m.includes('3ds')) return 'otp_required';
  if (m.includes('insufficient')) return 'insufficient_funds';
  if (m.includes('token') && m.includes('expir')) return 'token_expired';
  if (m.includes('expir') && m.includes('card')) return 'expired_card';
  if (m.includes('do not honor') || m.includes('do-not-honor') || m.includes('do not honour')) {
    return 'do_not_honor';
  }
  if (m.includes('suspend')) return 'mandate_suspended';
  if (
    m.includes('unavailable') ||
    m.includes('timeout') ||
    m.includes('timed out') ||
    m.includes('try again')
  ) {
    return 'processor_unavailable';
  }
  if (m.includes('declin') || m.includes('invalid card') || m.includes('stolen') || m.includes('lost')) {
    return 'hard_decline';
  }
  return 'unknown';
}

/** Reasons a blind charge-retry is futile — they need the card-update flow (D4/06). */
export const CARD_UPDATE_REASONS: ReadonlySet<PaymentFailureReason> = new Set([
  'expired_card',
  'token_expired',
]);

const ALL_FAILURE_REASONS: ReadonlySet<string> = new Set<PaymentFailureReason>([
  'insufficient_funds',
  'expired_card',
  'token_expired',
  'hard_decline',
  'do_not_honor',
  'mandate_suspended',
  'processor_unavailable',
  'otp_required',
  'unknown',
]);

/**
 * Coerce a raw rail/failure string to a `PaymentFailureReason`: pass through an
 * already-classified bucket, otherwise map it as a `gatewayMessage`, otherwise
 * `unknown`. Lets the collect path persist a stable bucket for the dunning sweep to
 * branch on later.
 */
export function coerceFailureReason(raw?: string | null): PaymentFailureReason {
  if (!raw) return 'unknown';
  if (ALL_FAILURE_REASONS.has(raw)) return raw as PaymentFailureReason;
  return mapGatewayMessage(raw);
}
