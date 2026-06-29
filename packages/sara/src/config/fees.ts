import type { DomainContext, InfraDb } from '../context';
import type { Kobo } from '../money';

/**
 * ── Fee computation paradigm ──
 *
 * A fee is a deterministic function of an amount and a small parameter set:
 * a basis-points rate plus a floor and ceiling. The CALCULATION is pure and
 * isolated (`computeClampedFee`) so it is trivially testable and identical
 * everywhere; the POLICY (which parameters apply to this org/amount) is resolved
 * separately (`resolveFee`) so it can grow — per-org overrides, tiered rates,
 * promotional waivers — without touching the math.
 *
 * Everything is integer kobo. `rateBps` is basis points: 250 bps = 2.50%. The
 * result is rounded to the nearest kobo, then clamped into `[min, max]`.
 */
export interface FeeSchedule {
  /** Rate in basis points (1 bps = 0.01%). */
  rateBps: number;
  /** Lower bound on the fee, in kobo. */
  min: Kobo;
  /** Upper bound on the fee, in kobo. */
  max: Kobo;
}

export interface ComputeClampedFeeInput extends FeeSchedule {
  amount: Kobo;
}

/**
 * Pure fee math: round(amount × rateBps / 10000) clamped into [min, max].
 * No I/O, no policy — give it numbers, get a number. The single place the
 * rounding rule lives.
 */
export function computeClampedFee(input: ComputeClampedFeeInput): number {
  const raw = Math.round((input.amount * input.rateBps) / 10_000);
  return Math.min(Math.max(raw, input.min), input.max);
}

/**
 * The platform default fee schedule. Generic and conservative; a real deployment
 * tunes these (or, more likely, supplies a per-org resolver — see below).
 */
export const DEFAULT_FEE_SCHEDULE: FeeSchedule = {
  rateBps: 150, // 1.50%
  min: 1000, // ₦10.00 floor
  max: 200_000, // ₦2,000.00 ceiling
};

/**
 * Resolve the fee for an amount under the caller's context.
 *
 * The default implementation applies {@link DEFAULT_FEE_SCHEDULE} to every org.
 * This is the documented SEAM for per-org pricing: swap in a resolver that reads
 * an override from `platform_config` (or a dedicated pricing table) keyed by
 * `ctx.organizationId` / `ctx.environment`, falling back to the default. The
 * signature — `(db, ctx, amount) → Promise<kobo>` — is intentionally async and
 * db-bearing so an override resolver can do exactly that without an API change.
 */
export async function resolveFee(
  _db: InfraDb,
  _ctx: DomainContext,
  amount: Kobo
): Promise<number> {
  return computeClampedFee({ amount, ...DEFAULT_FEE_SCHEDULE });
}
