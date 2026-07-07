'use server';

import { couponsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { mintReference } from '@nombaone/sara/reference';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { getSession } from '@/lib/auth';

export type CreateCouponState = { status: 'error'; message: string } | { status: 'success' };

const DURATIONS = new Set(['once', 'repeating', 'forever']);

function toKobo(raw: string): number | null {
  const cleaned = raw.replace(/[₦,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Edit a coupon's mutable fields (redeemBy / maxRedemptions). Discount value + duration are immutable. */
export async function updateCouponAction(couponRef: string, formData: FormData): Promise<{ ok: boolean; message?: string }> {
  const session = await getSession();
  if (!session) return { ok: false, message: 'Your session expired.' };
  if (session.user.role === 'viewer') return { ok: false, message: 'Viewers cannot edit coupons.' };

  const redeemByRaw = String(formData.get('redeemBy') ?? '').trim();
  const maxRaw = String(formData.get('maxRedemptions') ?? '').trim();
  const set: { redeemBy: Date | null; maxRedemptions: number | null } = {
    redeemBy: redeemByRaw ? new Date(redeemByRaw) : null,
    maxRedemptions: maxRaw ? Math.max(1, Math.floor(Number(maxRaw))) : null,
  };
  if (set.redeemBy && Number.isNaN(set.redeemBy.getTime())) return { ok: false, message: 'Enter a valid redeem-by date.' };

  await db
    .update(couponsTable)
    .set(set)
    .where(and(eq(couponsTable.organizationId, session.organizationId), eq(couponsTable.mode, session.mode), eq(couponsTable.reference, couponRef)));
  revalidatePath('/coupons');
  return { ok: true };
}

export async function createCouponAction(formData: FormData): Promise<CreateCouponState> {
  const session = await getSession();
  if (!session) return { status: 'error', message: 'Your session expired. Sign in again.' };
  if (session.user.role === 'viewer') return { status: 'error', message: 'Viewers cannot create coupons.' };

  const code = String(formData.get('code') ?? '')
    .trim()
    .toUpperCase();
  const duration = String(formData.get('duration') ?? 'once');
  const discountType = String(formData.get('discountType') ?? 'percent');
  const value = String(formData.get('value') ?? '').trim();
  const maxRaw = String(formData.get('maxRedemptions') ?? '').trim();
  const cyclesRaw = String(formData.get('durationInCycles') ?? '').trim();

  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
    return { status: 'error', message: 'Code must be 2–40 chars: letters, numbers, - or _.' };
  }
  if (!DURATIONS.has(duration)) return { status: 'error', message: 'Choose a duration.' };

  let percentOff: number | null = null;
  let amountOff: number | null = null;
  if (discountType === 'percent') {
    const pct = Number(value);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) {
      return { status: 'error', message: 'Percent off must be a whole number 1–100.' };
    }
    percentOff = pct;
  } else {
    const kobo = toKobo(value);
    if (kobo === null || kobo <= 0) return { status: 'error', message: 'Enter a valid amount in naira.' };
    amountOff = kobo;
  }

  let durationInCycles: number | null = null;
  if (duration === 'repeating') {
    const cycles = Number(cyclesRaw);
    if (!Number.isInteger(cycles) || cycles < 1) {
      return { status: 'error', message: 'Repeating coupons need a cycle count (1 or more).' };
    }
    durationInCycles = cycles;
  }

  let maxRedemptions: number | null = null;
  if (maxRaw) {
    const max = Number(maxRaw);
    if (!Number.isInteger(max) || max < 1) return { status: 'error', message: 'Max redemptions must be 1 or more.' };
    maxRedemptions = max;
  }

  // Code is unique per (org, mode).
  const existing = await db
    .select({ id: couponsTable.id })
    .from(couponsTable)
    .where(
      and(
        eq(couponsTable.organizationId, session.organizationId),
        eq(couponsTable.mode, session.mode),
        eq(couponsTable.code, code),
      ),
    )
    .limit(1);
  if (existing[0]) return { status: 'error', message: `Coupon code ${code} already exists.` };

  await db.insert(couponsTable).values({
    reference: mintReference('CPN'),
    organizationId: session.organizationId,
    mode: session.mode,
    code,
    duration: duration as 'once' | 'repeating' | 'forever',
    percentOff,
    amountOff,
    durationInCycles,
    maxRedemptions,
  });

  revalidatePath('/coupons');
  return { status: 'success' };
}
