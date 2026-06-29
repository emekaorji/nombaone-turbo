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

export type RailCollectStatus = 'succeeded' | 'pending' | 'failed';

export interface RailCollectResult {
  status: RailCollectStatus;
  /** Provider-side id, if any — informational only; never the join key. */
  providerReference?: string;
  /** For push rails: where the payer should send money (e.g. a virtual NUBAN). */
  payInstructions?: Record<string, unknown>;
  failureReason?: string;
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
