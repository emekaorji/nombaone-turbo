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
});
