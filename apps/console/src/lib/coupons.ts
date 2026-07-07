import { couponsTable, creditGrantsTable, customersTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira } from '@/lib/money';

export type CouponStatus = 'active' | 'expired';
export type CouponRow = {
  reference: string;
  code: string;
  discount: string;
  duration: string;
  redemptions: string;
  expires: string;
  status: CouponStatus;
  maxRedemptions: number | null;
  redeemByISO: string | null;
};
export type GrantRow = {
  customer: string;
  source: string;
  granted: string;
  remaining: string;
  date: string;
  zeroed: boolean;
};
export type CouponsView = {
  coupons: CouponRow[];
  grants: GrantRow[];
  stats: { activeCoupons: number; totalRedemptions: number; discountGivenKobo: number; creditOutstandingKobo: number };
};

const fmtDate = (d: Date): string => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(d);
const EMPTY: CouponsView = {
  coupons: [],
  grants: [],
  stats: { activeCoupons: 0, totalRedemptions: 0, discountGivenKobo: 0, creditOutstandingKobo: 0 },
};

export async function listCouponsAndCredits(): Promise<CouponsView> {
  const session = await getSession();
  if (!session) return EMPTY;
  const { organizationId, mode } = session;

  const [coupons, grants] = await Promise.all([
    db
      .select()
      .from(couponsTable)
      .where(and(eq(couponsTable.organizationId, organizationId), eq(couponsTable.mode, mode)))
      .orderBy(desc(couponsTable.createdAt)),
    db
      .select({
        customer: customersTable.name,
        source: creditGrantsTable.source,
        amount: creditGrantsTable.amount,
        remaining: creditGrantsTable.remaining,
        createdAt: creditGrantsTable.createdAt,
      })
      .from(creditGrantsTable)
      .innerJoin(customersTable, eq(customersTable.id, creditGrantsTable.customerId))
      .where(and(eq(creditGrantsTable.organizationId, organizationId), eq(creditGrantsTable.mode, mode)))
      .orderBy(desc(creditGrantsTable.createdAt)),
  ]);

  const couponRows: CouponRow[] = coupons.map((c) => {
    const expired = c.maxRedemptions != null && c.timesRedeemed >= c.maxRedemptions;
    return {
      reference: c.reference,
      code: c.code,
      discount: c.percentOff != null ? `${c.percentOff}% off` : `${naira(Number(c.amountOff))} off`,
      duration:
        c.duration === 'repeating' ? `repeating · ${c.durationInCycles ?? 0} cycles` : (c.duration as string),
      redemptions: `${c.timesRedeemed} / ${c.maxRedemptions ?? '∞'}`,
      expires: c.redeemBy ? c.redeemBy.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—',
      status: expired ? 'expired' : 'active',
      maxRedemptions: c.maxRedemptions ?? null,
      redeemByISO: c.redeemBy ? c.redeemBy.toISOString().slice(0, 10) : null,
    };
  });

  const grantRows: GrantRow[] = grants.map((g) => ({
    customer: g.customer,
    source: g.source,
    granted: naira(Number(g.amount)),
    remaining: naira(Number(g.remaining)),
    date: fmtDate(g.createdAt),
    zeroed: Number(g.remaining) === 0,
  }));

  return {
    coupons: couponRows,
    grants: grantRows,
    stats: {
      activeCoupons: couponRows.filter((c) => c.status === 'active').length,
      totalRedemptions: coupons.reduce((a, c) => a + c.timesRedeemed, 0),
      discountGivenKobo: 0, // discount applied to invoices is engine/ledger data
      creditOutstandingKobo: grants.reduce((a, g) => a + Number(g.remaining), 0),
    },
  };
}
