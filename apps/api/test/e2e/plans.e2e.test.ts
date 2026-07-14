import { and, desc, eq } from 'drizzle-orm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  domainEventsTable,
  plansTable,
  pricesTable,
  type PriceRow,
} from '@nombaone/core-db/schema';
import { mintReference } from '@nombaone/sara/reference';

import { startHarness, type Harness } from '../helpers/harness';

/**
 * End-to-end coverage of the catalog (`plans` + immutable `prices`): CRUD, price
 * versioning by immutable rows, archive-not-delete, idempotency, name uniqueness,
 * tenant isolation, the L5 default-fill on price create, and the atomic
 * plan-with-embedded-prices create (one intent = one call).
 */
describe('catalog (plans & prices) e2e', () => {
  let harness: Harness;
  let bearerA: string;
  let bearerB: string;
  let orgAId: string;

  const scopes = ['plans:read', 'plans:write', 'prices:read', 'prices:write'];

  beforeAll(async () => {
    harness = await startHarness();
    const orgA = await harness.seedOrg('Cat A');
    const orgB = await harness.seedOrg('Cat B');
    orgAId = orgA.organizationId;
    bearerA = (await harness.mintApiKey(orgA.organizationId, 'sandbox', scopes)).secret;
    bearerB = (await harness.mintApiKey(orgB.organizationId, 'sandbox', scopes)).secret;
  });

  afterAll(async () => {
    await harness?.stop();
  });

  const asA = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerA}`);
  const asB = (r: request.Test): request.Test => r.set('Authorization', `Bearer ${bearerB}`);
  const idem = (r: request.Test, k: string): request.Test => r.set('Idempotency-Key', k);

  it('plan CRUD + nested price create/list with L5 defaults', async () => {
    const created = await idem(asA(request(harness.app).post('/v1/plans')), `pln-${Date.now()}`).send({
      name: `Pro ${Date.now()}`,
      description: 'Pro plan',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.id).toMatch(/pln$/);
    expect(created.body.data.status).toBe('active');
    const planRef = created.body.data.id as string;

    const fetched = await asA(request(harness.app).get(`/v1/plans/${planRef}`));
    expect(fetched.status).toBe(200);
    expect(fetched.body.data.id).toBe(planRef);

    const listed = await asA(request(harness.app).get('/v1/plans').query({ limit: 10 }));
    expect(listed.status).toBe(200);
    expect(listed.body.pagination).toMatchObject({ limit: 10 });
    expect(listed.body.data.some((p: { id: string }) => p.id === planRef)).toBe(true);

    const updated = await idem(
      asA(request(harness.app).patch(`/v1/plans/${planRef}`)),
      `pln-upd-${Date.now()}`
    ).send({ description: 'Updated' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.description).toBe('Updated');

    // L5: minimal price body fills every default.
    const price = await idem(
      asA(request(harness.app).post(`/v1/plans/${planRef}/prices`)),
      `prc-${Date.now()}`
    ).send({ unitAmountInKobo: 500000, interval: 'month' });
    expect(price.status).toBe(201);
    expect(price.body.data.id).toMatch(/prc$/);
    expect(price.body.data).toMatchObject({
      planId: planRef,
      unitAmountInKobo: 500000,
      currency: 'NGN',
      interval: 'month',
      intervalCount: 1,
      usageType: 'licensed',
      billingScheme: 'per_unit',
      trialPeriodDays: 0,
      active: true,
    });

    const planPrices = await asA(request(harness.app).get(`/v1/plans/${planRef}/prices`));
    expect(planPrices.status).toBe(200);
    expect(planPrices.body.data.some((p: { id: string }) => p.id === price.body.data.id)).toBe(true);

    const globalPrice = await asA(request(harness.app).get(`/v1/prices/${price.body.data.id}`));
    expect(globalPrice.status).toBe(200);
    expect(globalPrice.body.data.planId).toBe(planRef);
  });

  it('price versioning is immutable: raise = new row + deactivate old', async () => {
    const plan = await idem(asA(request(harness.app).post('/v1/plans')), `pln-imm-${Date.now()}`).send({
      name: `Immutable ${Date.now()}`,
    });
    const planRef = plan.body.data.id as string;

    const p1 = await idem(
      asA(request(harness.app).post(`/v1/plans/${planRef}/prices`)),
      `p1-${Date.now()}`
    ).send({ unitAmountInKobo: 500000, interval: 'month' });
    const p1Ref = p1.body.data.id as string;

    // "Raise": a new price row, then deactivate the old one.
    const p2 = await idem(
      asA(request(harness.app).post(`/v1/plans/${planRef}/prices`)),
      `p2-${Date.now()}`
    ).send({ unitAmountInKobo: 700000, interval: 'month' });
    expect(p2.status).toBe(201);

    const deactivated = await idem(
      asA(request(harness.app).post(`/v1/prices/${p1Ref}/deactivate`)),
      `deact-${Date.now()}`
    );
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.data.active).toBe(false);

    // P1's money is byte-for-byte unchanged; only `active` flipped.
    const p1After = await asA(request(harness.app).get(`/v1/prices/${p1Ref}`));
    expect(p1After.body.data.unitAmountInKobo).toBe(500000);
    expect(p1After.body.data.active).toBe(false);
    const p2After = await asA(request(harness.app).get(`/v1/prices/${p2.body.data.id}`));
    expect(p2After.body.data.active).toBe(true);

    // Deactivating an already-inactive price → 409.
    const again = await idem(
      asA(request(harness.app).post(`/v1/prices/${p1Ref}/deactivate`)),
      `deact2-${Date.now()}`
    );
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('PRICE_ALREADY_INACTIVE');
  });

  it('archive deactivates prices and blocks new prices; no DELETE route', async () => {
    const plan = await idem(asA(request(harness.app).post('/v1/plans')), `pln-arc-${Date.now()}`).send({
      name: `Archive ${Date.now()}`,
    });
    const planRef = plan.body.data.id as string;
    await idem(asA(request(harness.app).post(`/v1/plans/${planRef}/prices`)), `arcp-${Date.now()}`).send({
      unitAmountInKobo: 300000,
      interval: 'month',
    });

    const archived = await idem(
      asA(request(harness.app).post(`/v1/plans/${planRef}/archive`)),
      `arc-${Date.now()}`
    );
    expect(archived.status).toBe(200);
    expect(archived.body.data.status).toBe('archived');

    // Its prices are now inactive.
    const prices = await asA(request(harness.app).get(`/v1/plans/${planRef}/prices`));
    expect(prices.body.data.every((p: { active: boolean }) => p.active === false)).toBe(true);

    // Cannot add a new price to an archived plan.
    const blocked = await idem(
      asA(request(harness.app).post(`/v1/plans/${planRef}/prices`)),
      `arcp2-${Date.now()}`
    ).send({ unitAmountInKobo: 100000, interval: 'month' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('PLAN_ALREADY_ARCHIVED');

    // No hard-delete endpoint exists.
    const del = await asA(request(harness.app).delete(`/v1/plans/${planRef}`));
    expect(del.status).toBe(404);
    expect(del.body.error.code).toBe('CLIENT_ROUTE_NOT_FOUND');
  });

  it('name uniqueness, idempotency, isolation, and auth', async () => {
    const name = `Unique ${Date.now()}`;
    const key = `pln-uni-${Date.now()}`;
    const first = await idem(asA(request(harness.app).post('/v1/plans')), key).send({ name });
    expect(first.status).toBe(201);

    // Idempotent replay → same plan, no second row.
    const replay = await idem(asA(request(harness.app).post('/v1/plans')), key).send({ name });
    expect(replay.body.data.id).toBe(first.body.data.id);

    // Same name, new key → 409 name taken.
    const dupe = await idem(asA(request(harness.app).post('/v1/plans')), `pln-uni2-${Date.now()}`).send({
      name,
    });
    expect(dupe.status).toBe(409);
    expect(dupe.body.error.code).toBe('PLAN_NAME_TAKEN');

    // Tenant B can use the same name (per-org unique), and A cannot see B's plan.
    const bPlan = await idem(asB(request(harness.app).post('/v1/plans')), `pln-b-${Date.now()}`).send({
      name,
    });
    expect(bPlan.status).toBe(201);
    const crossRead = await asA(request(harness.app).get(`/v1/plans/${bPlan.body.data.id}`));
    expect(crossRead.status).toBe(404);
    expect(crossRead.body.error.code).toBe('PLAN_NOT_FOUND');

    // Auth: missing key → 401; read-only key on a write route → 403.
    const noKey = await request(harness.app).get('/v1/plans');
    expect(noKey.status).toBe(401);
    const orgC = await harness.seedOrg('Cat C');
    const ro = await harness.mintApiKey(orgC.organizationId, 'sandbox', ['plans:read']);
    const forbidden = await request(harness.app)
      .post('/v1/plans')
      .set('Authorization', `Bearer ${ro.secret}`)
      .set('Idempotency-Key', `pln-ro-${Date.now()}`)
      .send({ name: 'RO' });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('API_KEY_SCOPE_FORBIDDEN');
  });

  it('rejects tiered billing (05 seam)', async () => {
    const plan = await idem(asA(request(harness.app).post('/v1/plans')), `pln-tier-${Date.now()}`).send({
      name: `Tiered ${Date.now()}`,
    });
    const tiered = await idem(
      asA(request(harness.app).post(`/v1/plans/${plan.body.data.id}/prices`)),
      `tier-${Date.now()}`
    ).send({ unitAmountInKobo: 100000, interval: 'month', billingScheme: 'tiered' });
    expect(tiered.status).toBe(400);
    expect(tiered.body.error.code).toBe('PRICE_TIERED_NOT_SUPPORTED');
  });

  // ── one intent = one call: POST /v1/plans with embedded `prices: [...]` ───────
  describe('atomic plan + embedded prices', () => {
    /** Every plan row tenant A holds under `name` — the rollback proof reads the DB
     *  directly rather than a GET, which could be lying about what committed. */
    const plansNamed = async (name: string): Promise<{ id: string }[]> =>
      harness.db
        .select({ id: plansTable.id })
        .from(plansTable)
        .where(and(eq(plansTable.organizationId, orgAId), eq(plansTable.name, name)));

    const priceRowCount = async (): Promise<number> =>
      (
        await harness.db
          .select({ id: pricesTable.id })
          .from(pricesTable)
          .where(eq(pricesTable.organizationId, orgAId))
      ).length;

    const planCreatedEventsFor = async (name: string): Promise<unknown[]> => {
      const rows = await harness.db
        .select({ payload: domainEventsTable.payload })
        .from(domainEventsTable)
        .where(
          and(
            eq(domainEventsTable.organizationId, orgAId),
            eq(domainEventsTable.type, 'plan.created')
          )
        );
      return rows.filter((row) => row.payload.name === name);
    };

    it('creates the plan and its prices in ONE call, in submission order', async () => {
      const created = await idem(
        asA(request(harness.app).post('/v1/plans')),
        `pwp-${Date.now()}`
      ).send({
        name: `Embedded ${Date.now()}`,
        prices: [
          { unitAmountInKobo: 500000, interval: 'month' },
          { unitAmountInKobo: 5000000, interval: 'year' },
        ],
      });
      expect(created.status).toBe(201);
      const planRef = created.body.data.id as string;

      // Response order === request order: a client zips these two arrays.
      expect(created.body.data.prices).toHaveLength(2);
      expect(created.body.data.prices[0]).toMatchObject({
        planId: planRef,
        unitAmountInKobo: 500000,
        interval: 'month',
        intervalCount: 1,
        currency: 'NGN',
        active: true,
      });
      expect(created.body.data.prices[1]).toMatchObject({
        unitAmountInKobo: 5000000,
        interval: 'year',
      });

      // They really committed — read them back through the nested route.
      const listed = await asA(request(harness.app).get(`/v1/plans/${planRef}/prices`));
      expect(listed.status).toBe(200);
      expect(listed.body.data).toHaveLength(2);
      expect(new Set(listed.body.data.map((p: { id: string }) => p.id))).toEqual(
        new Set(created.body.data.prices.map((p: { id: string }) => p.id))
      );
    });

    it('rolls the WHOLE call back when one embedded price is rejected', async () => {
      const name = `Rollback ${Date.now()}`;
      const pricesBefore = await priceRowCount();

      const failed = await idem(
        asA(request(harness.app).post('/v1/plans')),
        `pwp-rb-${Date.now()}`
      ).send({
        name,
        prices: [
          { unitAmountInKobo: 500000, interval: 'month' },
          { unitAmountInKobo: 200000, interval: 'week' },
          { unitAmountInKobo: 100000, interval: 'year', billingScheme: 'tiered' },
        ],
      });
      expect(failed.status).toBe(400);
      expect(failed.body.error.code).toBe('PRICE_TIERED_NOT_SUPPORTED');
      // The offending row is named on the wire (`details` never leaves the server).
      expect(failed.body.error.fields['prices.2.billingScheme']).toBeDefined();

      // Nothing partial survived: no plan, no orphan prices, no event.
      expect(await plansNamed(name)).toHaveLength(0);
      expect(await priceRowCount()).toBe(pricesBefore);
      expect(await planCreatedEventsFor(name)).toHaveLength(0);

      // And the name is still free — the failed call left no ghost holding it.
      const retry = await idem(
        asA(request(harness.app).post('/v1/plans')),
        `pwp-rb2-${Date.now()}`
      ).send({ name });
      expect(retry.status).toBe(201);
    });

    it('replays idempotently: the same key never mints a second set of prices', async () => {
      const key = `pwp-idem-${Date.now()}`;
      const body = {
        name: `Replayed ${Date.now()}`,
        prices: [
          { unitAmountInKobo: 300000, interval: 'month' },
          { unitAmountInKobo: 3000000, interval: 'year' },
        ],
      };

      const first = await idem(asA(request(harness.app).post('/v1/plans')), key).send(body);
      expect(first.status).toBe(201);

      // A replay re-serves the cached data — 200, not a fresh 201.
      const replay = await idem(asA(request(harness.app).post('/v1/plans')), key).send(body);
      expect(replay.status).toBe(200);
      expect(replay.body.data.id).toBe(first.body.data.id);
      expect(replay.body.data.prices.map((p: { id: string }) => p.id)).toEqual(
        first.body.data.prices.map((p: { id: string }) => p.id)
      );

      const listed = await asA(
        request(harness.app).get(`/v1/plans/${first.body.data.id}/prices`)
      );
      expect(listed.body.data).toHaveLength(2); // 2, not 4
    });

    it('403s a plans:write-only key that embeds prices, but still lets it create a bare plan', async () => {
      const org = await harness.seedOrg('Cat E');
      const key = await harness.mintApiKey(org.organizationId, 'sandbox', [
        'plans:read',
        'plans:write',
      ]);
      const asKey = (r: request.Test): request.Test =>
        r.set('Authorization', `Bearer ${key.secret}`);

      // Embedding prices MINTS price rows — that needs `prices:write` too.
      const escalated = await idem(
        asKey(request(harness.app).post('/v1/plans')),
        `pwp-scope-${Date.now()}`
      ).send({
        name: `Escalation ${Date.now()}`,
        prices: [{ unitAmountInKobo: 500000, interval: 'month' }],
      });
      expect(escalated.status).toBe(403);
      expect(escalated.body.error.code).toBe('API_KEY_SCOPE_FORBIDDEN');

      // The ROUTE is unchanged: the same key still creates a plan without prices.
      const allowed = await idem(
        asKey(request(harness.app).post('/v1/plans')),
        `pwp-scope2-${Date.now()}`
      ).send({ name: `No Prices ${Date.now()}` });
      expect(allowed.status).toBe(201);
      expect(allowed.body.data.prices).toEqual([]);
    });

    it('422s two prices on the same cadence, an empty array, and more than 10 prices', async () => {
      const dupe = await idem(
        asA(request(harness.app).post('/v1/plans')),
        `pwp-dupe-${Date.now()}`
      ).send({
        name: `Duplicate ${Date.now()}`,
        prices: [
          { unitAmountInKobo: 500000, interval: 'month' },
          { unitAmountInKobo: 600000, interval: 'month' },
        ],
      });
      expect(dupe.status).toBe(422);
      expect(dupe.body.error.code).toBe('CLIENT_VALIDATION_FAILED');
      expect(dupe.body.error.fields['prices.1.interval']).toBeDefined();

      const empty = await idem(
        asA(request(harness.app).post('/v1/plans')),
        `pwp-empty-${Date.now()}`
      ).send({ name: `Empty ${Date.now()}`, prices: [] });
      expect(empty.status).toBe(422);
      expect(empty.body.error.fields.prices).toBeDefined();

      const tooMany = await idem(
        asA(request(harness.app).post('/v1/plans')),
        `pwp-cap-${Date.now()}`
      ).send({
        name: `Capped ${Date.now()}`,
        // 11 DISTINCT cadences, so only the cap can be what rejects this.
        prices: Array.from({ length: 11 }, (_, i) => ({
          unitAmountInKobo: 100000 + i,
          interval: 'month',
          intervalCount: i + 1,
        })),
      });
      expect(tooMany.status).toBe(422);
      expect(tooMany.body.error.fields.prices).toBeDefined();
    });

    it('stays back-compatible: a bare create still 201s, with `prices: []`', async () => {
      const created = await idem(
        asA(request(harness.app).post('/v1/plans')),
        `pwp-bare-${Date.now()}`
      ).send({ name: `Bare ${Date.now()}` });
      expect(created.status).toBe(201);
      expect(created.body.data.prices).toEqual([]);
    });
  });

  // ── a plan IS what it costs: PATCH /v1/plans/{id} with `prices: [...]` ────────
  describe('plan update reconciles its prices', () => {
    /** Every price row the plan has EVER had, newest first — retired ones included. A
     *  reconcile is judged on rows, not on what the response chose to show. */
    const priceRows = async (planRef: string): Promise<PriceRow[]> => {
      const [plan] = await harness.db
        .select({ id: plansTable.id })
        .from(plansTable)
        .where(eq(plansTable.reference, planRef));
      if (!plan) throw new Error(`plan ${planRef} is not in the database`);

      return harness.db
        .select()
        .from(pricesTable)
        .where(eq(pricesTable.planId, plan.id))
        .orderBy(desc(pricesTable.createdAt));
    };

    /** The one row behind a public price id. Read directly, because the whole point of
     *  grandfathering is what the ROW still says after the API stopped offering it. */
    const priceRow = async (priceRef: string): Promise<PriceRow> => {
      const [row] = await harness.db
        .select()
        .from(pricesTable)
        .where(eq(pricesTable.reference, priceRef));
      if (!row) throw new Error(`price ${priceRef} is not in the database`);
      return row;
    };

    /** The `price.*` events this plan emitted, in order. `planRef` is on every payload. */
    const priceEvents = async (planRef: string): Promise<{ type: string; ref: unknown }[]> => {
      const rows = await harness.db
        .select({ type: domainEventsTable.type, payload: domainEventsTable.payload })
        .from(domainEventsTable)
        .where(eq(domainEventsTable.organizationId, orgAId))
        .orderBy(domainEventsTable.createdAt);

      return rows
        .filter((row) => row.type.startsWith('price.') && row.payload.planRef === planRef)
        .map((row) => ({ type: row.type, ref: row.payload.reference }));
    };

    /** A plan with the given cadences already priced — the state a merchant edits FROM. */
    const seedPlan = async (
      label: string,
      prices: Record<string, unknown>[]
    ): Promise<{ ref: string; prices: { id: string }[] }> => {
      const created = await idem(
        asA(request(harness.app).post('/v1/plans')),
        `upd-seed-${label}-${Date.now()}`
      ).send({ name: `${label} ${Date.now()}`, prices });
      expect(created.status).toBe(201);
      return { ref: created.body.data.id as string, prices: created.body.data.prices };
    };

    const patch = (planRef: string, label: string, body: Record<string, unknown>) =>
      idem(
        asA(request(harness.app).patch(`/v1/plans/${planRef}`)),
        `upd-${label}-${Date.now()}`
      ).send(body);

    it('writes NOTHING when the amount is unchanged', async () => {
      const plan = await seedPlan('Unchanged', [
        { unitAmountInKobo: 500000, interval: 'month' },
        { unitAmountInKobo: 5000000, interval: 'year' },
      ]);
      const before = await priceRows(plan.ref);
      expect(before).toHaveLength(2);

      // Re-submitting what the plan already costs is the console's most common save
      // (open the modal, change the name, hit save). It must not recreate the catalog
      // and hand every price a new id that clients have already stored.
      const updated = await patch(plan.ref, 'noop', {
        name: `Renamed ${Date.now()}`,
        prices: [
          { unitAmountInKobo: 500000, interval: 'month' },
          { unitAmountInKobo: 5000000, interval: 'year' },
        ],
      });
      expect(updated.status).toBe(200);

      const after = await priceRows(plan.ref);
      expect(after).toHaveLength(2);
      expect(after.map((row) => row.reference)).toEqual(before.map((row) => row.reference));
      expect(after.every((row) => row.active)).toBe(true);
      // Same ids come back — the client's stored `priceId` still resolves.
      expect(new Set(updated.body.data.prices.map((p: { id: string }) => p.id))).toEqual(
        new Set(plan.prices.map((p) => p.id))
      );
    });

    it('grandfathers: a changed amount mints a NEW row and leaves the old one untouched', async () => {
      const plan = await seedPlan('Grandfather', [{ unitAmountInKobo: 500000, interval: 'month' }]);
      const oldRef = plan.prices[0]!.id;

      const updated = await patch(plan.ref, 'raise', {
        prices: [{ unitAmountInKobo: 700000, interval: 'month' }],
      });
      expect(updated.status).toBe(200);

      const rows = await priceRows(plan.ref);
      expect(rows).toHaveLength(2);

      // Exactly ONE active row, and it is the new money.
      const active = rows.filter((row) => row.active);
      expect(active).toHaveLength(1);
      expect(active[0]!.unitAmount).toBe(700000);
      expect(active[0]!.reference).not.toBe(oldRef);

      // THE INVARIANT. The old row is retired, but its money is byte-for-byte what the
      // subscribers pinned to it agreed to pay. Rewriting it in place would re-price
      // every one of them, retroactively.
      const old = await priceRow(oldRef);
      expect(old.active).toBe(false);
      expect(old.unitAmount).toBe(500000);
      expect(old.interval).toBe('month');
      expect(old.intervalCount).toBe(1);
    });

    it('leaves a cadence it was not sent completely alone', async () => {
      const plan = await seedPlan('Untouched', [
        { unitAmountInKobo: 500000, interval: 'month' },
        { unitAmountInKobo: 5000000, interval: 'year' },
      ]);
      const yearBefore = await priceRow(
        (await priceRows(plan.ref)).find((row) => row.interval === 'year')!.reference
      );

      // Only `month` is submitted. Omission must never retire a price.
      const updated = await patch(plan.ref, 'partial', {
        prices: [{ unitAmountInKobo: 900000, interval: 'month' }],
      });
      expect(updated.status).toBe(200);

      const yearAfter = await priceRow(yearBefore.reference);
      expect(yearAfter.active).toBe(true);
      expect(yearAfter.unitAmount).toBe(5000000);
      expect(yearAfter.createdAt).toEqual(yearBefore.createdAt);
      expect((await priceRows(plan.ref)).filter((row) => row.interval === 'year')).toHaveLength(1);
    });

    it('creates a cadence the plan did not price before', async () => {
      const plan = await seedPlan('NewCadence', [{ unitAmountInKobo: 500000, interval: 'month' }]);
      const monthRef = plan.prices[0]!.id;

      const updated = await patch(plan.ref, 'add', {
        prices: [
          { unitAmountInKobo: 500000, interval: 'month' },
          { unitAmountInKobo: 150000, interval: 'week' },
        ],
      });
      expect(updated.status).toBe(200);

      const rows = await priceRows(plan.ref);
      expect(rows).toHaveLength(2); // the month row was NOT recreated
      const week = rows.find((row) => row.interval === 'week');
      expect(week).toBeDefined();
      expect(week!.active).toBe(true);
      expect(week!.unitAmount).toBe(150000);
      expect(week!.intervalCount).toBe(1);
      expect((await priceRow(monthRef)).active).toBe(true);
    });

    it('heals a legacy plan carrying TWO active monthly prices down to one', async () => {
      const plan = await seedPlan('Legacy', [{ unitAmountInKobo: 500000, interval: 'month' }]);
      const original = await priceRow(plan.prices[0]!.id);

      // Seeded by direct insert on purpose: `rejectDuplicateCadence` blocks this over the
      // wire, but nothing in the DB forbids it and legacy plans really carry it. Newest =
      // canonical, so pin this row's `createdAt` after the original's — otherwise ROW ORDER
      // would decide what a new subscriber pays, which is a coin toss over money.
      const duplicateRef = mintReference('PRC');
      await harness.db.insert(pricesTable).values({
        reference: duplicateRef,
        organizationId: orgAId,
        mode: 'sandbox',
        planId: original.planId,
        unitAmount: 600000,
        interval: 'month',
        intervalCount: 1,
        createdAt: new Date(new Date(original.createdAt).getTime() + 1_000),
      });
      expect((await priceRows(plan.ref)).filter((row) => row.active)).toHaveLength(2);

      // The canonical (newest) row's amount, unchanged — so this edit writes no new price.
      // The heal is a side effect of touching the cadence at all.
      const updated = await patch(plan.ref, 'heal', {
        prices: [{ unitAmountInKobo: 600000, interval: 'month' }],
      });
      expect(updated.status).toBe(200);

      const rows = await priceRows(plan.ref);
      expect(rows).toHaveLength(2); // healed, not recreated
      const active = rows.filter((row) => row.active);
      expect(active).toHaveLength(1);
      expect(active[0]!.reference).toBe(duplicateRef);

      const stale = await priceRow(original.reference);
      expect(stale.active).toBe(false);
      expect(stale.unitAmount).toBe(500000);

      expect(updated.body.data.prices).toHaveLength(1);
      expect(updated.body.data.prices[0].id).toBe(duplicateRef);
    });

    it('retires EVERY other active row on the cadence, not just the newest, when the amount changes', async () => {
      const plan = await seedPlan('Sweep', [{ unitAmountInKobo: 500000, interval: 'month' }]);
      const original = await priceRow(plan.prices[0]!.id);

      // Same legacy shape as the heal above, but the merchant RAISES the price instead of
      // re-submitting it. Retiring only the canonical row would leave the 600000 one live
      // alongside the new money, and which of the two a new subscriber lands on would be
      // decided by row order — a coin toss over money. The changed path sweeps the whole
      // cadence, excluding the new row by id, so the plan is never left with nothing to bill.
      const duplicateRef = mintReference('PRC');
      await harness.db.insert(pricesTable).values({
        reference: duplicateRef,
        organizationId: orgAId,
        mode: 'sandbox',
        planId: original.planId,
        unitAmount: 600000,
        interval: 'month',
        intervalCount: 1,
        createdAt: new Date(new Date(original.createdAt).getTime() + 1_000),
      });
      expect((await priceRows(plan.ref)).filter((row) => row.active)).toHaveLength(2);

      const updated = await patch(plan.ref, 'sweep', {
        prices: [{ unitAmountInKobo: 700000, interval: 'month' }],
      });
      expect(updated.status).toBe(200);

      const active = (await priceRows(plan.ref)).filter((row) => row.active);
      expect(active).toHaveLength(1);
      expect(active[0]!.unitAmount).toBe(700000);
      expect(updated.body.data.prices).toHaveLength(1);
      expect(updated.body.data.prices[0].id).toBe(active[0]!.reference);

      // Both retired rows keep their money exactly as their subscribers pinned it.
      const sweptCanonical = await priceRow(duplicateRef);
      expect(sweptCanonical.active).toBe(false);
      expect(sweptCanonical.unitAmount).toBe(600000);
      const sweptStale = await priceRow(original.reference);
      expect(sweptStale.active).toBe(false);
      expect(sweptStale.unitAmount).toBe(500000);

      // Every row that actually moved announced it — the swept duplicate included.
      const deactivated = (await priceEvents(plan.ref))
        .filter((event) => event.type === 'price.deactivated')
        .map((event) => event.ref);
      expect(new Set(deactivated)).toEqual(new Set([duplicateRef, original.reference]));
    });

    it('403s a plans:write-only key that sends prices, but still lets it rename the plan', async () => {
      const org = await harness.seedOrg('Cat F');
      const full = await harness.mintApiKey(org.organizationId, 'sandbox', scopes);
      const planned = await request(harness.app)
        .post('/v1/plans')
        .set('Authorization', `Bearer ${full.secret}`)
        .set('Idempotency-Key', `upd-scope-seed-${Date.now()}`)
        .send({
          name: `Scoped ${Date.now()}`,
          prices: [{ unitAmountInKobo: 500000, interval: 'month' }],
        });
      expect(planned.status).toBe(201);
      const planRef = planned.body.data.id as string;

      const limited = await harness.mintApiKey(org.organizationId, 'sandbox', [
        'plans:read',
        'plans:write',
      ]);
      const asLimited = (r: request.Test): request.Test =>
        r.set('Authorization', `Bearer ${limited.secret}`);

      // Sending prices MINTS and RETIRES price rows — a capability `plans:write` never granted.
      const escalated = await idem(
        asLimited(request(harness.app).patch(`/v1/plans/${planRef}`)),
        `upd-scope-${Date.now()}`
      ).send({ prices: [{ unitAmountInKobo: 700000, interval: 'month' }] });
      expect(escalated.status).toBe(403);
      expect(escalated.body.error.code).toBe('API_KEY_SCOPE_FORBIDDEN');

      // Rejected BEFORE any DB work: the price is exactly as it was.
      const untouched = await priceRows(planRef);
      expect(untouched).toHaveLength(1);
      expect(untouched[0]!.unitAmount).toBe(500000);
      expect(untouched[0]!.active).toBe(true);

      // The ROUTE is unchanged: the same key still updates the plan's own fields.
      const allowed = await idem(
        asLimited(request(harness.app).patch(`/v1/plans/${planRef}`)),
        `upd-scope2-${Date.now()}`
      ).send({ description: 'Renamed by a plans-only key' });
      expect(allowed.status).toBe(200);
      expect(allowed.body.data.description).toBe('Renamed by a plans-only key');
      // `data.prices` is present whether or not the caller sent any.
      expect(allowed.body.data.prices).toHaveLength(1);
    });

    it('409s prices against an archived plan', async () => {
      const plan = await seedPlan('Archived', [{ unitAmountInKobo: 500000, interval: 'month' }]);
      const archived = await idem(
        asA(request(harness.app).post(`/v1/plans/${plan.ref}/archive`)),
        `upd-arc-${Date.now()}`
      );
      expect(archived.status).toBe(200);

      const blocked = await patch(plan.ref, 'arc', {
        prices: [{ unitAmountInKobo: 700000, interval: 'month' }],
      });
      expect(blocked.status).toBe(409);
      expect(blocked.body.error.code).toBe('PLAN_ALREADY_ARCHIVED');

      // Nothing new was minted for a plan nothing may subscribe to.
      expect(await priceRows(plan.ref)).toHaveLength(1);
    });

    it('answers with the plan ACTIVE prices after the update', async () => {
      const plan = await seedPlan('Answer', [
        { unitAmountInKobo: 500000, interval: 'month' },
        { unitAmountInKobo: 5000000, interval: 'year' },
      ]);

      const updated = await patch(plan.ref, 'answer', {
        prices: [{ unitAmountInKobo: 800000, interval: 'month' }],
      });
      expect(updated.status).toBe(200);

      const active = (await priceRows(plan.ref)).filter((row) => row.active);
      expect(active).toHaveLength(2);
      expect(new Set(updated.body.data.prices.map((p: { id: string }) => p.id))).toEqual(
        new Set(active.map((row) => row.reference))
      );
      // The retired row is NOT on offer, though it still exists and still bills its subscribers.
      expect(
        updated.body.data.prices.some((p: { id: string }) => p.id === plan.prices[0]!.id)
      ).toBe(false);
      expect(
        updated.body.data.prices.find(
          (p: { interval: string }) => p.interval === 'month'
        ).unitAmountInKobo
      ).toBe(800000);
    });

    it('reconciles a 10-minute cadence exactly like a monthly one', async () => {
      const plan = await seedPlan('Realtime', [
        { unitAmountInKobo: 50000, interval: 'minute', intervalCount: 10 },
      ]);
      const oldRef = plan.prices[0]!.id;
      expect(plan.prices[0]).toMatchObject({ interval: 'minute', intervalCount: 10 });

      // Unchanged → nothing.
      const noop = await patch(plan.ref, 'min-noop', {
        prices: [{ unitAmountInKobo: 50000, interval: 'minute', intervalCount: 10 }],
      });
      expect(noop.status).toBe(200);
      expect(await priceRows(plan.ref)).toHaveLength(1);

      // Changed → new row, old retired with its money intact. No special-casing: a cadence
      // is a UNIT × a COUNT, and `minute × 10` is one like any other.
      const raised = await patch(plan.ref, 'min-raise', {
        prices: [{ unitAmountInKobo: 75000, interval: 'minute', intervalCount: 10 }],
      });
      expect(raised.status).toBe(200);

      const rows = await priceRows(plan.ref);
      expect(rows).toHaveLength(2);
      const active = rows.filter((row) => row.active);
      expect(active).toHaveLength(1);
      expect(active[0]).toMatchObject({
        unitAmount: 75000,
        interval: 'minute',
        intervalCount: 10,
      });

      const old = await priceRow(oldRef);
      expect(old.active).toBe(false);
      expect(old.unitAmount).toBe(50000);

      // A `minute × 10` price is NOT a `minute × 1` price — the count is half the cadence.
      const perMinute = await patch(plan.ref, 'min-one', {
        prices: [{ unitAmountInKobo: 9000, interval: 'minute', intervalCount: 1 }],
      });
      expect(perMinute.status).toBe(200);
      const byCadence = (await priceRows(plan.ref)).filter((row) => row.active);
      expect(byCadence).toHaveLength(2);
      expect(byCadence.find((row) => row.intervalCount === 10)!.unitAmount).toBe(75000);
      expect(byCadence.find((row) => row.intervalCount === 1)!.unitAmount).toBe(9000);
    });

    it('emits price events only when a price actually moved', async () => {
      const plan = await seedPlan('Events', [{ unitAmountInKobo: 500000, interval: 'month' }]);
      const oldRef = plan.prices[0]!.id;
      // The create's own `price.created` is the baseline; the edits are judged against it.
      expect(await priceEvents(plan.ref)).toEqual([{ type: 'price.created', ref: oldRef }]);

      const noop = await patch(plan.ref, 'ev-noop', {
        description: 'Same money',
        prices: [{ unitAmountInKobo: 500000, interval: 'month' }],
      });
      expect(noop.status).toBe(200);
      // A no-op reconcile is silent. A `price.created` here would tell every subscribed
      // webhook that the catalog changed when not one kobo moved.
      expect(await priceEvents(plan.ref)).toHaveLength(1);

      const raised = await patch(plan.ref, 'ev-raise', {
        prices: [{ unitAmountInKobo: 700000, interval: 'month' }],
      });
      expect(raised.status).toBe(200);

      const events = await priceEvents(plan.ref);
      const newRef = raised.body.data.prices[0].id as string;
      expect(events).toEqual([
        { type: 'price.created', ref: oldRef },
        { type: 'price.created', ref: newRef },
        { type: 'price.deactivated', ref: oldRef },
      ]);
    });

    it('two concurrent updates cannot both mint the same unpriced cadence', async () => {
      const plan = await seedPlan('Race', [{ unitAmountInKobo: 500000, interval: 'month' }]);

      // The plan row is locked FOR UPDATE before the price rows precisely for this: you
      // cannot lock a row that does not exist yet, so nothing else can stop both callers
      // finding `year` unpriced and both minting it.
      const [first, second] = await Promise.all([
        patch(plan.ref, 'race1', { prices: [{ unitAmountInKobo: 5000000, interval: 'year' }] }),
        patch(plan.ref, 'race2', { prices: [{ unitAmountInKobo: 5000000, interval: 'year' }] }),
      ]);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);

      const year = (await priceRows(plan.ref)).filter((row) => row.interval === 'year');
      expect(year).toHaveLength(1);
      expect(year[0]!.active).toBe(true);
      expect(year[0]!.unitAmount).toBe(5000000);
    });
  });
});
