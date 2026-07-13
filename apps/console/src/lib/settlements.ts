import { customersTable, invoicesTable, ledgerAccountsTable, organizationsTable, orgPayoutAccountsTable, payoutsTable, settlementsTable } from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, desc, eq } from 'drizzle-orm';

import { callApi } from '@/lib/api-client';
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

/** The bank account this merchant's revenue is paid into. `null` until they add one. */
export type PayoutAccount = {
  bankName: string;
  accountNumber: string;
  /** Bank-confirmed holder name (name enquiry). Never typed by the merchant. */
  accountName: string;
};

export type SettlementsView = {
  payoutAccount: PayoutAccount | null;
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
  if (!session) return { payoutAccount: null, escrow: emptyEscrow, settlements: [], payouts: [] };

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

  // ⚠ THE BALANCE IS THE LEDGER'S, not a re-derivation.
  //
  // This used to re-add every settlement and subtract every payout to compute the
  // merchant's balance itself — a SECOND source of truth for the one number that matters.
  // The payout path spends the ledger's `tenant_settlement:{ref}` balance, so any drift
  // between the two shows the merchant a figure they cannot actually withdraw (or hides
  // money they can). One number, one place: read the ledger account the payout debits.
  const [org] = await db
    .select({ reference: organizationsTable.reference })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, session.organizationId))
    .limit(1);

  const [ledgerAccount] = org
    ? await db
        .select({ balance: ledgerAccountsTable.balance })
        .from(ledgerAccountsTable)
        .where(
          and(
            eq(ledgerAccountsTable.organizationId, session.organizationId),
            eq(ledgerAccountsTable.mode, session.mode),
            eq(ledgerAccountsTable.key, `tenant_settlement:NBO-${org.reference}`)
          )
        )
        .limit(1)
    : [];

  const balanceKobo = ledgerAccount?.balance ?? 0;

  const [payoutAccountRow] = await db
    .select({
      bankName: orgPayoutAccountsTable.bankName,
      accountNumber: orgPayoutAccountsTable.accountNumber,
      accountName: orgPayoutAccountsTable.accountName,
    })
    .from(orgPayoutAccountsTable)
    .where(
      and(
        eq(orgPayoutAccountsTable.organizationId, session.organizationId),
        eq(orgPayoutAccountsTable.mode, session.mode),
        eq(orgPayoutAccountsTable.isDefault, true),
        eq(orgPayoutAccountsTable.status, 'active')
      )
    )
    .limit(1);

  // The rolling refund hold: revenue collected inside the window can't be withdrawn yet,
  // so a refund can still be clawed back before the merchant drains the balance.
  const holdSince = new Date(Date.now() - 3 * 3_600_000);
  let lockedKobo = 0;
  for (const s of settlements) {
    if ((s.status === 'settled' || s.status === 'reconciled') && s.createdAt > holdSince) {
      lockedKobo += s.netToTenantKobo;
    }
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
    payoutAccount: payoutAccountRow ?? null,
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

/**
 * The NIBSS bank list, from Nomba via our API (`GET /v1/banks`).
 *
 * The withdraw form used to have a free-text "Bank code" input with the placeholder
 * `000013` — a 6-digit NIBSS code that no merchant knows about their own bank, and which
 * silently sends money to the wrong institution when fat-fingered. A dropdown removes
 * the entire class of mistake.
 */
export async function getBanks(): Promise<{ code: string; name: string }[]> {
  const session = await getSession();
  if (!session) return [];
  try {
    const res = await callApi<{ banks: { code: string; name: string }[] }>(session, '/banks');
    return [...res.banks].sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    // A bank-list outage must not take the whole settlements page down — the merchant can
    // still see their balance and their history; only adding a NEW account is blocked.
    return [];
  }
}
