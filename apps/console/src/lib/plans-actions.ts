'use server';

import { intervalLabel, isWallClockInterval, PRICE_INTERVALS } from '@nombaone/core-contracts/billing';
import { plansTable, pricesTable } from '@nombaone/core-db';
import { db as poolDb } from '@nombaone/core-db/pool';
import { db } from '@nombaone/core-db/serverless';
import { mintReference } from '@nombaone/sara/reference';
import { and, eq, ne } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';
import { toKobo } from '@/lib/money';

import type { PriceInterval } from '@nombaone/core-contracts/types';

type Result<T = unknown> = { status: 'error'; message: string } | ({ status: 'success' } & T);

const canWrite = (role: string): boolean => role !== 'viewer';

/** Narrow a form string to a cadence unit. Returns null (→ a user-facing error) rather
 * than casting, so a value the engine does not know can never reach the insert. */
function toInterval(raw: string): PriceInterval | null {
  return (PRICE_INTERVALS as readonly string[]).includes(raw) ? (raw as PriceInterval) : null;
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

  const baseInterval = toInterval(String(formData.get('baseInterval') ?? 'month'));
  if (baseInterval === null || isWallClockInterval(baseInterval)) {
    return { status: 'error', message: 'Choose a billing interval.' };
  }

  /**
   * One amount per calendar cadence (`amount_month`, `amount_year`, …) — the base is simply the
   * cadence named by `baseInterval`. A WALL-CLOCK cadence (`minute`) is an engine/test cadence, not
   * something a customer is put on, so it is not offered and not accepted here; an exotic cadence
   * (month × 3, minute × 10) is still reachable through "Add price" on the ladder.
   */
  const priced: { interval: PriceInterval; kobo: number }[] = [];
  for (const iv of PRICE_INTERVALS) {
    if (isWallClockInterval(iv)) continue;
    const raw = String(formData.get(`amount_${iv}`) ?? '').trim();
    if (!raw) continue;
    const kobo = toKobo(raw);
    if (kobo === null) return { status: 'error', message: `Enter a valid ${intervalLabel(iv)} amount in naira.` };
    priced.push({ interval: iv, kobo });
  }

  // The form cannot submit two amounts for one cadence, so the (interval, count) uniqueness this
  // action enforces elsewhere holds here by construction. What it CAN do is submit none.
  if (!priced.some((p) => p.interval === baseInterval)) {
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
          interval: p.interval,
          intervalCount: 1,
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

/** Edit a plan's display fields (name/description). Prices are immutable and unaffected. */
export async function updatePlanAction(planRef: string, formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (!canWrite(session.user.role)) return { ok: false, message: 'Viewers cannot edit plans.' };
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { ok: false, message: 'Name cannot be empty.' };
  const description = String(formData.get('description') ?? '').trim() || null;
  await db
    .update(plansTable)
    .set({ name, description })
    .where(and(eq(plansTable.organizationId, session.organizationId), eq(plansTable.mode, session.mode), eq(plansTable.reference, planRef)));
  revalidatePath('/plans');
  return { ok: true };
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
