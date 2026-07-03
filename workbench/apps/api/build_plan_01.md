# apps/api — Build Plan 01 · Catalog — plans, prices, plan versioning

> **Objective.** Build the **product catalog**: a tenant's `plans` (the offering) and the immutable,
> versioned `prices` attached to them, as one full vertical slice (schema → contracts → `sara` → HTTP →
> tests). Establish **plan versioning by immutable price rows** (a new price is a new row, never an edit),
> the **archive-not-delete** discipline for a plan with subscribers, and carry — in the price columns —
> the `interval` / `interval_count` / `usage_type` / `trial_period_days` data the scheduler (04) and the
> charge loop (03) will later read. **Depends on:** 00 (Foundations — contract, `customers` slice, harness).
> **Unblocks:** 03 (subscriptions pin a price), 04 (scheduler reads interval data), 05 (tiered/proration
> build on the `billing_scheme` seam).

This plan obeys `build_plan_00.md` as the contract: Part B house style, Part C global design (C.1 tables,
C.4 reference domains, C.5 error groups, C.6 event catalog), and the Part D per-file template. Every box is
a `- [ ]` ticked **only when demonstrated** (test / endpoint / row / log line), per
`SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md`.

---

## Objective & scope

**In:**
- `plans` table — the product/offering: `name`, `description`, `status` (`active | archived`), `metadata`.
- `prices` table — **immutable**, versioned priced variants of a plan: `unit_amount` (kobo), `currency`
  (`NGN`), `interval`, `interval_count`, `usage_type` (`licensed` now; `metered` reserved for later),
  `billing_scheme` (`per_unit` now; `tiered` reserved as a seam for 05), `trial_period_days`, `active`.
- `sara` `plans/` module — `create.ts`, `queries.ts`, `serialize.ts`, `archive.ts`, `types.ts`, `index.ts`.
- `sara` `prices/` module — `create.ts`, `queries.ts`, `serialize.ts`, `types.ts`, `index.ts` (immutable:
  there is no `updatePrice` — a change is a **new price row**; the old one is **deactivated**, never edited).
- `apps/api` `plans/` module — `/v1/plans` CRUD + archive, `/v1/plans/:ref/prices` (create + list under a
  plan), and a read-only `/v1/prices` module. New scopes `plans:read|write`, `prices:read|write`.
- Events: `plan.created`, `plan.updated`, `plan.archived`, `price.created`, `price.deactivated`.
- The **plan-delete guard**: a plan with `status = archived` cannot be re-activated by mutation, hard delete
  is never exposed, and the guard hook that blocks archiving/deleting a plan **with active subscribers** is
  written now (modeled + unit-tested against a stubbed subscriber count) and **fully enforced in 03** once
  `subscriptions` exists. We design the seam so 03 only wires the real count in — no rework.

**Out (deferred — do not poach):**
- `subscriptions`, `subscription_items`, the lifecycle state machine, the charge→ledger→verify loop, trials
  *consumed* — **03**. (We only *declare* `trial_period_days` on the price here; nothing trials yet.)
- Proration, tiered-price math, coupons/discounts, credit balances, seat/quantity *billing behavior* — **05**.
  We add the `billing_scheme` column + a `price_tiers` seam comment, but compute nothing tiered.
- The scheduler that *reads* `interval`/`interval_count`/anchors — **04**. We only persist the columns.
- Console / admin UI for catalog management — the `apps/admin` / console app, not apps/api.
- Real Nomba rails / payment methods — **02**. Catalog is provider-agnostic; no rail is touched.

---

## Rubric coverage

Boxes from `SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md` this phase demonstrates (proofs named in the Verification
checklist):

- **A** (state machine, plan/versioning side):
  - **A (versioning invariant)** — the price-immutability rule that makes "old subscribers unaffected by new
    prices" *structurally* true: a price row is never updated; a new variant is a new row. (Box: A's
    "★ state derived/consistent" depends on this immutability; the subscription pin lands in 03. We cover the
    **catalog half** here and tag the subscription half forward to 03.)
- **H** (multi-tenancy baseline):
  - **H1** — every catalog entity (`plans`, `prices`) carries `organization_id` + `environment`.
  - **H2 ⚠** — tenant isolation proven: Tenant A cannot read/mutate Tenant B's plan or price on any catalog
    endpoint (e2e isolation test).
- **K** (idempotency & concurrency baseline):
  - **K1 ⚠** — every mutating catalog endpoint honors `Idempotency-Key`; replay returns the original result,
    no second row.
  - **K2** — DB unique constraints make duplicate plans/prices structurally impossible (not just code-guarded).
- **L** (API ergonomics):
  - **L1** — RESTful, consistent resource naming/verbs across `/v1/plans`, `/v1/plans/:ref/prices`, `/v1/prices`.
  - **L2 ⚠** — single error envelope with stable machine codes (`PLAN_*`, `PRICE_*`).
  - **L3** — cursor pagination on every list.
  - **L4** — ISO-8601 UTC timestamps; money as integer kobo with a fixed `NGN` field convention everywhere.
  - **L5** — creating a price requires the **minimum** sensible fields, safe defaults for the rest
    (`interval_count=1`, `usage_type=licensed`, `billing_scheme=per_unit`, `trial_period_days=0`, `currency=NGN`).
  - **L6** — versioned under `/v1`.
- **N** (security):
  - **N4** — every catalog route enforces `apiKeyAuth` + the right scope; no unauthenticated mutating route.
- **O** (edge cases & resilience):
  - **O1 ⚠** — *Attempting to delete a plan that has active subscribers is blocked or handled via plan
    versioning (subscribers are not orphaned).* Demonstrated here as: **no hard-delete endpoint exists**;
    archive is the only retire path; the `assertPlanArchivable` guard rejects retiring a plan with active
    subscribers; price immutability means existing subscribers (in 03) keep their pinned price. The
    subscriber-count check is unit-proven against a stub now and wired to the real `subscriptions` count in 03.

Tagged-forward (declared, not consumed here): A's trial/charge transitions (03), the scheduler's read of
interval data (04), tiered math (05).

---

## Design notes

**Plan vs price split.** A `plan` is the durable product concept (the thing a tenant names and a subscriber
"is on"). A `price` is an **immutable, versioned** way to charge for that plan. This is the Stripe-shaped
model and the one the contract's C.1 mandates ("plan versioning = new price rows"). A plan has many prices
over its lifetime; at most a subset are `active` (sellable) at once.

**Versioning = immutability, not a `version` integer on the price.** We never carry a mutable `version`
counter that gets bumped in place. Each price *is* a version — a distinct row with its own `reference`
(`nbo…prc`). "Raising the price" = `createPrice` (new row, `active=true`) + `deactivatePrice` on the old row
(`active=false`). The old row's `unit_amount` is **never** rewritten. This is what makes the 03 invariant
hold *by construction*: a subscription pins a specific `price_id`, so creating a new price for the plan
cannot retroactively change what an existing subscriber pays. We enforce immutability two ways: (1) no
`updatePrice` exists in `sara/prices` and no `PATCH/PUT /v1/prices/:ref` route exists; (2) the only mutation
allowed on a price is the `active` boolean flip via `deactivatePrice`, which is a state change, not a money
edit. (A DB-level immutability trigger is overkill for Phase 01; the absent endpoint + absent domain
function is the enforced contract. Revisit if 09 wants belt-and-braces.)

**Archive, never hard-delete (O1).** Plans are retired by `status = archived`, never `DELETE`d. There is no
`DELETE /v1/plans/:ref` route. Archiving: (a) flips `status` to `archived`, (b) deactivates all the plan's
`active` prices (so nothing new can subscribe to it), (c) is **blocked** if the plan has active subscribers
— `assertPlanArchivable(db, ctx, planId)` throws `PLAN_HAS_ACTIVE_SUBSCRIBERS` when the subscriber count is
> 0. In Phase 01 `countActiveSubscribers` is a **seam**: it returns `0` (the `subscriptions` table does not
exist yet) and is unit-tested with the count **stubbed** to a positive number to prove the guard fires. 03
replaces the stub body with a real `COUNT(*)` over `subscriptions WHERE plan_id = … AND status IN (active,
trialing, past_due, paused)` — the call site and error code do not change. This satisfies O1's "blocked OR
handled via plan versioning": both halves are present (block the retire; version the price so existing subs
are never orphaned).

**Money & defaults.** `unit_amount` is positive integer **kobo** (`bigint`, `mode: 'number'`), validated by
`assertPositiveKobo` at the domain boundary exactly like `examples.amount`. Currency is `NGN` only (a
`currency` column + a CHECK pinning it to `NGN`, so the column exists for future-proofing but cannot drift).
Safe defaults (L5): `interval_count=1`, `usage_type='licensed'`, `billing_scheme='per_unit'`,
`trial_period_days=0`, `active=true`, `currency='NGN'`. A price create needs only `{ unit_amount, interval }`.

**`interval` semantics (persist now, schedule in 04).** `interval ∈ {day, week, month, year}` ×
`interval_count` (e.g. `month`×3 = quarterly) covers monthly/annual/custom from rubric B without the
scheduler. We store the data and validate it; 04 reads it to compute anchors/EOM/leap. No date math here.

**`billing_scheme` seam for tiered (05).** Column `billing_scheme ∈ {per_unit, tiered}`, defaulting
`per_unit`. We add a `price_tiers` **table stub is NOT created here** — instead a documented seam: when 05
builds tiered, it adds a `price_tiers` child table keyed by `price_id` and the serializer grows a `tiers`
field. Phase 01 rejects `billing_scheme = 'tiered'` at the contract layer (`PRICE_TIERED_NOT_SUPPORTED`)
so the column is reserved but no half-built tiered path ships. This keeps "no MVP half-steps" honest.

**No status column on prices that drifts.** Unlike the money-derived `status` on `examples`, a price's
`active` flag is a **deliberate catalog state**, not a money-derived one — it's the tenant's sellability
decision, set explicitly via create/deactivate, not inferred from a ledger. That's consistent with the
contract (B.6 forbids *drift-prone money status*, not all booleans). A plan's `status` is likewise an
explicit catalog lifecycle (`active | archived`), event-emitting on every change.

**Reads resolve by reference within pinned scope** (mirrors `example/queries.ts`): a route param is never
proof of ownership — `(organizationId, environment, reference)` in the WHERE clause makes a cross-tenant
reference simply not exist. Cursor pagination is keyset on `(created_at desc, id desc)` via `buildPage` /
`clampLimit` / `decodeCursor`, identical to the example slice.

---

## Tasks (layer by layer)

### DB (core-db)

- [x] **`plans` table** — `packages/core-db/src/schema/plans.ts`. Columns: `id: idPk()`,
      `reference: referenceCol()`, `organizationId` (uuid, FK → `organizationsTable.id`, `onDelete: cascade`),
      `environment: environmentEnum`, `name: text notNull`, `description: text` (nullable),
      `status: planStatusEnum notNull default 'active'`, `metadata: jsonb notNull default '{}'`,
      `createdAt: createdAt()`, `updatedAt: updatedAt()`. Enum `planStatusEnum = pgEnum('plan_status',
      ['active','archived'])`. Indexes: `uniqueIndex('plans_reference_unique').on(reference)`;
      `uniqueIndex('plans_org_env_name_unique').on(organizationId, environment, name)` (a tenant can't have
      two plans of the same name per env — **K2**); `index('plans_keyset_idx').on(organizationId,
      environment, createdAt.desc(), id.desc())`. Export `PlanRow` / `PlanInsert` via `$inferSelect/$inferInsert`.
      *Proof:* table compiles; `pnpm --filter @nombaone/core-db type-check` green.
- [x] **`prices` table** — `packages/core-db/src/schema/prices.ts`. Columns: `id: idPk()`,
      `reference: referenceCol()`, `organizationId` (FK → orgs, cascade), `environment: environmentEnum`,
      `planId` (uuid, FK → `plansTable.id`, `onDelete: 'restrict'` — **you cannot drop a plan out from under
      its prices; this is the structural anti-orphan rule, O1**), `unitAmount: bigint('unit_amount',
      { mode: 'number' }) notNull`, `currency: text notNull default 'NGN'`,
      `interval: priceIntervalEnum notNull`, `intervalCount: integer notNull default 1`,
      `usageType: priceUsageTypeEnum notNull default 'licensed'`,
      `billingScheme: priceBillingSchemeEnum notNull default 'per_unit'`,
      `trialPeriodDays: integer notNull default 0`, `active: boolean notNull default true`,
      `metadata: jsonb notNull default '{}'`, `createdAt: createdAt()` (**append-only — NO `updatedAt`;
      prices are immutable; the only mutation is the `active` flip, done via a targeted update**).
      Enums: `priceIntervalEnum = pgEnum('price_interval', ['day','week','month','year'])`;
      `priceUsageTypeEnum = pgEnum('price_usage_type', ['licensed','metered'])`;
      `priceBillingSchemeEnum = pgEnum('price_billing_scheme', ['per_unit','tiered'])`.
      CHECKs: `check('prices_unit_amount_positive', sql\`${unitAmount} > 0\`)`;
      `check('prices_interval_count_positive', sql\`${intervalCount} > 0\`)`;
      `check('prices_trial_days_nonneg', sql\`${trialPeriodDays} >= 0\`)`;
      `check('prices_currency_ngn', sql\`${currency} = 'NGN'\`)`. Indexes:
      `uniqueIndex('prices_reference_unique').on(reference)`;
      `index('prices_plan_active_idx').on(planId, active)` (resolve a plan's sellable prices fast);
      `index('prices_keyset_idx').on(organizationId, environment, createdAt.desc(), id.desc())`.
      Export `PriceRow` / `PriceInsert`. *Proof:* compiles; FK `onDelete: restrict` present.
- [x] **Register schemas** — add `export * from './plans';` and `export * from './prices';` to
      `packages/core-db/src/schema/index.ts` (after `examples`, or after `customers` once 00 lands).
- [x] **Migration** — `pnpm db:generate` then `pnpm db:migrate` (NEVER `push`, per global rule). One clean
      migration adding `plan_status`, `price_interval`, `price_usage_type`, `price_billing_scheme` enums and
      the two tables. *Proof:* migration applies on a fresh testcontainers DB in the e2e boot; SQL file
      committed under `packages/core-db/drizzle/`.

### Contracts (core-contracts)

- [x] **`types/plan.ts`** — `PlanStatus = 'active' | 'archived'`; `PlanResponseData` (`id` = reference,
      `name`, `description: string | null`, `status`, `metadata`, `environment`, `createdAt`, `updatedAt` —
      all ISO-8601 UTC strings).
- [x] **`types/price.ts`** — `PriceInterval`, `PriceUsageType`, `PriceBillingScheme`; `PriceResponseData`
      (`id` = reference, `planId` = the plan's **reference** not its UUID, `unitAmount: number` (kobo),
      `currency: 'NGN'`, `interval`, `intervalCount`, `usageType`, `billingScheme`, `trialPeriodDays`,
      `active`, `metadata`, `environment`, `createdAt`). Export both from `types/index.ts` barrel.
- [x] **`validations/plan.ts`** — `createPlanBody` (`name: string min 1 max 200`, `description: string max
      2000 optional`, `metadata: record optional`); `updatePlanBody` (`name?`, `description?`, `metadata?` —
      at least one key, `.refine`); `listPlanQuery` (`status?: enum`, `limit: coerce int 1..100 default 20`,
      `cursor?: string`). Archive needs no body. DTO types via `z.infer`.
- [x] **`validations/price.ts`** — `createPriceBody`:
      `{ unitAmount: z.coerce.number().int().positive() (kobo),
         interval: z.enum(['day','week','month','year']),
         intervalCount: z.coerce.number().int().positive().default(1),
         usageType: z.enum(['licensed','metered']).default('licensed'),
         billingScheme: z.enum(['per_unit','tiered']).default('per_unit'),
         trialPeriodDays: z.coerce.number().int().min(0).default(0),
         metadata: z.record(...).optional() }`.
      `listPriceQuery` (`planRef?: string`, `active?: coerce boolean`, `limit`, `cursor`).
      Export from `validations/index.ts`. *Proof:* schemas parse a minimal `{ unitAmount, interval }` body
      filling all defaults (a unit test asserts the defaulted output — **L5**).
- [x] **Scope enum** — extend `apiKeyScope` in `validations/api-key.ts` with `'plans:read'`, `'plans:write'`,
      `'prices:read'`, `'prices:write'`. *Proof:* an api key can be minted with the new scopes (contract test).

### Domain (sara)

- [x] **Reference domains** — add `'PLN'` and `'PRC'` to the `ReferenceDomain` union in
      `packages/sara/src/reference.ts` (per C.4). *Proof:* `mintReference('PLN')` → `nbo…pln`,
      `mintReference('PRC')` → `nbo…prc` (unit test).
- [x] **Error codes** — add to `packages/errors/src/codes.ts` (per C.5): `PLAN_NOT_FOUND`,
      `PLAN_NAME_TAKEN`, `PLAN_ALREADY_ARCHIVED`, `PLAN_HAS_ACTIVE_SUBSCRIBERS`, `PRICE_NOT_FOUND`,
      `PRICE_PLAN_MISMATCH`, `PRICE_IMMUTABLE`, `PRICE_ALREADY_INACTIVE`, `PRICE_TIERED_NOT_SUPPORTED`,
      `CATALOG_INVALID_INTERVAL`. Add the safe, client-actionable ones to `PUBLIC_ERROR_CODES`
      (`PLAN_NOT_FOUND`, `PLAN_NAME_TAKEN`, `PLAN_ALREADY_ARCHIVED`, `PLAN_HAS_ACTIVE_SUBSCRIBERS`,
      `PRICE_NOT_FOUND`, `PRICE_PLAN_MISMATCH`, `PRICE_TIERED_NOT_SUPPORTED`, `PRICE_ALREADY_INACTIVE`);
      keep `PRICE_IMMUTABLE`/`CATALOG_INVALID_INTERVAL` mappable as BadRequest. *Proof:* a thrown
      `PLAN_HAS_ACTIVE_SUBSCRIBERS` surfaces its code on the wire (e2e); an internal-only code collapses to
      `SYSTEM_INTERNAL_ERROR`.
- [x] **Event types** — register `plan.created`, `plan.updated`, `plan.archived`, `price.created`,
      `price.deactivated` (C.6 — `plan.created`/`plan.updated` are already named in the catalog; add the
      `plan.archived` + price events as this phase's additions). These flow through the existing
      `emitEvent` chokepoint; no new emit machinery.
- [x] **`packages/sara/src/plans/`** — new submodule, files mirroring `example/`:
  - `create.ts` → `createPlan(db: InfraTxDb, ctx: DomainContext, input: CreatePlanInput):
        Promise<PlanResponseData>` — `mintReference('PLN')`; pre-check name uniqueness in scope (throw
        `PLAN_NAME_TAKEN` on the unique-index violation, surfaced as `Conflict`); insert row; `emitEvent
        'plan.created'`; return `serializePlan(row)`.
  - `queries.ts` → `getPlanByReference(db, ctx, reference)` (throws `PLAN_NOT_FOUND`);
        `listPlans(db, ctx, opts)` (keyset, optional `status` filter, returns `Page<PlanResponseData>`);
        plus the internal resolver `resolvePlanId(db, ctx, planRef): Promise<{ id, row }>` reused by the
        prices module to turn a plan **reference** into its UUID within scope.
  - `update.ts` → `updatePlan(db, ctx, reference, input)` — partial update of `name`/`description`/
        `metadata` only (status is NOT mutated here — archive is its own op); re-checks name uniqueness;
        `emitEvent 'plan.updated'`. (Status is the only thing that drifts state, and it has a dedicated path.)
  - `archive.ts` → `archivePlan(txDb: InfraTxDb, ctx, reference)` — load plan; if already `archived` throw
        `PLAN_ALREADY_ARCHIVED`; **`assertPlanArchivable(txDb, ctx, plan.id)`** (the O1 guard); in ONE
        interactive transaction: flip `status='archived'`, set `active=false` on every still-active price of
        the plan (deactivate prices so nothing new subscribes; **existing pinned prices are untouched** so
        subscribers aren't orphaned), `emitEvent 'plan.archived'` (+ one `price.deactivated` per price
        flipped). Return `serializePlan`.
  - **`assertPlanArchivable(db, ctx, planId)`** (pure-ish guard, colocated) → calls
        `countActiveSubscribers(db, ctx, planId)`; throws `AppError.Conflict(..., PLAN_HAS_ACTIVE_SUBSCRIBERS)`
        when `> 0`. **`countActiveSubscribers` is the 03 seam**: Phase-01 body returns `0` with a
        `/** SEAM(03): replace with COUNT over subscriptions … */` doc-comment naming the exact future query.
        The guard is I/O-injectable so a unit test can stub the count to `1` and assert the throw.
  - `serialize.ts` → `serializePlan(row: PlanRow): PlanResponseData` (id = reference; ISO timestamps).
  - `types.ts` → `CreatePlanInput`, `UpdatePlanInput`, `ListPlansOptions`; re-export the contract DTO types.
  - `index.ts` → barrel exporting the public functions + types. Add `"./plans": "./src/plans/index.ts"` to
        `packages/sara/package.json` `exports`.
  - *Proof:* unit tests for serialize + reference; the guard-fires test (stub count = 1 → throws
        `PLAN_HAS_ACTIVE_SUBSCRIBERS`); the archive deactivates-prices test.
- [x] **`packages/sara/src/prices/`** — new submodule (immutable; NO `update.ts`):
  - `create.ts` → `createPrice(db: InfraTxDb, ctx, input: CreatePriceInput): Promise<PriceResponseData>` —
        `assertPositiveKobo(input.unitAmount)`; reject `billingScheme === 'tiered'` with
        `PRICE_TIERED_NOT_SUPPORTED` (seam guard); `resolvePlanId(db, ctx, input.planRef)` (throws
        `PLAN_NOT_FOUND` if the plan isn't in scope — **isolation enforced in the WHERE clause**); reject
        creating a price under an `archived` plan (throw `PLAN_ALREADY_ARCHIVED`); `mintReference('PRC')`;
        insert (append-only); `emitEvent 'price.created'` with `{ reference, planRef, unitAmount, interval,
        intervalCount }`; return `serializePrice(row, input.planRef)`. **No money edit path exists** — this
        is the only way a "new version" comes into being.
  - `deactivate.ts` → `deactivatePrice(db, ctx, reference)` — the ONLY price mutation: flip `active=false`
        (throws `PRICE_ALREADY_INACTIVE` if already off); `emitEvent 'price.deactivated'`. Never touches
        `unit_amount`/`interval` — the immutable money fields stay frozen.
  - `queries.ts` → `getPriceByReference(db, ctx, reference)` (throws `PRICE_NOT_FOUND`);
        `listPrices(db, ctx, opts)` (keyset; optional `planRef` → resolve to id then filter; optional
        `active` filter); `listPricesForPlan(db, ctx, planRef, opts)` (the `/v1/plans/:ref/prices` read).
  - `serialize.ts` → `serializePrice(row: PriceRow, planRef: string): PriceResponseData` — emits `planId` as
        the plan's **reference** (the resolver supplies it; the UUID never leaves the domain), `unitAmount`
        kobo, `currency: 'NGN'`, all the interval/usage/scheme/trial fields, `active`, ISO `createdAt`.
  - `types.ts` → `CreatePriceInput` (`planRef`, `unitAmount`, `interval`, `intervalCount`, `usageType`,
        `billingScheme`, `trialPeriodDays`, `metadata?`), `ListPricesOptions`; re-export contract DTOs.
  - `index.ts` → barrel. Add `"./prices": "./src/prices/index.ts"` to `sara/package.json` `exports`.
  - *Proof:* unit tests — immutability (no `updatePrice` symbol exists; a "raise price" test creates a
        second row + deactivates the first and asserts the first row's `unit_amount` is byte-for-byte
        unchanged); tiered-rejection test; serialize emits plan **reference** not UUID.

### API (apps/api)

- [x] **`apps/api/src/modules/plans/`** — module per B.2 (`routes.ts`, `index.ts`, `controllers/`). Mirror
      `modules/example/`. Controllers (thin, `jsonHandler`/`paginatedHandler`, derive `ctx` from
      `req.apiKey`, never from client):
  - `controllers/create-plan.ts` → `POST` create (201) → `createPlan`.
  - `controllers/get-plan.ts` → `GET` one → `getPlanByReference`.
  - `controllers/list-plans.ts` → `GET` list → `listPlans` (paginated).
  - `controllers/update-plan.ts` → `PATCH` update → `updatePlan`.
  - `controllers/archive-plan.ts` → `POST .../archive` → `archivePlan` (an explicit named action, not a
        `DELETE` — O1; there is intentionally **no delete controller**).
  - `controllers/create-plan-price.ts` → `POST /plans/:ref/prices` → `createPrice` (binds `planRef` from
        the param).
  - `controllers/list-plan-prices.ts` → `GET /plans/:ref/prices` → `listPricesForPlan` (paginated).
- [x] **`apps/api/src/modules/plans/routes.ts`** — fixed middleware chain per route (B.3):
      `apiKeyAuth → rateLimit → requireScope(...) → idempotency → validate({...}) → controller`; reads skip
      `idempotency`. Routes (bare paths; `/v1` applied at the single mount):
  - `POST /plans` — `plans:write`, idempotent, `validate({ body: createPlanBody })`.
  - `GET /plans/:reference` — `plans:read`.
  - `GET /plans` — `plans:read`, `validate({ query: listPlanQuery })`.
  - `PATCH /plans/:reference` — `plans:write`, idempotent, `validate({ body: updatePlanBody })`.
  - `POST /plans/:reference/archive` — `plans:write`, idempotent (no body).
  - `POST /plans/:reference/prices` — `prices:write`, idempotent, `validate({ params, body: createPriceBody })`.
  - `GET /plans/:reference/prices` — `prices:read`, `validate({ query: listPriceQuery })`.
  Grouped under rule-comment headers ("plans CRUD", "plan lifecycle", "prices under a plan"). **No
  `DELETE /plans/:reference` route exists** (the O1 guarantee at the HTTP surface).
- [x] **`apps/api/src/modules/prices/`** — read-only module: `routes.ts` + `controllers/{get-price,list-prices}`.
  - `GET /prices/:reference` — `prices:read` → `getPriceByReference`.
  - `GET /prices` — `prices:read`, `validate({ query: listPriceQuery })` → `listPrices` (paginated; optional
        `planRef`/`active` filters). **No POST/PATCH/DELETE on `/v1/prices`** — prices are created only under
        their plan (`/plans/:ref/prices`) and are immutable; this read-only top-level resource is the global
        lookup surface.
- [x] **Mount** — `apps/api/src/app/main/routes.ts`: `v1Router.use(plansRouter)` and
      `v1Router.use(pricesRouter)`. Add `plans:read|write`, `prices:read|write` to the api-key scope set
      wherever the example scopes are enumerated (the `requireScope` middleware + the api-key contract).
      *Proof:* `GET /v1/health` still green; routes resolve under `/v1`.

### Wiring

- [x] **No queue / scheduler / rail work this phase.** Catalog is provider-agnostic and synchronous; no
      outbox worker beyond the existing `emitEvent` fan-out, no Nomba adapter. (The interval columns are
      *consumed* by 04's scheduler, the price pin by 03's subscription — both downstream.) Explicitly record
      "no wiring added" so a reviewer doesn't hunt for it.
- [x] **Seam doc** — add a `/** SEAM(03) */` comment block in `plans/archive.ts` at `countActiveSubscribers`
      naming the exact 03 query and the unchanged call site, and a `/** SEAM(05) */` comment in
      `prices/create.ts` at the `tiered` rejection naming the future `price_tiers` table + serializer field.
      *Proof:* grep for `SEAM(03)` / `SEAM(05)` returns these two anchors.

### Tests

- [x] **e2e (testcontainers, real migrations + middleware chain)** — `apps/api/.../plans.e2e.test.ts`:
  - create plan → get → list → update → create price under it → list its prices → get price via `/v1/prices`
    → archive plan; every response asserts the single envelope + `meta.requestId`; money asserted as integer
    kobo; timestamps ISO-8601 UTC (**L1, L3, L4**).
  - **Idempotency-Key replay** on `POST /plans` and `POST /plans/:ref/prices`: same key → same body returned,
    `COUNT` of rows unchanged (**K1**).
  - **uniqueness**: a second `POST /plans` with the same name in the same org/env → `409 PLAN_NAME_TAKEN`
    (**K2, L2**).
  - **archive guard (O1)**: with `countActiveSubscribers` stubbed (via the injected seam) to return `1`,
    `POST /plans/:ref/archive` → `409 PLAN_HAS_ACTIVE_SUBSCRIBERS`; with `0`, archive succeeds and the plan's
    prices come back `active=false`.
  - **no-delete proof (O1)**: `DELETE /v1/plans/:ref` → `404`/`405` (route absent).
  - **tenant isolation (H2 ⚠)**: Tenant A's key cannot `GET`/`PATCH`/`archive` Tenant B's plan, nor read
    Tenant B's price — each returns `404 *_NOT_FOUND` (the reference doesn't exist in A's scope).
  - **auth (N4)**: every mutating route without a valid key → `401`; with a read-only key hitting a `:write`
    route → `403`.
  - **immutability (versioning)**: create price P1; "raise" via new price P2 + deactivate P1; re-fetch P1 →
    `unitAmount` unchanged, `active=false`; P2 `active=true`. There is no endpoint that edits P1's amount.
- [x] **unit (colocated in `sara`)**:
  - `plans/serialize` + `prices/serialize` (id = reference, plan **reference** not UUID, ISO timestamps).
  - `mintReference('PLN'|'PRC')` shape.
  - `assertPlanArchivable` throws on stubbed count `> 0`, passes on `0`.
  - `createPrice` rejects `tiered` (`PRICE_TIERED_NOT_SUPPORTED`) and rejects a non-positive amount
    (`assertPositiveKobo`).
  - default-filling: `createPriceBody.parse({ unitAmount, interval })` yields all L5 defaults.
- [x] **grep gate**: zero new `example`/`EXA` references introduced by this phase; the two seam anchors
      present.

---

## Verification checklist (rubric → how demonstrated)

> **✅ PHASE 01 DONE (2026-06-30, commit 79d3c84 on `build/apps-api`).** Every box below is **demonstrated**:
> A(versioning), H1, H2, K1, K2, L1–L6, N4, O1 — via 5 catalog e2e + 3 sara unit tests (21 api e2e + 31 sara
> unit + 9/9 workspace type-check all green; migration `0002` applies on a fresh testcontainer DB). One small
> addition beyond the plan's letter: a `POST /v1/prices/:reference/deactivate` action endpoint — the
> versioning workflow needs a way to retire the old price after creating its replacement; it's a sellability
> state change (the only mutation a price allows), not a money edit, so it stays consistent with immutability.

- [x] **A (versioning, catalog half)** — a price row is never edited; "raising a price" creates a new `prices`
      row and deactivates the old one, proven by the immutability e2e (P1's `unit_amount` unchanged after P2)
      and by the absence of any `updatePrice` domain function / `PATCH /v1/prices` route. (Subscription pin →
      03.)
- [x] **H1** — `plans` and `prices` both carry `organization_id` + `environment` (schema review; every WHERE
      clause filters on both).
- [x] **H2 ⚠** — isolation e2e: Tenant A cannot read or mutate Tenant B's plan/price on any catalog endpoint
      (read once in code review of the WHERE clauses, run once via the cross-tenant test).
- [x] **K1 ⚠** — `Idempotency-Key` replay on `POST /plans` and `POST /plans/:ref/prices` returns the original
      result with no new row (replay e2e).
- [x] **K2** — `unique(reference)` and `unique(org, env, name)` make duplicate plans structurally impossible;
      the `409 PLAN_NAME_TAKEN` e2e proves the constraint, not just a code check.
- [x] **L1** — RESTful, consistent verbs: `POST/GET/PATCH /v1/plans`, action `POST /v1/plans/:ref/archive`,
      nested `POST/GET /v1/plans/:ref/prices`, read-only `GET /v1/prices` (route table review + e2e).
- [x] **L2 ⚠** — single error envelope, stable `PLAN_*`/`PRICE_*` codes; an internal-only code collapses to
      `SYSTEM_INTERNAL_ERROR` (error-shape assertions in e2e).
- [x] **L3** — every list (`/v1/plans`, `/v1/plans/:ref/prices`, `/v1/prices`) is cursor-paginated with
      `nextCursor`/`hasMore`, no total count (pagination e2e).
- [x] **L4** — timestamps ISO-8601 UTC; `unitAmount` integer kobo + `currency: 'NGN'` on every price DTO
      (serializer review + e2e field assertions).
- [x] **L5** — `POST /plans/:ref/prices` with only `{ unitAmount, interval }` succeeds, all other fields
      defaulted (`intervalCount=1`, `usageType=licensed`, `billingScheme=per_unit`, `trialPeriodDays=0`,
      `currency=NGN`, `active=true`) — default-fill unit test + e2e.
- [x] **L6** — every catalog route is under `/v1` (mount review).
- [x] **N4** — every catalog route enforces `apiKeyAuth` + the correct scope; no unauthenticated mutating
      route; `:read` key on a `:write` route → `403` (auth e2e; route-chain review).
- [x] **O1 ⚠** — *plan with active subscribers not orphaned/deletable*: (read) no `DELETE` route + FK
      `onDelete: restrict` on `prices.plan_id` + price immutability; (run) `assertPlanArchivable` blocks
      archive with stubbed subscriber count `> 0` → `409 PLAN_HAS_ACTIVE_SUBSCRIBERS`, archive deactivates
      prices when count `= 0`. Seam wired to real `subscriptions` count in 03 with no call-site change.

---

## Done when

`plans` and `prices` are a complete real vertical slice across every layer: the two tables migrate cleanly on
a fresh DB; `sara/plans` and `sara/prices` enforce price **immutability** (new version = new row) and the
**archive-not-delete** guard (`assertPlanArchivable`, seam-ready for 03); `/v1/plans` CRUD + archive,
`/v1/plans/:ref/prices`, and read-only `/v1/prices` run the full fixed middleware chain with
`plans:read|write` / `prices:read|write` scopes; events `plan.created|updated|archived` and
`price.created|deactivated` emit through the outbox; the rubric boxes above are green; and
`pnpm type-check`, `pnpm build`, `pnpm test` pass across the workspace. The catalog is now a clean base for
03 (a subscription pins a `price`), 04 (the scheduler reads the interval data), and 05 (tiered/proration on
the `billing_scheme` seam).
