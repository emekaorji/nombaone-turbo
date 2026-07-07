import { customersTable, invoicesTable, payoutsTable, settlementsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira, nairaShort } from '@/lib/money';

export type SettlementStatus = 'settled' | 'reconciled' | 'pending' | 'refunded' | 'failed';
export type SettlementRow = {
  reference: string;
  customer: string;
  inv: string;
  gross: string;
  fee: string;
  net: string;
  status: SettlementStatus;
  settled: string;
};

export type PayoutStatus = 'pending' | 'ledger_posted' | 'succeeded' | 'failed';
export type PayoutRow = {
  reference: string;
  destination: string;
  bank: string;
  amount: string;
  status: PayoutStatus;
  created: string;
};

export type SettlementsView = {
  escrow: {
    balanceKobo: number;
    lockedKobo: number;
    availableKobo: number;
    availableShort: string;
    balance: string;
    locked: string;
    available: string;
    bar: { grow: number; c: string }[];
  };
  settlements: SettlementRow[];
  payouts: PayoutRow[];
};

function shortDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function settlementStatus(s: string): SettlementStatus {
  switch (s) {
    case 'settled':
    case 'reconciled':
    case 'pending':
    case 'refunded':
    case 'failed':
      return s;
    default:
      return 'pending';
  }
}

function payoutStatus(s: string): PayoutStatus {
  switch (s) {
    case 'pending':
    case 'ledger_posted':
    case 'succeeded':
    case 'failed':
      return s;
    default:
      return 'pending';
  }
}

export async function getSettlementsView(): Promise<SettlementsView> {
  const session = await getSession();
  const emptyEscrow = {
    balanceKobo: 0,
    lockedKobo: 0,
    availableKobo: 0,
    availableShort: nairaShort(0),
    balance: naira(0),
    locked: naira(0),
    available: naira(0),
    bar: [{ grow: 0, c: 'bg-accent' }, { grow: 0, c: 'bg-warning' }],
  };
  if (!session) return { escrow: emptyEscrow, settlements: [], payouts: [] };

  const [settlements, payouts] = await Promise.all([
    db
      .select({
        reference: settlementsTable.reference,
        grossKobo: settlementsTable.grossKobo,
        platformFeeKobo: settlementsTable.platformFeeKobo,
        netToTenantKobo: settlementsTable.netToTenantKobo,
        status: settlementsTable.status,
        createdAt: settlementsTable.createdAt,
        invoiceRef: invoicesTable.reference,
        customerName: customersTable.name,
        customerEmail: customersTable.email,
      })
      .from(settlementsTable)
      .innerJoin(invoicesTable, eq(settlementsTable.invoiceId, invoicesTable.id))
      .innerJoin(customersTable, eq(settlementsTable.customerId, customersTable.id))
      .where(and(eq(settlementsTable.organizationId, session.organizationId), eq(settlementsTable.mode, session.mode)))
      .orderBy(desc(settlementsTable.createdAt)),
    db
      .select({
        reference: payoutsTable.reference,
        amountKobo: payoutsTable.amountKobo,
        bankCode: payoutsTable.bankCode,
        accountNumber: payoutsTable.accountNumber,
        resolvedAccountName: payoutsTable.resolvedAccountName,
        status: payoutsTable.status,
        createdAt: payoutsTable.createdAt,
      })
      .from(payoutsTable)
      .where(and(eq(payoutsTable.organizationId, session.organizationId), eq(payoutsTable.mode, session.mode)))
      .orderBy(desc(payoutsTable.createdAt)),
  ]);

  // Escrow model (from the payout doc): withdrawable = balance − lockedLast3h.
  const threeHoursAgo = new Date(Date.now() - 3 * 3_600_000);
  let balanceKobo = 0;
  let lockedKobo = 0;
  for (const s of settlements) {
    if (s.status === 'settled' || s.status === 'reconciled') {
      balanceKobo += s.netToTenantKobo;
      if (s.createdAt > threeHoursAgo) lockedKobo += s.netToTenantKobo;
    }
  }
  for (const p of payouts) {
    if (p.status === 'ledger_posted' || p.status === 'succeeded') balanceKobo -= p.amountKobo;
  }
  const availableKobo = Math.max(0, balanceKobo - lockedKobo);

  const settlementRows: SettlementRow[] = settlements.map((s) => ({
    reference: s.reference,
    customer: s.customerName ?? s.customerEmail,
    inv: s.invoiceRef,
    gross: naira(s.grossKobo),
    fee: naira(s.platformFeeKobo),
    net: naira(s.netToTenantKobo),
    status: settlementStatus(s.status),
    settled: shortDate(s.createdAt),
  }));

  const payoutRows: PayoutRow[] = payouts.map((p) => ({
    reference: p.reference,
    destination: `${p.resolvedAccountName ?? 'Bank account'} ·${p.accountNumber.slice(-4)}`,
    bank: p.bankCode,
    amount: naira(p.amountKobo),
    status: payoutStatus(p.status),
    created: shortDate(p.createdAt),
  }));

  return {
    escrow: {
      balanceKobo,
      lockedKobo,
      availableKobo,
      availableShort: nairaShort(availableKobo),
      balance: naira(balanceKobo),
      locked: naira(lockedKobo),
      available: naira(availableKobo),
      bar: [
        { grow: Math.max(availableKobo, 0), c: 'bg-accent' },
        { grow: Math.max(lockedKobo, 0), c: 'bg-warning' },
      ],
    },
    settlements: settlementRows,
    payouts: payoutRows,
  };
}
