/**
 * Reconcile Nomba's inbound event NAMES (one place). The team doc uses dotted
 * names (`virtual_account.funded`, `transfer.success|failed`, `mandate.debit_success`);
 * the public docs use a flat set (`payment_success`, `payment_failed`,
 * `payout_success`, `payout_failed`, `payment_reversal`, `payout_refund`,
 * `order_success`). We map BOTH onto one internal vocabulary; an unrecognized type
 * maps to `ignored` (F5 — recorded and skipped, never errored).
 *
 * ⚠ UNCONFIRMED (T0): the authoritative emitted set + the virtual-account funding
 * event name (`payment_success` w/ `vact_transfer` vs `virtual_account.funded`).
 */
export type InternalNombaEventType =
  | 'payment_succeeded'
  | 'payment_failed'
  | 'transfer_succeeded'
  | 'transfer_failed'
  | 'payment_reversal'
  | 'ignored';

export interface InternalNombaEvent {
  type: InternalNombaEventType;
  /** True when this is an inbound virtual-account funding (the transfer/push rail). */
  isVirtualAccountFunding: boolean;
  /** The raw provider event_type, kept for audit. */
  raw: string;
}

const transactionType = (payload: Record<string, unknown>): string => {
  const data = (payload.data ?? payload) as Record<string, unknown>;
  const txn = (data.transaction ?? {}) as Record<string, unknown>;
  return String(txn.type ?? '').toLowerCase();
};

export function mapNombaEvent(
  rawType: string,
  payload: Record<string, unknown>
): InternalNombaEvent {
  const t = (rawType ?? '').toLowerCase();
  const isVa = transactionType(payload) === 'vact_transfer';
  const evt = (type: InternalNombaEventType, va = false): InternalNombaEvent => ({
    type,
    isVirtualAccountFunding: va,
    raw: rawType,
  });

  switch (t) {
    case 'payment_success':
      return evt('payment_succeeded', isVa);
    case 'virtual_account.funded':
      return evt('payment_succeeded', true);
    case 'payment_failed':
      return evt('payment_failed');
    case 'payout_success':
    case 'transfer.success':
      return evt('transfer_succeeded');
    case 'payout_failed':
    case 'transfer.failed':
      return evt('transfer_failed');
    case 'payment_reversal':
    case 'payout_refund':
      return evt('payment_reversal');
    default:
      return evt('ignored');
  }
}
