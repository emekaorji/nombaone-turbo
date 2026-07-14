import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { customersTable, domainEventsTable, paymentMethodsTable } from '@nombaone/core-db/schema';
import { createCustomer } from '@shared/services/customers';
import { pollMandateActive, selectPendingMandates } from '@shared/services/payment-methods';
import { mintReference } from '@nombaone/sara/reference';

import { startHarness, type Harness } from '../helpers/harness';

import type { NombaClient, NombaRequest } from '@nombaone/sara/nomba';

// direct-debits/status → ACTIVE + ADVICE_SENT so a poll promotes the mandate.
const fakeNomba: NombaClient = {
  getToken: async () => 'tok',
  listTokenizedCards: async () => [],
  async request<T = unknown>(req: NombaRequest) {
    if (req.endpoint.includes('direct-debits/status')) {
      return { status: 200, ok: true, pending: false, data: { mandateStatus: 'Active', mandateAdviceStatus: 'Advice Sent' } as T };
    }
    return { status: 200, ok: true, pending: false, data: {} as T };
  },
  requeryTransaction: async () => ({ found: true, succeeded: true, amount: 0 }),
};

describe('mandate activation sweep e2e (direct debit)', () => {
  let harness: Harness;
  let ctxA: { organizationId: string; mode: 'sandbox' };
  let seq = 0;
  const uniq = (): string => `${Date.now()}-${seq++}`;

  beforeAll(async () => {
    harness = await startHarness();
    harness.setNombaClient(fakeNomba);
    const orgA = await harness.seedOrg('Mandate A');
    ctxA = { organizationId: orgA.organizationId, mode: 'sandbox' };
  });

  afterAll(async () => {
    await harness?.stop();
  });

  async function newCustomerId(): Promise<string> {
    const customer = await createCustomer(harness.db, ctxA, { email: `m${uniq()}@acme.test`, name: 'C' });
    const [c] = await harness.db.select({ id: customersTable.id }).from(customersTable)
      .where(and(eq(customersTable.organizationId, ctxA.organizationId), eq(customersTable.reference, customer.id))).limit(1);
    return c!.id;
  }

  it('selectPendingMandates returns only consent_pending mandates, and a poll promotes one to active', async () => {
    const pendingRef = mintReference('PMT');
    const activeRef = mintReference('PMT');
    const cardRef = mintReference('PMT');
    const cid = await newCustomerId();
    await harness.db.insert(paymentMethodsTable).values([
      { reference: pendingRef, organizationId: ctxA.organizationId, mode: 'sandbox', customerId: cid, kind: 'mandate', status: 'consent_pending', mandateId: 'md_pending' },
      { reference: activeRef, organizationId: ctxA.organizationId, mode: 'sandbox', customerId: cid, kind: 'mandate', status: 'active', mandateId: 'md_active' },
      { reference: cardRef, organizationId: ctxA.organizationId, mode: 'sandbox', customerId: cid, kind: 'card', status: 'active', tokenKey: 'tok' },
    ]);

    const pending = await selectPendingMandates(harness.db, 'sandbox', 100);
    const refs = pending.map((p) => p.reference);
    expect(refs).toContain(pendingRef);
    expect(refs).not.toContain(activeRef); // already active
    expect(refs).not.toContain(cardRef); // not a mandate

    // The sweep's inner step: poll the pending mandate → ACTIVE + ADVICE_SENT promotes it.
    const promoted = await pollMandateActive(fakeNomba, harness.db, ctxA, { reference: pendingRef });
    expect(promoted.status).toBe('active');

    const [row] = await harness.db.select().from(paymentMethodsTable).where(eq(paymentMethodsTable.reference, pendingRef));
    expect(row!.status).toBe('active');
    // payment_method.updated emitted for the promotion.
    const events = await harness.db.select({ type: domainEventsTable.type, payload: domainEventsTable.payload })
      .from(domainEventsTable).where(eq(domainEventsTable.organizationId, ctxA.organizationId));
    expect(events.some((e) => e.type === 'payment_method.updated' && (e.payload as { reference?: string }).reference === pendingRef)).toBe(true);

    // It is no longer pending.
    expect((await selectPendingMandates(harness.db, 'sandbox', 100)).map((p) => p.reference)).not.toContain(pendingRef);
  });
});
