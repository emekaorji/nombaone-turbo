import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { customersTable, invoicesTable } from '@nombaone/core-db/schema';
import { createCustomer } from '@shared/services/customers';
import { mintReference } from '@nombaone/sara/reference';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient, RequeryResult } from '@nombaone/sara/nomba';

/**
 * Item 6 — the nightly local↔Nomba reconcile cron. Drives `handleReconcileNomba`
 * directly with a fake Nomba whose requery result is scripted per reference, over
 * three seeded invoices:
 *   • A — locally paid, Nomba agrees (amount matches)      → no discrepancy
 *   • B — locally paid, Nomba has no record                → flagged (local_paid_missing_at_nomba)
 *   • C — locally UNPAID (finalized), Nomba says succeeded  → self-healed → paid
 */
describe('reconcile-nomba cron (item 6)', () => {
  let harness: Harness;
  let ctx: { organizationId: string; mode: 'sandbox' };
  let customerId: string;

  // reference → the requery Nomba should return for it.
  const requeryScript = new Map<string, RequeryResult>();

  const fakeNomba: NombaClient = {
    getToken: async () => 'tok',
    async request<T = unknown>() {
      return { status: 200, ok: true, pending: false, data: {} as T };
    },
    requeryTransaction: async (_ctx, { reference }) =>
      requeryScript.get(reference) ?? { found: false, succeeded: false },
  };

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    const org = await harness.seedOrg('Recon');
    ctx = { organizationId: org.organizationId, mode: 'sandbox' };
    const customer = await createCustomer(harness.db, ctx, { email: 'r@acme.test', name: 'R' });
    const [c] = await harness.db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(and(eq(customersTable.organizationId, ctx.organizationId), eq(customersTable.reference, customer.id)))
      .limit(1);
    customerId = c!.id;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const seedInvoice = async (amountDue: number, opts: { paid: boolean }): Promise<string> => {
    const reference = mintReference('INV');
    await harness.db.insert(invoicesTable).values({
      reference,
      organizationId: ctx.organizationId,
      mode: 'sandbox',
      customerId,
      billingReason: 'manual',
      subtotal: amountDue,
      total: amountDue,
      amountDue,
      amountPaid: opts.paid ? amountDue : 0,
      finalizedAt: new Date(),
      paidAt: opts.paid ? new Date() : null,
    });
    return reference;
  };

  it('flags a local-paid-but-missing-at-Nomba invoice and self-heals a settled-at-Nomba one', async () => {
    const refA = await seedInvoice(10_000, { paid: true }); // Nomba agrees
    const refB = await seedInvoice(20_000, { paid: true }); // Nomba has no record → flag
    const refC = await seedInvoice(50_000, { paid: false }); // succeeded at Nomba → self-heal

    requeryScript.set(refA, { found: true, succeeded: true, amount: 10_000, providerReference: 'nomba_A' });
    // refB intentionally has NO script entry → requery returns { found:false } → discrepancy
    requeryScript.set(refC, { found: true, succeeded: true, amount: 50_000, providerReference: 'nomba_C' });

    const { handleReconcileNomba } = await import(
      '../../src/services/worker/modules/cron/jobs-handlers/reconcile-nomba'
    );
    const result = await handleReconcileNomba();

    expect(result.skipped).toBeFalsy();
    expect(result.tenants).toBe(1);
    expect(result.checked).toBeGreaterThanOrEqual(3);
    // B (local-paid-missing) + C (settled-at-nomba-missing-locally) are both discrepancies.
    expect(result.discrepancies).toBeGreaterThanOrEqual(2);
    expect(result.healed).toBe(1);

    // C was actually settled locally (self-heal drove confirmInvoiceFromWebhook).
    const [healed] = await harness.db
      .select({ paidAt: invoicesTable.paidAt })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, ctx.organizationId), eq(invoicesTable.reference, refC)))
      .limit(1);
    expect(healed!.paidAt).not.toBeNull();

    // A stays paid, untouched; B stays paid locally (flagged, not mutated).
    const [b] = await harness.db
      .select({ paidAt: invoicesTable.paidAt })
      .from(invoicesTable)
      .where(and(eq(invoicesTable.organizationId, ctx.organizationId), eq(invoicesTable.reference, refB)))
      .limit(1);
    expect(b!.paidAt).not.toBeNull();

    // idempotent: a second run heals nothing new (C is already paid).
    const again = await handleReconcileNomba();
    expect(again.healed).toBe(0);
  });
});
