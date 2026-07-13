'use server';

import { intervalLabel, PRICE_INTERVALS } from '@nombaone/core-contracts/billing';
import { plansTable, pricesTable } from '@nombaone/core-db';
import { db as poolDb } from '@nombaone/core-db/pool';
import { db } from '@nombaone/core-db/serverless';
import { mintReference } from '@nombaone/sara/reference';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';
import { cadenceOrder, parseCadenceKey, type Cadence } from '@/lib/cadences';
import { toKobo } from '@/lib/money';

import type { PriceInterval } from '@nombaone/core-contracts/types';

type Result<T = unknown> = { status: 'error'; message: string } | ({ status: 'success' } & T);

const canWrite = (role: string): boolean => role !== 'viewer';

/** Narrow a form string to a cadence unit. Returns null (→ a user-facing error) rather
 * than casting, so a value the engine does not know can never reach the insert. */
function toInterval(raw: string): PriceInterval | null {
  return (PRICE_INTERVALS as readonly string[]).includes(raw) ? (raw as PriceInterval) : null;
}

/** One cadence, and what the merchant says it costs. */
type PricedCadence = { cadence: Cadence; kobo: number };

/**
 * Every `amount_<interval>_<count>` field the form posted, parsed into cadences.
 *
 * The key carries the COUNT as well as the unit, so `minute × 10` — the cadence that lets a
 * developer watch a subscription renew while they are still building — is expressible in the
 * same breath as `month`. The old fields were keyed by the unit alone, which silently pinned
 * every price the form could create to a count of 1.
 *
 * Empty fields are SKIPPED, not zeroed: on the edit form that means "this cadence was not
 * submitted", and an unsubmitted cadence is left exactly as it is.
 */
function readSubmittedPrices(formData: FormData): Result<{ priced: PricedCadence[] }> {
  const priced: PricedCadence[] = [];
  const seen = new Set<string>();

  for (const [field, value] of formData.entries()) {
    if (!field.startsWith('amount_')) continue;
    const cadence = parseCadenceKey(field.slice('amount_'.length));
    // Validated against the engine's own enum, never cast: a hand-crafted post cannot smuggle
    // a unit the billing engine does not know into an insert.
    if (!cadence) return { status: 'error', message: 'That is not a billing cadence we can charge on.' };

    const raw = String(value ?? '').trim();
    if (!raw) continue;

    const kobo = toKobo(raw);
    if (kobo === null || kobo <= 0) {
      return { status: 'error', message: `Enter a valid ${cadence.label} amount in naira.` };
    }
    if (seen.has(cadence.key)) {
      return { status: 'error', message: `Two ${cadence.label} prices were submitted; a plan bills once per cadence.` };
    }
    seen.add(cadence.key);
    priced.push({ cadence, kobo });
  }

  // Deterministic order → deterministic lock order → two concurrent edits of one plan cannot deadlock.
  priced.sort((a, b) => cadenceOrder(a.cadence, b.cadence));
  return { status: 'success', priced };
}

/**
 * A plan and everything it costs, in ONE transaction.
 *
 * The two-step "create a plan, then add a price" is what let a merchant end up with a plan that
 * cannot be billed. Here the base price is part of the plan: either both land or neither does.
 *
 * The console's serverless (Neon HTTP) driver cannot do multi-statement transactions, so this runs
 * on the POOL handle — same as team-actions' invite-accept.
 */
export async function createPlanWithPricesAction(formData: FormData): Promise<Result<{ reference: string }>> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (!canWrite(session.user.role)) return { status: 'error', message: 'Viewers cannot create plans.' };

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!name) return { status: 'error', message: 'Give the plan a name.' };

  const baseCadence = parseCadenceKey(String(formData.get('baseCadence') ?? ''));
  if (!baseCadence) return { status: 'error', message: 'Choose a billing cadence.' };

  const submitted = readSubmittedPrices(formData);
  if (submitted.status === 'error') return submitted;
  const { priced } = submitted;

  // The form cannot submit two amounts for one cadence (`readSubmittedPrices` rejects it anyway).
  // What it CAN do is submit none — and a plan with no price is a plan nobody can subscribe to.
  if (!priced.some((p) => p.cadence.key === baseCadence.key)) {
    return { status: 'error', message: 'Set what the plan costs — a plan with no price cannot be billed.' };
  }

  const reference = mintReference('PLN');
  try {
    await poolDb.transaction(async (tx) => {
      const [plan] = await tx
        .insert(plansTable)
        .values({
          reference,
          organizationId: session.organizationId,
          mode: session.mode,
          name,
          description,
        })
        .returning({ id: plansTable.id });
      if (!plan) throw new Error('plan_insert_failed');

      await tx.insert(pricesTable).values(
        priced.map((p) => ({
          reference: mintReference('PRC'),
          organizationId: session.organizationId,
          mode: session.mode,
          planId: plan.id,
          unitAmount: p.kobo,
          interval: p.cadence.interval,
          intervalCount: p.cadence.intervalCount,
          active: true,
        })),
      );
    });
  } catch {
    return { status: 'error', message: 'Could not create the plan. Nothing was saved — try again.' };
  }

  revalidatePath('/plans');
  return { status: 'success', reference };
}

/**
 * ── Edit a plan, prices and all — THE RECONCILE ───────────────────────────────
 *
 * The merchant edits the plan the way they created it: a name, and what it costs on each
 * cadence. Underneath, a price row stays IMMUTABLE — its money is never rewritten — because a
 * subscription pins a `price_id`, and that pinned row is the entire reason an existing
 * subscriber's bill cannot move under them. So "changing a price" is: mint a new row, retire the
 * old one. This function makes that the merchant's outcome instead of the merchant's problem.
 *
 * Per SUBMITTED cadence, inside one transaction:
 *
 *   no active price     → INSERT           (the merchant switched this cadence on)
 *   amount unchanged    → NOTHING          (one active row) — a no-op edit writes nothing at all
 *                       → deactivate dups  (several active rows: heal a legacy plan down to one)
 *   amount changed      → INSERT new + deactivate EVERY other active row on that cadence
 *
 * A cadence that is NOT submitted is left completely alone — it stays active, untouched. That is
 * what makes a partial edit safe: omission can never silently retire a price.
 *
 * The plan row is locked FOR UPDATE first. Two merchants editing the same plan at once would
 * otherwise both find a cadence empty and both mint a price for it — and a FOR UPDATE on the
 * price rows cannot prevent that, because you cannot lock a row that does not exist yet.
 */
export async function updatePlanWithPricesAction(
  planRef: string,
  formData: FormData,
): Promise<Result<{ created: number; retired: number }>> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (!canWrite(session.user.role)) return { status: 'error', message: 'Viewers cannot edit plans.' };

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { status: 'error', message: 'Give the plan a name.' };
  const description = String(formData.get('description') ?? '').trim() || null;

  const submitted = readSubmittedPrices(formData);
  if (submitted.status === 'error') return submitted;
  const { priced } = submitted;

  let created = 0;
  let retired = 0;

  try {
    await poolDb.transaction(async (tx) => {
      const [plan] = await tx
        .select({ id: plansTable.id, status: plansTable.status })
        .from(plansTable)
        .where(
          and(
            eq(plansTable.organizationId, session.organizationId),
            eq(plansTable.mode, session.mode),
            eq(plansTable.reference, planRef),
          ),
        )
        .for('update');

      if (!plan) throw new Error('plan_missing');
      if (plan.status === 'archived') throw new Error('plan_archived');

      await tx.update(plansTable).set({ name, description }).where(eq(plansTable.id, plan.id));

      for (const { cadence, kobo } of priced) {
        // Newest first: the newest active row is the canonical one for this cadence. A legacy plan
        // can carry two live monthly prices, and which one a new subscriber gets would otherwise be
        // decided by row order — a coin toss over money.
        const actives = await tx
          .select()
          .from(pricesTable)
          .where(
            and(
              eq(pricesTable.planId, plan.id),
              eq(pricesTable.interval, cadence.interval),
              eq(pricesTable.intervalCount, cadence.intervalCount),
              eq(pricesTable.active, true),
            ),
          )
          .orderBy(desc(pricesTable.createdAt))
          .for('update');

        const canonical = actives[0];

        // The merchant switched a cadence on. Nothing to retire.
        if (!canonical) {
          await tx.insert(pricesTable).values({
            reference: mintReference('PRC'),
            organizationId: session.organizationId,
            mode: session.mode,
            planId: plan.id,
            unitAmount: kobo,
            interval: cadence.interval,
            intervalCount: cadence.intervalCount,
            active: true,
          });
          created += 1;
          continue;
        }

        // Untouched. Write NOTHING — an edit that changed only the name must not silently
        // recreate every price on the plan and hand each subscriber-facing row a new id.
        if (canonical.unitAmount === kobo) {
          const stale = actives.slice(1).map((p) => p.id);
          if (stale.length > 0) {
            await tx.update(pricesTable).set({ active: false }).where(inArray(pricesTable.id, stale));
            retired += stale.length;
          }
          continue;
        }

        // Changed. The replacement inherits everything but the money — same cadence, same billing
        // semantics, same trial — so only the amount moves.
        const [fresh] = await tx
          .insert(pricesTable)
          .values({
            reference: mintReference('PRC'),
            organizationId: canonical.organizationId,
            mode: canonical.mode,
            planId: canonical.planId,
            unitAmount: kobo,
            currency: canonical.currency,
            interval: canonical.interval,
            intervalCount: canonical.intervalCount,
            usageType: canonical.usageType,
            billingScheme: canonical.billingScheme,
            trialPeriodDays: canonical.trialPeriodDays,
            metadata: canonical.metadata,
            active: true,
          })
          .returning({ id: pricesTable.id });
        if (!fresh) throw new Error('price_insert_failed');
        created += 1;

        // Retire every OTHER active row on this cadence — not just the canonical one. The new row is
        // excluded by id, so the plan is never left with nothing to bill on.
        const flipped = await tx
          .update(pricesTable)
          .set({ active: false })
          .where(
            and(
              eq(pricesTable.planId, plan.id),
              eq(pricesTable.interval, cadence.interval),
              eq(pricesTable.intervalCount, cadence.intervalCount),
              eq(pricesTable.active, true),
              ne(pricesTable.id, fresh.id),
            ),
          )
          .returning({ id: pricesTable.id });
        retired += flipped.length;
      }
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'plan_missing') return { status: 'error', message: 'That plan no longer exists.' };
    if (code === 'plan_archived') return { status: 'error', message: 'An archived plan cannot be edited.' };
    return { status: 'error', message: 'Could not save the plan. Nothing was changed — try again.' };
  }

  revalidatePath('/plans');
  return { status: 'success', created, retired };
}

/**
 * Add one more cadence to an existing plan's ladder (and the repair path for a legacy plan that has
 * no price at all). The consolidated create form is the normal way in; this is the ladder's own
 * "add a cadence" — including the exotic ones (month × 3, minute × 10) that form does not offer.
 */
export async function createPriceAction(formData: FormData): Promise<Result<{ reference: string }>> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (!canWrite(session.user.role)) return { status: 'error', message: 'Viewers cannot create prices.' };

  const planRef = String(formData.get('planRef') ?? '');
  const interval = toInterval(String(formData.get('interval') ?? 'month'));
  const intervalCount = Number(formData.get('intervalCount') ?? 1);
  const kobo = toKobo(String(formData.get('amount') ?? ''));

  if (interval === null) return { status: 'error', message: 'Choose a billing interval.' };
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    return { status: 'error', message: 'Bill every N intervals — N must be a whole number, 1 or more.' };
  }
  if (kobo === null) return { status: 'error', message: 'Enter a valid amount in naira.' };

  const plan = await db
    .select({ id: plansTable.id })
    .from(plansTable)
    .where(
      and(
        eq(plansTable.organizationId, session.organizationId),
        eq(plansTable.mode, session.mode),
        eq(plansTable.reference, planRef),
      ),
    )
    .limit(1);
  if (!plan[0]) return { status: 'error', message: 'That plan no longer exists.' };

  // One active price per cadence. The DB has no such constraint, so the app is the only thing
  // standing between a merchant and two live monthly prices on the same plan.
  const clash = await activeCadenceClash(plan[0].id, interval, intervalCount);
  if (clash) return { status: 'error', message: clash };

  const reference = mintReference('PRC');
  await db.insert(pricesTable).values({
    reference,
    organizationId: session.organizationId,
    mode: session.mode,
    planId: plan[0].id,
    unitAmount: kobo,
    interval,
    intervalCount,
    active: true,
  });
  revalidatePath('/plans');
  return { status: 'success', reference };
}

/**
 * Change what a cadence costs.
 *
 * A price row is IMMUTABLE — its money fields are never updated — so a change is a NEW price plus a
 * deactivation of the old one. That is what grandfathers the existing subscribers: they pin the old
 * `price_id`, which still exists and still says what they agreed to pay. Only new subscribers reach
 * the new row.
 *
 * Both writes go in ONE pool transaction: a crash between them would otherwise deactivate the old
 * price without minting the new one, leaving the plan unbillable.
 */
export async function changePriceAction(priceRef: string, formData: FormData): Promise<Result<{ reference: string }>> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (!canWrite(session.user.role)) return { status: 'error', message: 'Viewers cannot change prices.' };

  const kobo = toKobo(String(formData.get('amount') ?? ''));
  if (kobo === null) return { status: 'error', message: 'Enter a valid amount in naira.' };

  const reference = mintReference('PRC');
  try {
    await poolDb.transaction(async (tx) => {
      // Lock the row we are retiring: two merchants changing the same price at once would otherwise
      // both read it as active and mint two replacements.
      const [old] = await tx
        .select()
        .from(pricesTable)
        .where(
          and(
            eq(pricesTable.organizationId, session.organizationId),
            eq(pricesTable.mode, session.mode),
            eq(pricesTable.reference, priceRef),
          ),
        )
        .for('update');

      if (!old) throw new Error('price_missing');
      if (!old.active) throw new Error('price_inactive');
      if (old.unitAmount === kobo) throw new Error('price_unchanged');

      // The replacement inherits everything but the money: same cadence, same billing semantics.
      const [fresh] = await tx
        .insert(pricesTable)
        .values({
          reference,
          organizationId: old.organizationId,
          mode: old.mode,
          planId: old.planId,
          unitAmount: kobo,
          currency: old.currency,
          interval: old.interval,
          intervalCount: old.intervalCount,
          usageType: old.usageType,
          billingScheme: old.billingScheme,
          trialPeriodDays: old.trialPeriodDays,
          metadata: old.metadata,
          active: true,
        })
        .returning({ id: pricesTable.id });
      if (!fresh) throw new Error('price_insert_failed');

      // Retire every OTHER active price on this cadence, not just the one we were handed: a legacy
      // plan can already carry two live monthly prices, and leaving one behind would mean a new
      // subscriber's price is decided by row order.
      await tx
        .update(pricesTable)
        .set({ active: false })
        .where(
          and(
            eq(pricesTable.planId, old.planId),
            eq(pricesTable.interval, old.interval),
            eq(pricesTable.intervalCount, old.intervalCount),
            eq(pricesTable.active, true),
            ne(pricesTable.id, fresh.id),
          ),
        );
    });
  } catch (err) {
    const code = err instanceof Error ? err.message : '';
    if (code === 'price_missing') return { status: 'error', message: 'That price no longer exists.' };
    if (code === 'price_inactive') return { status: 'error', message: 'That price is already deactivated.' };
    if (code === 'price_unchanged') return { status: 'error', message: 'That is already the current price.' };
    return { status: 'error', message: 'Could not change the price. Nothing was saved — try again.' };
  }

  revalidatePath('/plans');
  return { status: 'success', reference };
}

/** Prices are immutable — the only mutation is the `active` flip (a deactivation). */
export async function deactivatePriceAction(priceRef: string): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (!canWrite(session.user.role)) return { ok: false, message: 'Viewers cannot change prices.' };
  await db
    .update(pricesTable)
    .set({ active: false })
    .where(
      and(
        eq(pricesTable.organizationId, session.organizationId),
        eq(pricesTable.mode, session.mode),
        eq(pricesTable.reference, priceRef),
      ),
    );
  revalidatePath('/plans');
  return { ok: true };
}

export async function archivePlanAction(planRef: string): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (!canWrite(session.user.role)) return { ok: false, message: 'Viewers cannot archive plans.' };
  await db
    .update(plansTable)
    .set({ status: 'archived' })
    .where(
      and(
        eq(plansTable.organizationId, session.organizationId),
        eq(plansTable.mode, session.mode),
        eq(plansTable.reference, planRef),
      ),
    );
  revalidatePath('/plans');
  return { ok: true };
}

/**
 * The message to show when the plan already bills on this cadence, or null when it is free.
 * A plan may carry many prices, but only ONE active price per (interval, count) — two live monthly
 * prices on one plan is not a catalog, it is a coin toss over what a new subscriber pays.
 */
async function activeCadenceClash(
  planId: string,
  interval: PriceInterval,
  intervalCount: number,
): Promise<string | null> {
  const existing = await db
    .select({ id: pricesTable.id })
    .from(pricesTable)
    .where(
      and(
        eq(pricesTable.planId, planId),
        eq(pricesTable.interval, interval),
        eq(pricesTable.intervalCount, intervalCount),
        eq(pricesTable.active, true),
      ),
    )
    .limit(1);
  return existing[0]
    ? `This plan already bills ${intervalLabel(interval, intervalCount)}. Change that price instead of adding a second one.`
    : null;
}
