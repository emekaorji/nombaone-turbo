/* eslint-disable import/order */
// Show the origin + paid state of invoices to distinguish hosted-checkout (Live E2E Org)
// from tokenized recharge (Renewal*).  npx tsx scripts/inspect-inv.ts [ref]
import '../src/shared/config/env';

import { desc, eq } from 'drizzle-orm';

import { db } from '../src/shared/config/db';
import { customersTable, invoicesTable, organizationsTable } from '@nombaone/core-db/schema';

async function main(): Promise<void> {
  const ref = process.argv[2];
  const rows = await db
    .select({
      reference: invoicesTable.reference,
      org: organizationsTable.name,
      billingReason: invoicesTable.billingReason,
      amountDue: invoicesTable.amountDue,
      amountPaid: invoicesTable.amountPaid,
      paidAt: invoicesTable.paidAt,
      email: customersTable.email,
      createdAt: invoicesTable.createdAt,
    })
    .from(invoicesTable)
    .leftJoin(organizationsTable, eq(invoicesTable.organizationId, organizationsTable.id))
    .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
    .orderBy(desc(invoicesTable.createdAt))
    .limit(30);

  for (const r of rows) {
    if (ref && r.reference !== ref) continue;
    console.log(JSON.stringify(r));
  }
  process.exit(0);
}
main().catch((e) => {
  console.error('INV_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
