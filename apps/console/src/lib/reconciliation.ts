import { customersTable, settlementsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira, nairaShort } from '@/lib/money';

export type Verification = 'matched' | 'awaiting' | 'failed';
export type ReconStatus = 'reconciled' | 'pending' | 'failed';
export type ReconRow = {
  reference: string;
  customer: string;
  ref: string;
  ver: Verification;
  amount: string;
  status: ReconStatus;
};

export type ReconciliationView = {
  stats: { reconciled30Short: string; matchedCount: number; awaitingCount: number; mismatchCount: number };
  rows: ReconRow[];
  hasSettlements: boolean;
};

const EMPTY: ReconciliationView = {
  stats: { reconciled30Short: nairaShort(0), matchedCount: 0, awaitingCount: 0, mismatchCount: 0 },
  rows: [],
  hasSettlements: false,
};

export async function getReconciliationView(): Promise<ReconciliationView> {
  const session = await getSession();
  if (!session) return EMPTY;

  const settlements = await db
    .select({
      reference: settlementsTable.reference,
      merchantTxRef: settlementsTable.merchantTxRef,
      grossKobo: settlementsTable.grossKobo,
      status: settlementsTable.status,
      createdAt: settlementsTable.createdAt,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
    })
    .from(settlementsTable)
    .innerJoin(customersTable, eq(settlementsTable.customerId, customersTable.id))
    .where(and(eq(settlementsTable.organizationId, session.organizationId), eq(settlementsTable.mode, session.mode)))
    .orderBy(desc(settlementsTable.createdAt));

  if (settlements.length === 0) return EMPTY;

  const thirtyAgo = new Date(Date.now() - 30 * 86_400_000);
  let reconciled30 = 0;
  let matchedCount = 0;
  let awaitingCount = 0;
  let mismatchCount = 0;

  const rows: ReconRow[] = settlements
    .filter((s) => s.status !== 'refunded')
    .map((s) => {
      let ver: Verification;
      let status: ReconStatus;
      let amount: string;
      switch (s.status) {
        case 'reconciled':
          ver = 'matched';
          status = 'reconciled';
          amount = naira(s.grossKobo);
          matchedCount += 1;
          if (s.createdAt > thirtyAgo) reconciled30 += s.grossKobo;
          break;
        case 'settled':
          ver = 'awaiting';
          status = 'pending';
          amount = naira(s.grossKobo);
          awaitingCount += 1;
          break;
        case 'failed':
          ver = 'failed';
          status = 'failed';
          amount = '—';
          mismatchCount += 1;
          break;
        case 'pending':
        default:
          ver = 'awaiting';
          status = 'pending';
          amount = '—';
          awaitingCount += 1;
          break;
      }
      return {
        reference: s.reference,
        customer: s.customerName ?? s.customerEmail,
        ref: s.merchantTxRef,
        ver,
        amount,
        status,
      };
    });

  return {
    stats: { reconciled30Short: nairaShort(reconciled30), matchedCount, awaitingCount, mismatchCount },
    rows,
    hasSettlements: true,
  };
}
