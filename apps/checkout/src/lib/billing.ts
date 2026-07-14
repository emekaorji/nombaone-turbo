import 'server-only';

import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm';

import {
  customersTable,
  invoiceLineItemsTable,
  invoicesTable,
  organizationsTable,
  paymentMethodsTable,
  subscriptionsTable,
  type InvoiceRow,
} from '@nombaone/core-db/schema';

import { db } from './db';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * REFERENCE-ONLY RESOLVERS for the END-CUSTOMER billing pages (`/i`, `/pm`).
 *
 * Same paradigm as `./payment.ts`: the checkout has no caller to pin a tenant,
 * so the resource's globally-unique public reference IS the lookup key, and the
 * (org, mode) scope is read OFF the trusted row — never from the URL beyond
 * "this exact reference exists". Here the reference arrives one step more
 * guarded still: it is extracted from a SIGNED, EXPIRING action token
 * (`lib/action-token.ts`), so even the reference itself was minted by apps/api,
 * not typed by a visitor.
 *
 * These are READ-ONLY projections. All writes on these resources (collection,
 * card swaps, dunning re-attempts) belong to apps/api's money engine; the
 * checkout renders state and hands off to Nomba's hosted pages via the
 * `checkoutLink` the engine stamped into `invoices.metadata`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Invoice money-state, derived from timestamp signals — mirrors the engine's
 * `deriveInvoiceStatus` (apps/api invoices/status.ts): there is no stored
 * status column to drift, and precedence is void → uncollectible → paid →
 * draft/partially_paid/open. */
export type InvoiceViewStatus =
  | 'draft'
  | 'open'
  | 'partially_paid'
  | 'paid'
  | 'void'
  | 'uncollectible';

function deriveInvoiceStatus(
  row: Pick<
    InvoiceRow,
    'finalizedAt' | 'voidedAt' | 'paidAt' | 'uncollectibleAt' | 'amountDue' | 'amountPaid'
  >
): InvoiceViewStatus {
  if (row.voidedAt) return 'void';
  if (row.uncollectibleAt) return 'uncollectible';
  if (row.paidAt) return 'paid';
  if (!row.finalizedAt) return 'draft';
  if (row.amountDue === 0) return 'paid';
  if (row.amountPaid > 0) return 'partially_paid';
  return 'open';
}

/** Bank-transfer (NUBAN) instructions the push rail stamped into
 * `invoices.metadata.payInstructions`. Shape-checked out of the jsonb —
 * mirrors the API serializer — so a hand-edited row can't leak garbage. */
export interface PayInstructionsView {
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  amountInKobo: number;
  reference: string | null;
}

function payInstructionsOf(
  metadata: Record<string, unknown> | null,
  amountDue: number
): PayInstructionsView | null {
  const raw = metadata?.payInstructions;
  if (raw == null || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  return {
    bankName: typeof p.bankName === 'string' ? p.bankName : null,
    accountNumber: typeof p.accountNumber === 'string' ? p.accountNumber : null,
    accountName: typeof p.accountName === 'string' ? p.accountName : null,
    amountInKobo: typeof p.amountKobo === 'number' ? p.amountKobo : amountDue,
    reference: typeof p.reference === 'string' ? p.reference : null,
  };
}

function checkoutLinkOf(metadata: Record<string, unknown> | null): string | null {
  const raw = metadata?.checkoutLink;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

export interface InvoiceLineView {
  id: string;
  description: string;
  amountInKobo: number;
  quantity: number;
}

/** Everything the `/i/<token>` page renders — public-safe fields only. */
export interface InvoiceView {
  reference: string;
  status: InvoiceViewStatus;
  totalInKobo: number;
  amountDueInKobo: number;
  amountPaidInKobo: number;
  amountRemainingInKobo: number;
  currency: string;
  dueDate: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  /** Nomba hosted-checkout link stamped by the engine — the "Pay now" target. */
  checkoutLink: string | null;
  /** NUBAN block for send_invoice / transfer collection, when stamped. */
  payInstructions: PayInstructionsView | null;
  lines: InvoiceLineView[];
  merchant: { name: string; reference: string };
}

/** Resolve an invoice for the pay page by its (token-authorized) reference.
 * Columns are selected EXPLICITLY (never the whole table object) so the public
 * page keeps working when the code schema is ahead of the deployed database
 * mid-migration. */
export async function getInvoiceView(reference: string): Promise<InvoiceView | null> {
  const [row] = await db
    .select({
      invoice: {
        id: invoicesTable.id,
        reference: invoicesTable.reference,
        organizationId: invoicesTable.organizationId,
        mode: invoicesTable.mode,
        total: invoicesTable.total,
        amountDue: invoicesTable.amountDue,
        amountPaid: invoicesTable.amountPaid,
        amountRemaining: invoicesTable.amountRemaining,
        currency: invoicesTable.currency,
        dueDate: invoicesTable.dueDate,
        finalizedAt: invoicesTable.finalizedAt,
        voidedAt: invoicesTable.voidedAt,
        paidAt: invoicesTable.paidAt,
        uncollectibleAt: invoicesTable.uncollectibleAt,
        createdAt: invoicesTable.createdAt,
        metadata: invoicesTable.metadata,
      },
      orgName: organizationsTable.name,
      orgReference: organizationsTable.reference,
    })
    .from(invoicesTable)
    .innerJoin(organizationsTable, eq(invoicesTable.organizationId, organizationsTable.id))
    .where(eq(invoicesTable.reference, reference))
    .limit(1);
  if (!row) return null;

  const invoice = row.invoice;
  const lines = await db
    .select({
      reference: invoiceLineItemsTable.reference,
      description: invoiceLineItemsTable.description,
      amount: invoiceLineItemsTable.amount,
      quantity: invoiceLineItemsTable.quantity,
    })
    .from(invoiceLineItemsTable)
    .where(
      and(
        eq(invoiceLineItemsTable.organizationId, invoice.organizationId),
        eq(invoiceLineItemsTable.mode, invoice.mode),
        eq(invoiceLineItemsTable.invoiceId, invoice.id)
      )
    )
    .orderBy(invoiceLineItemsTable.createdAt);

  return {
    reference: invoice.reference,
    status: deriveInvoiceStatus(invoice),
    totalInKobo: invoice.total,
    amountDueInKobo: invoice.amountDue,
    amountPaidInKobo: invoice.amountPaid,
    amountRemainingInKobo: invoice.amountRemaining,
    currency: invoice.currency,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    createdAt: invoice.createdAt,
    checkoutLink: checkoutLinkOf(invoice.metadata as Record<string, unknown> | null),
    payInstructions: payInstructionsOf(
      invoice.metadata as Record<string, unknown> | null,
      invoice.amountDue
    ),
    lines: lines.map((l) => ({
      id: l.reference,
      description: l.description,
      amountInKobo: l.amount,
      quantity: l.quantity,
    })),
    merchant: { name: row.orgName, reference: row.orgReference },
  };
}

/** Everything the `/pm/<token>` page renders — public-safe fields only. */
export interface SubscriptionPmView {
  reference: string;
  status: string;
  customerName: string;
  merchant: { name: string; reference: string };
  /** The card currently billing the subscription (display fields only). */
  currentMethod: {
    kind: string;
    brand: string | null;
    last4: string | null;
    expMonth: number | null;
    expYear: number | null;
    status: string;
  } | null;
  /** The latest OPEN invoice's stamped hosted-checkout link, when present —
   * paying there captures a fresh card and swaps it in server-side. */
  openInvoiceCheckoutLink: string | null;
}

/** Resolve a subscription for the update-payment-method page by its
 * (token-authorized) reference. Columns are selected EXPLICITLY (never the
 * whole table object) so the public page keeps working when the code schema is
 * ahead of the deployed database mid-migration. */
export async function getSubscriptionPmView(reference: string): Promise<SubscriptionPmView | null> {
  const [row] = await db
    .select({
      sub: {
        id: subscriptionsTable.id,
        reference: subscriptionsTable.reference,
        organizationId: subscriptionsTable.organizationId,
        mode: subscriptionsTable.mode,
        status: subscriptionsTable.status,
        defaultPaymentMethodId: subscriptionsTable.defaultPaymentMethodId,
      },
      customerName: customersTable.name,
      orgName: organizationsTable.name,
      orgReference: organizationsTable.reference,
    })
    .from(subscriptionsTable)
    .innerJoin(customersTable, eq(subscriptionsTable.customerId, customersTable.id))
    .innerJoin(organizationsTable, eq(subscriptionsTable.organizationId, organizationsTable.id))
    .where(eq(subscriptionsTable.reference, reference))
    .limit(1);
  if (!row) return null;

  const sub = row.sub;

  let currentMethod: SubscriptionPmView['currentMethod'] = null;
  if (sub.defaultPaymentMethodId) {
    const [pm] = await db
      .select({
        kind: paymentMethodsTable.kind,
        brand: paymentMethodsTable.brand,
        last4: paymentMethodsTable.last4,
        expMonth: paymentMethodsTable.expMonth,
        expYear: paymentMethodsTable.expYear,
        status: paymentMethodsTable.status,
      })
      .from(paymentMethodsTable)
      .where(eq(paymentMethodsTable.id, sub.defaultPaymentMethodId))
      .limit(1);
    currentMethod = pm ?? null;
  }

  // The latest OPEN invoice (finalized, unpaid, not void/uncollectible) may
  // carry the engine-stamped hosted-checkout link — the honest read-only path
  // to "complete payment / update card" today.
  const [openInvoice] = await db
    .select({ metadata: invoicesTable.metadata })
    .from(invoicesTable)
    .where(
      and(
        eq(invoicesTable.organizationId, sub.organizationId),
        eq(invoicesTable.mode, sub.mode),
        eq(invoicesTable.subscriptionId, sub.id),
        isNotNull(invoicesTable.finalizedAt),
        isNull(invoicesTable.paidAt),
        isNull(invoicesTable.voidedAt),
        isNull(invoicesTable.uncollectibleAt)
      )
    )
    .orderBy(desc(invoicesTable.createdAt))
    .limit(1);

  return {
    reference: sub.reference,
    status: sub.status,
    customerName: row.customerName,
    merchant: { name: row.orgName, reference: row.orgReference },
    currentMethod,
    openInvoiceCheckoutLink: openInvoice
      ? checkoutLinkOf(openInvoice.metadata as Record<string, unknown> | null)
      : null,
  };
}
