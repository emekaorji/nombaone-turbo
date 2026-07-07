'use server';

import { plansTable, pricesTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { mintReference } from '@nombaone/sara/reference';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';

type Result<T = unknown> = { status: 'error'; message: string } | ({ status: 'success' } & T);

const canWrite = (role: string): boolean => role !== 'viewer';

export async function createPlanAction(formData: FormData): Promise<Result<{ reference: string }>> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (!canWrite(session.user.role)) return { status: 'error', message: 'Viewers cannot create plans.' };

  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!name) return { status: 'error', message: 'Give the plan a name.' };

  const reference = mintReference('PLN');
  await db.insert(plansTable).values({
    reference,
    organizationId: session.organizationId,
    mode: session.mode,
    name,
    description,
  });
  revalidatePath('/plans');
  return { status: 'success', reference };
}

const INTERVALS = new Set(['day', 'week', 'month', 'year']);

/** Parse a naira string ("2,500" / "₦2,500.00") to integer kobo. */
function toKobo(raw: string): number | null {
  const cleaned = raw.replace(/[₦,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export async function createPriceAction(formData: FormData): Promise<Result<{ reference: string }>> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (!canWrite(session.user.role)) return { status: 'error', message: 'Viewers cannot create prices.' };

  const planRef = String(formData.get('planRef') ?? '');
  const interval = String(formData.get('interval') ?? 'month');
  const kobo = toKobo(String(formData.get('amount') ?? ''));

  if (!INTERVALS.has(interval)) return { status: 'error', message: 'Choose a billing interval.' };
  if (kobo === null || kobo <= 0) return { status: 'error', message: 'Enter a valid amount in naira.' };

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

  const reference = mintReference('PRC');
  await db.insert(pricesTable).values({
    reference,
    organizationId: session.organizationId,
    mode: session.mode,
    planId: plan[0].id,
    unitAmount: kobo,
    interval: interval as 'day' | 'week' | 'month' | 'year',
    active: true,
  });
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
