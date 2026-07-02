import type { DomainContext } from '../context';
import type { Kobo } from '../money';

/**
 * ── The rail abstraction (the architectural heart of a billing engine) ──
 * A money movement does not know HOW it is collected. Each rail is an adapter
 * behind ONE interface; the core speaks "collect for this reference" and never
 * learns a rail's name. Rails are PUSH/PULL-asymmetric: a `pull` rail (card
 * token, mandate debit) is initiated by us; a `push` rail (transfer to a virtual
 * account) can only be initiated by the payer, so "collect" there means
 * "expose where to pay and await reconciliation".
 *
 * This is a SEAM: the boilerplate ships the interface, a registry, and a mock.
 * Your real card / mandate / transfer adapters implement `RailAdapter`.
 */
export type RailDirection = 'pull' | 'push';

export interface RailCollectInput extends DomainContext {
  /** OUR stable reference — the idempotency + reconciliation join key. */
  reference: string;
  amountKobo: Kobo;
  metadata?: Record<string, unknown>;
}

export type RailCollectStatus = 'succeeded' | 'pending' | 'failed' | 'requires_action';

/**
 * A pull rail can accept a charge but require the CUSTOMER to authenticate (a
 * bank-forced OTP / 3DS step-up on a card-not-present recharge — live-proven on
 * Nomba). This is NOT a failure and NOT a silent success: the collection is held
 * until the customer completes the step. The billing/dunning layer surfaces a
 * fresh hosted-checkout `checkoutLink` for the customer to finish.
 */
export interface RailCollectAction {
  /** The only step-up kind today; leaves room for future variants. */
  type: 'otp_3ds';
  /** The raw gateway prompt (e.g. "Kindly enter the OTP sent to ****1958"). */
  message: string;
  /**
   * A customer-facing hosted-checkout link to complete authentication, when a
   * layer that has customer + sub-account context mints it. The card rail leaves
   * this UNSET (it is a pure Nomba adapter with no tenant email/sub-account);
   * `mintInvoiceCheckoutLink` in the billing layer populates it.
   */
  checkoutLink?: string;
}

export interface RailCollectResult {
  status: RailCollectStatus;
  /** Provider-side id, if any — informational only; never the join key. */
  providerReference?: string;
  /** For push rails: where the payer should send money (e.g. a virtual NUBAN). */
  payInstructions?: Record<string, unknown>;
  failureReason?: string;
  /**
   * A PULL rail that SHORT-collected (e.g. a NIBSS mandate debit that pulled only
   * the mandated account's available balance): the actual kobo collected, present
   * only when `status` is `succeeded` AND it is LESS than the requested
   * `amountKobo`. Absent ⇒ the full requested amount was collected (the
   * all-or-nothing common case for card tokens / full debits).
   */
  collectedKobo?: Kobo;
  /** Present only when `status === 'requires_action'`. */
  action?: RailCollectAction;
}

export interface RailAdapter {
  /** Stable key the core uses to look the adapter up (never branched on by name). */
  readonly key: string;
  readonly direction: RailDirection;
  /**
   * Pull rails attempt the debit and return succeeded/failed/pending. Push rails
   * return `pending` with `payInstructions` and settle later via inbound webhook
   * + reconciliation.
   */
  collect(input: RailCollectInput): Promise<RailCollectResult>;
}
