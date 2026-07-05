import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { customersTable, organizationsTable } from '@nombaone/core-db/schema';
import { runWithModeContext } from '@nombaone/core-db/rls';
import { createCustomer } from '@shared/services/customers';

import { startHarness, type Harness } from '../helpers/harness';

/**
 * Phase 4 — Postgres Row-Level Security is the REAL mode-isolation boundary
 * beneath the query-layer `WHERE mode = ctx.mode` filters. Migration 0016 enables
 * RLS + a `mode_isolation` policy on every mode-scoped table and creates a
 * non-owner `nombaone_rls` role that IS subject to it.
 *
 * The app connects as the table owner, which BYPASSES RLS — so these tests
 * assume that role and then `SET LOCAL ROLE nombaone_rls` inside a transaction to
 * observe the policy exactly as a hardened (non-owner) production role would. One
 * org holds a sandbox AND a live customer; a raw `SELECT` with NO mode filter must
 * return only the current `app.mode` slice, and none when the GUC is unset.
 */
describe('RLS mode isolation (Phase 4)', () => {
  let harness: Harness;
  let orgId: string;

  const rowsOf = (result: unknown): Array<Record<string, unknown>> => {
    const r = result as { rows?: Array<Record<string, unknown>> };
    return Array.isArray(r.rows) ? r.rows : (result as Array<Record<string, unknown>>);
  };

  beforeAll(async () => {
    harness = await startHarness();
    const org = await harness.seedOrg('RLS Iso');
    orgId = org.organizationId;
    // One org, both modes — the whole point is that these coexist in ONE table.
    await createCustomer(harness.db, { organizationId: orgId, mode: 'sandbox' }, {
      email: 'sandbox@rls.test',
      name: 'Sandbox Cust',
    });
    await createCustomer(harness.db, { organizationId: orgId, mode: 'live' }, {
      email: 'live@rls.test',
      name: 'Live Cust',
    });
  }, 60_000);

  afterAll(async () => {
    if (orgId) {
      await harness.db.delete(customersTable).where(eq(customersTable.organizationId, orgId));
      await harness.db.delete(organizationsTable).where(eq(organizationsTable.id, orgId));
    }
    await harness?.stop();
  });

  it('owner (the app role) bypasses RLS — both modes visible', async () => {
    const both = await harness.db
      .select({ mode: customersTable.mode })
      .from(customersTable)
      .where(eq(customersTable.organizationId, orgId));
    const modes = both.map((r) => r.mode).sort();
    expect(modes).toEqual(['live', 'sandbox']);
  });

  it('as the RLS role, a no-filter SELECT returns ONLY the app.mode slice; unset → none', async () => {
    await harness.db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL ROLE nombaone_rls`);

      // GUC unset → NULLIF→NULL → fail-closed (zero rows).
      const unset = rowsOf(
        await tx.execute(sql`SELECT mode FROM customers WHERE organization_id = ${orgId}`)
      );
      expect(unset).toHaveLength(0);

      // app.mode = sandbox → only the sandbox customer.
      await tx.execute(sql`SELECT set_config('app.mode', 'sandbox', true)`);
      const sandbox = rowsOf(
        await tx.execute(sql`SELECT mode FROM customers WHERE organization_id = ${orgId}`)
      );
      expect(sandbox.map((r) => r.mode)).toEqual(['sandbox']);

      // Flip to live → only the live customer; the sandbox row is now invisible.
      await tx.execute(sql`SELECT set_config('app.mode', 'live', true)`);
      const live = rowsOf(
        await tx.execute(sql`SELECT mode FROM customers WHERE organization_id = ${orgId}`)
      );
      expect(live.map((r) => r.mode)).toEqual(['live']);
    });
  });

  it('runWithModeContext sets the app.mode / app.org GUCs for the unit of work', async () => {
    const seen = await runWithModeContext(harness.db, { mode: 'sandbox', organizationId: orgId }, async (tx) => {
      const r = rowsOf(await tx.execute(sql`SELECT current_setting('app.mode', true) AS mode, current_setting('app.org', true) AS org`));
      return r[0];
    });
    expect(seen?.mode).toBe('sandbox');
    expect(seen?.org).toBe(orgId);
  });

  it('the GUCs do not leak past the transaction (SET LOCAL scope)', async () => {
    const after = rowsOf(
      await harness.db.execute(sql`SELECT current_setting('app.mode', true) AS mode`)
    );
    // Back on a pooled connection with no active mode context → empty/unset.
    expect(after[0]?.mode ?? '').toBe('');
  });
});
