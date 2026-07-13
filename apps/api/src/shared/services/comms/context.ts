import { eq } from 'drizzle-orm';

import {
  customersTable,
  organizationsTable,
  plansTable,
  pricesTable,
  subscriptionsTable,
} from '@nombaone/core-db/schema';

import type { InvoiceRow } from '@nombaone/core-db/schema';
import type { DomainContext, InfraTxScope } from '@nombaone/sara/context';

export interface CommsContext {
  email: string;
  customerName: string;
  planName: string;
  merchantName: string;
}

/**
 * The three names every end-customer email needs — who to mail, what plan, and
 * which merchant it's from. Loaded ONLY on comms-worthy branches (a failure, a
 * reminder, an issued invoice), never on the hot path; a missing row degrades
 * to empty strings and the template copes.
 */
export async function loadCommsContext(
  db: InfraTxScope,
  ctx: DomainContext,
  invoice: Pick<InvoiceRow, 'customerId' | 'subscriptionId'>
): Promise<CommsContext> {
  const [customer] = await db
    .select({ email: customersTable.email, name: customersTable.name })
    .from(customersTable)
    .where(eq(customersTable.id, invoice.customerId))
    .limit(1);

  const [org] = await db
    .select({ name: organizationsTable.name })
    .from(organizationsTable)
    .where(eq(organizationsTable.id, ctx.organizationId))
    .limit(1);

  let planName = '';
  if (invoice.subscriptionId) {
    const [row] = await db
      .select({ planName: plansTable.name })
      .from(subscriptionsTable)
      .innerJoin(pricesTable, eq(pricesTable.id, subscriptionsTable.priceId))
      .innerJoin(plansTable, eq(plansTable.id, pricesTable.planId))
      .where(eq(subscriptionsTable.id, invoice.subscriptionId))
      .limit(1);
    planName = row?.planName ?? '';
  }

  return {
    email: customer?.email ?? '',
    customerName: customer?.name ?? '',
    planName,
    merchantName: org?.name ?? '',
  };
}
