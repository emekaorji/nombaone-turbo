/* eslint-disable import/order */
// Confirm an invoice settled: paidAt set, amountPaid, ledger link, + its domain events.
//   npx tsx scripts/check-invoice.ts <invoiceRef>
import '../src/shared/config/env'; // load .env before the db pool binds

import { desc, eq } from 'drizzle-orm';

import { db } from '../src/shared/config/db';
import { domainEventsTable, invoicesTable } from '@nombaone/core-db/schema';

async function main(): Promise<void> {
  const ref = process.argv[2] ?? '';
  const [inv] = await db.select().from(invoicesTable).where(eq(invoicesTable.reference, ref)).limit(1);
  if (!inv) {
    console.log('INVOICE NOT FOUND:', ref);
    process.exit(0);
  }
  console.log(
    'INVOICE=',
    JSON.stringify(
      {
        reference: inv.reference,
        amountDueKobo: inv.amountDue,
        amountPaidKobo: inv.amountPaid,
        paidAt: inv.paidAt,
        ledgerTransactionId: inv.ledgerTransactionId,
        SETTLED: inv.paidAt != null,
      },
      null,
      2
    )
  );
  const events = await db
    .select({ type: domainEventsTable.type, createdAt: domainEventsTable.createdAt })
    .from(domainEventsTable)
    .where(eq(domainEventsTable.organizationId, inv.organizationId))
    .orderBy(desc(domainEventsTable.createdAt))
    .limit(8);
  console.log('RECENT_EVENTS=', events.map((e) => e.type).join(', '));
  process.exit(0);
}
main().catch((e) => {
  console.error('CHECK_ERR=', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
