import {
  customersTable,
  invoiceLineItemsTable,
  invoicesTable,
  ledgerAccountsTable,
  ledgerEntriesTable,
  paymentMethodsTable,
  settlementsTable,
  subscriptionsTable,
} from '@nombaone/core-db';
import { db } from '@nombaone/core-db/serverless';
import { and, eq } from 'drizzle-orm';

import { getSession } from '@/lib/auth';
import { naira } from '@/lib/money';

export type InvoiceDetailStatus = 'paid' | 'open' | 'partially_paid' | 'uncollectible' | 'void';

export type LedgerLeg = { account: string; debit: string; credit: string };
export type SettlementSplit = { grossKobo: number; feeKobo: number; netKobo: number } | null;

export type InvoiceDetail = {
  reference: string;
  amount: string;
  status: InvoiceDetailStatus;
  statusLabel: string;
  subtitle: string;
  breakdown: { label: string; value: string; divTop: boolean; bold: boolean; good?: boolean }[];
  lineItems: { desc: string; qty: string; amount: string }[];
  totalLabel: string;
  details: { label: string; value: string; tone?: 'success' | 'warning' | 'danger' }[];
  payment: { label: string; value: string }[];
  ledger: { txnReference: string; legs: LedgerLeg[]; balanced: boolean } | null;
  split: SettlementSplit;
};

function shortDate(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function dateTime(d: Date | null): string {
  if (!d) return '—';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusOf(r: {
  finalizedAt: Date | null;
  voidedAt: Date | null;
  paidAt: Date | null;
  uncollectibleAt: Date | null;
  amountPaid: number;
  amountRemaining: number;
}): { status: InvoiceDetailStatus; label: string; tone: 'success' | 'warning' | 'danger' } {
  if (r.voidedAt) return { status: 'void', label: 'Void', tone: 'warning' };
  if (r.uncollectibleAt) return { status: 'uncollectible', label: 'Uncollectible', tone: 'danger' };
  if (r.paidAt || (r.finalizedAt && r.amountRemaining === 0)) return { status: 'paid', label: 'Paid', tone: 'success' };
  if (r.finalizedAt && r.amountPaid > 0 && r.amountRemaining > 0)
    return { status: 'partially_paid', label: 'Partially paid', tone: 'warning' };
  return { status: 'open', label: 'Open', tone: 'warning' };
}

export async function getInvoiceDetail(reference: string): Promise<InvoiceDetail | null> {
  const session = await getSession();
  if (!session) return null;

  const [inv] = await db
    .select({
      id: invoicesTable.id,
      reference: invoicesTable.reference,
      billingReason: invoicesTable.billingReason,
      currency: invoicesTable.currency,
      subtotal: invoicesTable.subtotal,
      discountTotal: invoicesTable.discountTotal,
      creditTotal: invoicesTable.creditTotal,
      total: invoicesTable.total,
      amountDue: invoicesTable.amountDue,
      amountPaid: invoicesTable.amountPaid,
      amountRemaining: invoicesTable.amountRemaining,
      finalizedAt: invoicesTable.finalizedAt,
      voidedAt: invoicesTable.voidedAt,
      paidAt: invoicesTable.paidAt,
      uncollectibleAt: invoicesTable.uncollectibleAt,
      createdAt: invoicesTable.createdAt,
      ledgerTransactionId: invoicesTable.ledgerTransactionId,
      customerName: customersTable.name,
      customerEmail: customersTable.email,
      subscriptionRef: subscriptionsTable.reference,
      pmKind: paymentMethodsTable.kind,
      pmBrand: paymentMethodsTable.brand,
      pmLast4: paymentMethodsTable.last4,
    })
    .from(invoicesTable)
    .innerJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .leftJoin(subscriptionsTable, eq(invoicesTable.subscriptionId, subscriptionsTable.id))
    .leftJoin(paymentMethodsTable, eq(subscriptionsTable.defaultPaymentMethodId, paymentMethodsTable.id))
    .where(
      and(
        eq(invoicesTable.organizationId, session.organizationId),
        eq(invoicesTable.mode, session.mode),
        eq(invoicesTable.reference, reference),
      ),
    );

  if (!inv) return null;

  const st = statusOf(inv);
  const customerName = inv.customerName ?? inv.customerEmail;

  const lineItems = await db
    .select({
      description: invoiceLineItemsTable.description,
      amount: invoiceLineItemsTable.amount,
      quantity: invoiceLineItemsTable.quantity,
    })
    .from(invoiceLineItemsTable)
    .where(and(eq(invoiceLineItemsTable.organizationId, session.organizationId), eq(invoiceLineItemsTable.invoiceId, inv.id)));

  // Ledger receipt — only if this invoice posted a transaction.
  let ledger: InvoiceDetail['ledger'] = null;
  if (inv.ledgerTransactionId) {
    const entries = await db
      .select({
        direction: ledgerEntriesTable.direction,
        amount: ledgerEntriesTable.amount,
        accountKey: ledgerAccountsTable.key,
        accountKind: ledgerAccountsTable.kind,
      })
      .from(ledgerEntriesTable)
      .innerJoin(ledgerAccountsTable, eq(ledgerEntriesTable.accountId, ledgerAccountsTable.id))
      .where(eq(ledgerEntriesTable.transactionId, inv.ledgerTransactionId));
    if (entries.length > 0) {
      let debitSum = 0;
      let creditSum = 0;
      const legs: LedgerLeg[] = entries.map((e) => {
        if (e.direction === 'debit') debitSum += e.amount;
        else creditSum += e.amount;
        return {
          account: (e.accountKey ?? e.accountKind).replace(/_/g, ' '),
          debit: e.direction === 'debit' ? naira(e.amount) : '—',
          credit: e.direction === 'credit' ? naira(e.amount) : '—',
        };
      });
      ledger = { txnReference: 'charge', legs, balanced: debitSum === creditSum };
    }
  }

  // Settlement split — only if this invoice settled.
  const [settlement] = await db
    .select({
      grossKobo: settlementsTable.grossKobo,
      platformFeeKobo: settlementsTable.platformFeeKobo,
      netToTenantKobo: settlementsTable.netToTenantKobo,
      merchantTxRef: settlementsTable.merchantTxRef,
    })
    .from(settlementsTable)
    .where(
      and(
        eq(settlementsTable.organizationId, session.organizationId),
        eq(settlementsTable.mode, session.mode),
        eq(settlementsTable.invoiceId, inv.id),
      ),
    );

  const split: SettlementSplit = settlement
    ? { grossKobo: settlement.grossKobo, feeKobo: settlement.platformFeeKobo, netKobo: settlement.netToTenantKobo }
    : null;

  const railLabel =
    inv.pmKind === 'card'
      ? `${inv.pmBrand ?? 'Card'} ·${inv.pmLast4 ?? '••••'}`
      : inv.pmKind === 'mandate'
        ? 'Direct debit'
        : inv.pmKind === 'virtual_account'
          ? 'Bank transfer'
          : '—';

  return {
    reference: inv.reference,
    amount: naira(inv.total),
    status: st.status,
    statusLabel: st.label,
    subtitle: `${inv.reference} · ${customerName}${inv.subscriptionRef ? ` · ${inv.billingReason.replace(/_/g, ' ')}` : ''}`,
    breakdown: [
      { label: 'Subtotal', value: naira(inv.subtotal), divTop: false, bold: false },
      { label: 'Discount', value: `−${naira(inv.discountTotal)}`, divTop: false, bold: false },
      { label: 'Credit applied', value: `−${naira(inv.creditTotal)}`, divTop: false, bold: false },
      { label: 'Amount due', value: naira(inv.amountDue), divTop: true, bold: true },
      { label: 'Amount paid', value: naira(inv.amountPaid), divTop: true, bold: false },
      { label: 'Amount remaining', value: naira(inv.amountRemaining), divTop: false, bold: false, good: inv.amountRemaining === 0 },
    ],
    lineItems:
      lineItems.length > 0
        ? lineItems.map((l) => ({ desc: l.description, qty: String(l.quantity), amount: naira(l.amount) }))
        : [{ desc: inv.billingReason.replace(/_/g, ' '), qty: '1', amount: naira(inv.total) }],
    totalLabel: naira(inv.total),
    details: [
      { label: 'Status', value: st.label, tone: st.tone },
      { label: 'Customer', value: customerName },
      { label: 'Subscription', value: inv.subscriptionRef ?? '—' },
      { label: 'Reason', value: inv.billingReason },
      { label: 'Currency', value: inv.currency },
      { label: 'Issued', value: shortDate(inv.finalizedAt ?? inv.createdAt) },
    ],
    payment: [
      { label: 'Method', value: railLabel },
      { label: 'Paid at', value: inv.paidAt ? dateTime(inv.paidAt) : 'Not yet paid' },
      { label: 'Settlement ref', value: settlement?.merchantTxRef ?? '—' },
    ],
    ledger,
    split,
  };
}
