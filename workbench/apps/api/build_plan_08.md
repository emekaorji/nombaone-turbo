# apps/api — Build Plan 08 · Multi-tenancy hardening & settlement ★

> Make tenant isolation a **proven property of the data model** (not a hope) and settle every collection
> through Nomba **sub-accounts + an inline `splitRequest`** so the tenant's share and the platform fee
> separate automatically at collection time. Adds per-tenant config/limits/quotas, a **fair (round-robin,
> budgeted) billing sweep** so one large tenant cannot starve others, a `settlements` ledger artifact with
> reconciliation, and an automated **A-cannot-touch-B** test across **every** endpoint.
> **Depends on:** 02 (`org_nomba_accounts` seam + rail registry + OAuth client + inbound ingest), 03
> (subscriptions/invoices + charge→ledger→verify loop the split rides on), 04 (the base scheduler: idempotent
> sweep, concurrency locks, catch-up — this phase only changes *selection order*, not the locking), 05
> (final `amount_due` the split is computed against), 06 (`org_billing_settings` — this phase extends that
> row), 07 (`settlement.created` outbound event delivery + per-tenant webhook config surface this phase
> finalizes). **Unblocks:** 09 (per-tenant metrics/logs, settlement reconciliation in the nightly job, the
> full isolation + scale proof).

---

## Objective & scope

This phase is one of the two `★` win axes (**H — Multi-tenant cleanliness**). It is built to *win* the axis,
not to a floor: isolation is **demonstrated by an automated cross-tenant test on every route**, and
settlement is the real Nomba sub-account + split model, not a stub.

**In scope**
- **Isolation hardening + the proof.** Audit that every domain entity carries `(organization_id, environment)`
  and that every `sara` read/write filters on the `ctx` pair; add a single, data-driven **A↔B isolation
  e2e** that walks the **whole route table** and asserts Tenant A's key can neither **read** nor **mutate**
  Tenant B's resources (404/forbidden, never a leak). **H1 / H2 ⚠ / H3.**
- **Per-tenant config surface (finalized).** `org_billing_settings` (built in 06) is **extended** with the
  tenant-facing config this axis requires (limits/quotas, settlement preferences, branding) and the existing
  **webhook endpoint + per-tenant HMAC secret** (07) is surfaced as part of the same tenant-config story.
  **H4.**
- **Per-tenant rate limits / quotas.** The existing fixed-window limiter (`shared/middlewares/rate-limit.ts`)
  gains a **per-tenant override** resolved from `org_billing_settings` (with the platform default as the
  floor), plus a coarse **monthly request quota** so one tenant cannot exhaust shared capacity. **H6.**
- **Fair billing scheduling (★).** A **round-robin, per-tenant-budgeted** selection layer on top of 04's sweep
  so a tenant with 1,000,000 due subscriptions cannot monopolize a single window and starve a tenant with 10.
  The locking/idempotency/catch-up stay 04's — this phase only changes *which rows a tick claims, in what
  order, under a per-tenant cap*. **H7 ★.**
- **Settlement (★).** Map each tenant to a Nomba **sub-account** (`org_nomba_accounts`, finalized here),
  attach an inline **`splitRequest`** to every collection so the **tenant share lands in their sub-account and
  the platform fee is separated automatically** at collection time (per integration reference §4.6/§1.; the
  platform fee comes from the existing **clamped fee engine** `config/fees.ts`). Record each split as a
  `settlements` row with a corresponding **double-entry ledger posting** (`settlement` + `fee` kinds already
  exist), emit `settlement.created`, and **reconcile** settlements against Nomba's record by `merchantTxRef`.
  Payouts/refunds beyond the original collection window go through **Transfers**. **H5 ★.**
- **Tenant-filterable metrics/logs.** Guarantee every billing-related log line and the settlement/quota
  records carry `organization_id` + `environment` + correlation id so 09's dashboards can filter by tenant.
  **H8.**
- **Cross-tenant concurrency safety (K).** A race test proving two tenants' sweeps/charges running concurrently
  never cross-contaminate state, and the fair-sweep claim stays single-charge per `(subscription, period)`.
  **K3 ⚠ (cross-tenant slice).**

**Out of scope (owned elsewhere — do not poach)**
- The **core billing loop** (charge→ledger→verify, invoice lifecycle, the `past_due` transition) is **03**;
  settlement *rides on* the verified collection, it does not re-implement it.
- The **base scheduler** (sweep idempotency, advisory/row locks, `(subscription_id, period_index)` uniqueness,
  catch-up after downtime) is **04**; the fair layer here **wraps** 04's selection and reuses its locks — it
  adds no new locking primitive.
- The **OAuth client + token cache**, the **rail registry**, the **inbound webhook ingest/dedup**, and the
  first cut of `org_nomba_accounts` (the sub-account creation call) are **02**; this phase *finalizes* the
  mapping table for settlement and *consumes* the adapters, never re-spec'ing them.
- **Outbound webhook delivery internals** (HMAC signing, retry/backoff, dead-letter, replay) are **07**; this
  phase only **emits** `settlement.created` and **surfaces** the per-tenant endpoint/secret config — the
  delivery machinery is 07's.
- **The dunning policy fields** of `org_billing_settings` (attempts/intervals/grace/payday) are **06**; this
  phase adds the *limits/settlement/branding* fields to the same table and does not touch dunning semantics.
- **Dashboards / business metrics** (MRR, churn, dunning funnel) and the **full isolation + scale proof**
  (10k-tenant fairness load test, the formal "every endpoint" sweep at scale) are **09**; this phase ships the
  tenant-tagged records + the route-walking isolation e2e those build on.

---

## Rubric coverage

Exact exit-criteria boxes this phase demonstrates (`SUBSCRIPTIONS-ENGINE-EXIT-CRITERIA.md`):

**H. Multi-tenancy** — all boxes:
- **H1** — every domain entity (plan, subscription, invoice, customer, token ref) carries a `tenant_id`
  (`organization_id`).
- **H2 ⚠** — tenant isolation **proven**: an automated test shows Tenant A's credentials cannot read or mutate
  Tenant B's data **on any endpoint**.
- **H3** — API keys map to **exactly one** tenant; there is no ambient "god" key in any normal request path.
- **H4** — per-tenant configuration supported: plans, dunning/retry policy, **webhook URL + secret**, branding,
  grace period.
- **H5 ★** — settlement uses Nomba **sub-accounts + split payments**: the tenant's share lands in their
  sub-account and the platform fee is **separated automatically** at collection.
- **H6** — per-tenant rate limits / quotas so one tenant cannot exhaust shared capacity.
- **H7 ★** — the billing scheduler is **fair** across tenants — one very large tenant cannot starve others of a
  billing run.
- **H8** — metrics and logs are **filterable by tenant**.

**K. Idempotency & concurrency** — the cross-tenant slice:
- **K3 ⚠** — a portal/charge and a scheduler charge hitting the same subscription concurrently do not corrupt
  state — re-asserted **across tenants** (two tenants' sweeps in flight) plus the fair-sweep claim staying
  single-charge per `(subscription, period)`.

Cross-cutting boxes this phase must not regress (owned earlier, re-asserted in tests here):
**N3** every endpoint authed + scoped (the isolation walk also proves no unauthenticated/cross-tenant
mutation) · **L4** money represented consistently (settlement amounts are integer kobo everywhere) · **J5**
every money-affecting change posts a ledger entry (the split posts one) · **J7 ★** reconciliation exists
(settlements reconciled against Nomba by `merchantTxRef`) · **M1** logs carry correlation + tenant ids ·
**K2** unique constraints make duplicate settlements structurally impossible.

---

## Design notes

### Isolation is a property of the data model, proven on every endpoint (H1/H2/H3)
The contract (B.6/B.8) already mandates `(organization_id, environment)` on every tenant row and a
caller-supplied `ctx: DomainContext` on every `sara` function — handlers derive `ctx` from the **verified**
API key (`req.apiKey`), never from client input, and a key is born pinned to one org+env (`api-keys/keys.ts`).
This phase does **not** invent a new isolation mechanism; it **proves the existing one** and closes any gap:

- **Static audit (read pass).** A test-time invariant scan asserts (a) every tenant-scoped table in
  `core-db/src/schema` carries `organization_id` + `environment`, and (b) every `sara` query module's
  `WHERE` clause filters on both `ctx.organizationId` and `ctx.environment`. Documented as a checklist mapping
  each table → its scoping columns and each public `sara` read → its filter.
- **The A↔B route-walking e2e (run pass).** A single, **data-driven** suite seeds Tenant A and Tenant B (each
  with its own key + a full set of resources), then iterates a **route manifest** — every mutating and reading
  `/v1/...` route in the app — issuing each request **with A's key against B's reference**. Every call must
  resolve to `404 *_NOT_FOUND` (a missing-in-your-tenant read) or `403`/`404` on mutate — **never** a 200 with
  B's data and **never** a successful write. The manifest is asserted **complete** against the mounted router
  (a route present in `app/main/routes.ts` but absent from the manifest fails the test) so new endpoints can
  never silently skip the proof. **This is the H2 ⚠ centrepiece** and is verified twice (the static audit =
  read; the route walk = run).
- **No god key.** A negative test asserts there is no scope or key shape that bypasses the `ctx` filter; the
  only principal in a request path is a single-tenant verified key (`H3`). The operator/admin surface
  (`apps/admin`, separate auth) is explicitly **not** mounted on the tenant API.

### Per-tenant config surface, finalized (H4)
`org_billing_settings` (06) is the one **policy row per `(org, env)`** (`unique(organization_id, environment)`).
06 owns the dunning/grace/payday columns; **this phase adds**, on the same row (additive columns only — 06
left it open):
- `rate_limit_per_minute` int **nullable** (override of the limiter's `WINDOW_LIMIT` floor; `null` ⇒ platform
  default),
- `monthly_request_quota` bigint **nullable** (coarse monthly cap; `null` ⇒ unlimited / platform default),
- `settlement_mode` (`pgEnum org_settlement_mode: split_at_collection | collect_then_payout`, default
  `split_at_collection`),
- `platform_fee_bps` int **nullable**, `platform_fee_min_kobo` bigint **nullable**, `platform_fee_max_kobo`
  bigint **nullable** (the per-tenant override seam the fee engine `resolveFee` already documents; `null` ⇒
  `DEFAULT_FEE_SCHEDULE`),
- `branding` jsonb (`{ displayName?, supportEmail?, logoUrl?, primaryColorHex? }`, default `{}`) — the
  tenant-branding field H4 names; surfaced in tenant config + carried into outbound payloads where relevant.

The **webhook URL + secret** half of H4 already lives in `webhook_endpoints` (per-tenant `signing_secret_hash`
+ `signing_secret_prefix`, built/owned by 07). This phase does **not** duplicate it; it **surfaces** it as part
of the unified `GET /v1/settings` tenant-config read (a read-only projection that joins `org_billing_settings`
+ the tenant's `webhook_endpoints` row + plan/branding) so a tenant sees "all my configuration" in one place.
Per-tenant **plans** and **dunning policy** are owned by 01/06; H4 is satisfied by them existing + being
tenant-scoped, re-asserted in the isolation walk.

### Per-tenant rate limits / quotas (H6)
The limiter stays a **fixed-window Redis counter** (no rewrite of `rate-limit.ts`'s hot path) but the cap
becomes **per-tenant**:
- `resolveRateLimit(db, ctx): Promise<{ perMinute: number }>` (sara, one cached read) returns
  `org_billing_settings.rate_limit_per_minute ?? PLATFORM_RATE_LIMIT` — the platform default is the **floor**,
  a tenant override may only be set by an operator (never self-raised through the tenant API; the tenant config
  PUT rejects raising one's own limit above the platform ceiling). The resolved cap is cached in Redis
  (`ratelimit:cfg:{org}:{env}`, short TTL) so the hot path stays one `INCR` + one conditional `EXPIRE`.
- A coarse **monthly quota**: a second Redis counter keyed `quota:{org}:{env}:{YYYYMM}` incremented per
  request; over `monthly_request_quota` ⇒ `429 QUOTA_EXCEEDED` (distinct code from `RATE_LIMIT_EXCEEDED`).
  Fail-open on a Redis outage exactly like the existing limiter (an outage of the limiter must never become an
  outage of the API). The quota counter is reconciled to a durable count nightly (09) but is Redis-authoritative
  in-window.
- Keyed per **API key** for the per-minute window (unchanged) but the **cap and quota are per org** so multiple
  keys of one tenant share the tenant's budget. **H6.**

### Fair billing scheduling (H7 ★) — no tenant starves the run
04's sweep is a single "find all subscriptions due now, claim each under a lock, charge once." At scale that
selection is **biased**: a tenant with a huge backlog fills the window and a small tenant's due subscriptions
wait (or miss the window). The fix is a **fair selection layer** — 04's locking and idempotency are untouched;
only the *order and budget* of claiming change:

- `selectDueSubscriptionsFair(db, env, now, { globalBudget, perTenantBudget })` replaces the naive "ORDER BY
  due_at LIMIT n" with a **round-robin over tenants**: it first finds the **distinct tenants with due work**
  (`SELECT DISTINCT organization_id WHERE due ...`), then draws up to `perTenantBudget` due subscriptions
  **per tenant** in a rotation until `globalBudget` is filled — so each tenant gets a fair share of every tick
  and a backlog tenant is bounded to `perTenantBudget` per window. Oldest-due-first **within** each tenant
  (no subscription is starved *within* a tenant either). Implemented with a window function
  (`row_number() over (partition by organization_id order by due_at, id)` then `where rn <= perTenantBudget`),
  a single indexed query over 04's due-selection index — no N+1 per tenant.
- A **starvation guard**: a tenant whose due work exceeded `perTenantBudget` last tick is *prioritized* in the
  rotation next tick (carry a `last_swept_at` cursor per `(org, env)` so the rotation advances and no tenant is
  perpetually at the back). The carry-over is a tiny `org_sweep_cursor`-style state — but rather than a new
  table, this is a Redis sorted set `sweep:rotation:{env}` scored by `last_swept_at`, drained oldest-first; it
  is advisory (the source of truth for "what's due" stays the DB), so a Redis loss only reshuffles fairness,
  never correctness. **Catch-up (04) still drains backlogs across ticks** — fairness shapes *order within a
  tick*, 04's catch-up guarantees *eventual completion across ticks*.
- The claim itself is still 04's: status-guarded / row-locked update gated by 04's
  `(subscription_id, period_index)` uniqueness, so two ticks (or two workers) never double-charge — proven
  again by the **cross-tenant race test (K3)**.

This is `H7 ★`: demonstrated by a fixture where Tenant A has 10,000 due subscriptions and Tenant B has 10, and
a bounded set of ticks bills **all of B** without B waiting behind all of A.

### Settlement: sub-account + inline split (H5 ★)
Per the integration reference, settlement uses Nomba **sub-accounts** + an **inline `splitRequest`** at
collection (§4.6/§1), separating the tenant share and platform fee **at collection time** rather than
collect-then-payout. The platform fee is the existing **clamped fee engine** (`config/fees.ts`
`resolveFee` → `computeClampedFee`, basis-points clamped into `[min, max]`, integer kobo), now reading the
per-tenant override fields added to `org_billing_settings`.

- **`org_nomba_accounts` (finalized).** Tenant ↔ Nomba sub-account mapping, per env: the stable
  `account_ref` we mint and pass to Nomba (so we resolve the sub-account from our DB without storing Nomba's id
  as a PK), the Nomba-side `sub_account_id` (foreign ref only), and status. 02 creates the sub-account on org
  onboarding; this phase **finalizes the columns** settlement needs and the `resolveTenantSubAccount(db, ctx)`
  helper. **⚠ confirm in sandbox** whether the team surface exposes distinct sub-accounts with their own
  balances vs virtual-account attribution (integration ref §1/§4.1) — the adapter is written to the team-doc
  sub-account surface and corrected if the sandbox disagrees; the *settlement domain* (split math, ledger
  posting, reconciliation) is provider-shape-agnostic and does not change either way.
- **Inline split at collection.** When 03's collection is created (checkout order / tokenized charge), the rail
  call carries a `splitRequest` built by `buildSplitRequest(ctx, { grossKobo, subAccountId, platformFeeKobo })`
  → `{ splitType: 'AMOUNT', splitList: [{ accountId: subAccountId, value: grossKobo - platformFeeKobo }] }`
  (the platform fee is the **remainder** that stays on the parent account — separated automatically). Split
  type/semantics are an **⚠ confirm-in-sandbox** flag (integration ref §4.6): the builder is the single seam,
  so a `PERCENTAGE` vs `AMOUNT` or "fee leg explicit vs remainder" sandbox finding changes one pure function.
  Money is integer **kobo** end-to-end (no boundary conversion — team-confirmed); `gross = tenantShare + fee`
  is asserted to the kobo (`assertSplitBalances`) so no kobo leaks.
- **The `settlements` artifact + ledger posting.** On the **verified** `payment_success` (webhook + requery —
  never the sync reply), `recordSettlement(txDb, ctx, input)` writes one `settlements` row (`gross_kobo`,
  `platform_fee_kobo`, `net_to_tenant_kobo`, `sub_account_ref`, `split_reference`, `merchant_tx_ref`,
  `invoice_id`, `status`) **and** posts a balanced double-entry transaction in the **same interactive
  transaction** (kind `settlement` for the tenant-share leg, kind `fee` for the platform-fee leg, into the
  well-known `platform_fees` system account — `ledger_accounts.key`'s one-of-kind-per-tenant pattern). The
  status (`settled`) is **derived from the ledger posting**, not a free-standing field. Then emit
  `settlement.created` (07 delivers it). Idempotent: `unique(merchant_tx_ref)` + `unique(invoice_id)` make a
  duplicate settlement structurally impossible (`K2`), so a replayed webhook records exactly one settlement and
  posts exactly one ledger transaction (`J6` discipline carried). **H5 ★ / J5.**
- **Payouts & refunds.** True outbound movement (tenant payout of a sub-account balance, or a refund beyond the
  original collection window) goes through **Transfers** (`/transfers/bank/lookup` → `/transfers/bank`, unique
  `merchantTxRef`, resolve-name-first — integration ref §4.6) via `payoutToTenant` / `refundSettlement`, each
  posting its own reversing/settling ledger entries. `collect_then_payout` tenants (the non-default
  `settlement_mode`) settle to the parent then payout on a schedule; `split_at_collection` (default) needs no
  payout for the collection itself. **⚠** Transfer endpoint version + status path are sandbox-confirm flags
  (integration ref §4.6) — isolated in the 02 rail adapter, not the settlement domain.
- **Reconciliation.** `reconcileSettlements(db, ctx, window)` extends 09's nightly job seam: pull Nomba's
  transactions for the window (filtered, by `merchantTxRef`) and diff against `settlements` joined on
  `merchant_tx_ref` — surface orphans (on Nomba, not local), missing splits, and amount drift; it reuses the
  zero-sum discipline of `reconciliation/reconcile.ts` (every settlement's ledger legs sum to zero) as the
  local-side invariant. **J7 ★.**

### Tenant-filterable metrics & logs (H8 / M1)
Every settlement/quota/sweep record already carries `(organization_id, environment)`. This phase adds a
**structured-log contract** for billing-related actions: each log line emitted on a billing path
(`settlement`, `sweep claim`, `rate-limit/quota reject`, `charge`) includes `organizationId`, `environment`,
and the request/job correlation id, via a small `withTenantLog(ctx, correlationId)` logger helper so the field
shape is uniform and 09 can filter by tenant. No PII in logs (N5). **H8 / M1.**

### Money & idempotency invariants (carried)
Money is integer **kobo** end-to-end; `gross = net_to_tenant + platform_fee` to the kobo. The settlement's
`merchant_tx_ref` is the same per-collection ref 03 used on the rail (so the split and the charge reconcile to
one Nomba transaction), and `unique(merchant_tx_ref)` + `unique(invoice_id)` enforce exactly-one-settlement.
Every row is tenant-scoped `(organization_id, environment)`. Outcomes are verified server-side
(webhook + requery), never the sync reply.

---

## Tasks (layer by layer)

### DB (core-db)

- [ ] **`settlements`** table (`packages/core-db/src/schema/settlements.ts`): `idPk()`, `referenceCol()` (STL),
      `organization_id` FK → organizations (cascade), `environment` (`environmentEnum`), `invoice_id` FK →
      invoices, `customer_id` FK → customers, `sub_account_ref` text (our stable `org_nomba_accounts.account_ref`),
      `split_reference` text nullable (Nomba split/order ref, foreign ref only), `merchant_tx_ref` text (the
      per-collection idempotency key, shared with the charge), `gross_kobo` bigint, `platform_fee_kobo` bigint,
      `net_to_tenant_kobo` bigint, `ledger_transaction_id` FK → ledger_transactions nullable (the posting this
      settlement produced), `status` (`pgEnum settlement_status: pending | settled | reconciled | failed |
      refunded`), `created_at` (append-only fact — **no `updated_at`**, mirroring `ledger_transactions`).
      Proof: migration applies on a fresh DB; a row reads back with `gross = fee + net`.
- [ ] Indexes on `settlements`: `unique(reference)`; **`unique(merchant_tx_ref)`** and **`unique(invoice_id)`**
      (a duplicate settlement is structurally impossible — `K2`); keyset
      `(organization_id, environment, created_at desc, id desc)` for the list endpoint; index on
      `(organization_id, environment, status)` for reconciliation selection.
- [ ] DB-level `check` constraint `gross_kobo = platform_fee_kobo + net_to_tenant_kobo` and
      `platform_fee_kobo >= 0`, `net_to_tenant_kobo >= 0` (the split-balances invariant enforced structurally,
      mirroring `ledger_entries`' positive-amount check).
- [ ] **`org_nomba_accounts`** (finalize — created by 02; this phase adds the settlement columns if absent and
      asserts the shape): `idPk()`, `referenceCol()` (NMA — contract C.4), `organization_id` FK, `environment`,
      `account_ref` text (our stable ref passed to Nomba), `sub_account_id` text nullable (Nomba-side id,
      foreign ref only), `status` (`pgEnum nomba_account_status: pending | active | suspended`, default
      `pending`), `created_at`, `updatedAt()`; **`unique(organization_id, environment)`** (one sub-account per
      tenant/env) and `unique(account_ref)`. If 02 already shipped the table, this is an **additive migration**
      only (no column drops). Proof: migration applies; `resolveTenantSubAccount` reads it back.
- [ ] **Extend `org_billing_settings`** (additive columns only — created in **05**, dunning columns added in **06**; this phase adds limits/settlement columns):
      `rate_limit_per_minute` int nullable, `monthly_request_quota` bigint nullable, `settlement_mode`
      (`pgEnum org_settlement_mode: split_at_collection | collect_then_payout`, default `split_at_collection`),
      `platform_fee_bps` int nullable, `platform_fee_min_kobo` bigint nullable, `platform_fee_max_kobo` bigint
      nullable, `branding` jsonb default `'{}'`. Proof: migration applies on top of 06's table; a row reads back
      with new defaults and 06's dunning columns intact.
- [ ] Add `settlements` (and `org_nomba_accounts` if new) to `packages/core-db/src/schema/index.ts`.
- [ ] `pnpm db:generate` then `pnpm db:migrate` — one clean additive migration; verify on a fresh DB **and** on
      a DB already migrated through 06/07 (additive, no rewrite). **Never `push`.**

### Contracts (core-contracts)

- [ ] `packages/core-contracts/src/types/settlement.ts`: `SettlementResponseData` (reference, invoiceReference,
      customerReference, subAccountRef, splitReference, grossKobo, platformFeeKobo, netToTenantKobo, status,
      createdAt — ISO-8601 UTC, integer kobo fields, no PII).
- [ ] `packages/core-contracts/src/types/settings.ts`: `TenantSettingsResponseData` — the unified config read:
      `{ billing: { rateLimitPerMinute, monthlyRequestQuota, settlementMode, platformFee: {bps,minKobo,maxKobo},
      grace/dunning summary (from 06), branding }, webhook: { url?, signingSecretPrefix?, configured: boolean }
      (from 07, secret never returned), nombaAccount: { accountRef, status } }`.
- [ ] `packages/core-contracts/src/validations/settlement.ts`: `listSettlementsQuery` (cursor + limit + optional
      `status` filter; numbers via `.coerce`, per `listExampleQuery` shape).
- [ ] `packages/core-contracts/src/validations/settings.ts`: `updateTenantSettingsBody` — all settlement/limit/
      branding fields **optional** (partial update); `monthly_request_quota = z.coerce.number().int().min(0)`;
      `platform_fee_bps` 0–10000; `branding` a strict object (`displayName?`, `supportEmail?` email,
      `logoUrl?` url, `primaryColorHex?` hex); **refine that `rate_limit_per_minute` cannot be set above the
      platform ceiling through this body** (only an operator may raise it) — the tenant API cannot self-raise
      its own limit (`H6` discipline). DTO via `z.infer`.
- [ ] Add the new scopes to the API-key scope set + `ApiKeyScope` vocabulary: `settlements:read`,
      `settings:read`, `settings:write`. Export all new types/validations from the contracts barrels.

### Domain (sara)

All functions follow the `(db, ctx, input)` idiom; `ctx: DomainContext` is always caller-supplied and never
trusted from the client. Pure math/builders are I/O-free and unit-tested alone.

- [ ] `reference.ts`: add `STL` (settlement) to `ReferenceDomain` (reserved in contract C.4; this phase
      activates it), and `NMA` for `org_nomba_accounts` if 02 did not already.
- [ ] `errors`: add the **`SETTLEMENT_*`** group to `packages/errors/src/codes.ts`:
      `SETTLEMENT_SUBACCOUNT_NOT_FOUND`, `SETTLEMENT_SPLIT_UNBALANCED`, `SETTLEMENT_ALREADY_RECORDED`,
      `SETTLEMENT_NOT_FOUND`, `SETTLEMENT_PAYOUT_FAILED`, `SETTLEMENT_RECONCILE_DRIFT`; add the **`QUOTA_*`**
      group: `QUOTA_EXCEEDED`. Add client-safe ones (`SETTLEMENT_NOT_FOUND`, `SETTLEMENT_SUBACCOUNT_NOT_FOUND`,
      `QUOTA_EXCEEDED`) to `PUBLIC_ERROR_CODES`; the rest collapse to `SYSTEM_INTERNAL_ERROR`.

- [ ] **`packages/sara/src/settlement/`** (export `./settlement` via `sara/package.json`):
      - `accounts.ts`: `resolveTenantSubAccount(db, ctx): Promise<{ accountRef: string; subAccountId: string |
        null }>` — read `org_nomba_accounts` for `(org, env)`; throw `SETTLEMENT_SUBACCOUNT_NOT_FOUND` if the
        tenant was never onboarded to a sub-account (a settlement cannot proceed without one). **H5.**
      - `split.ts` (pure): `assertSplitBalances({ grossKobo, platformFeeKobo, netToTenantKobo })` — throws
        `SETTLEMENT_SPLIT_UNBALANCED` unless `gross = fee + net`, all non-negative integers (the kobo-exact
        guard, mirroring `assertBalanced`). `buildSplitRequest(ctx, { grossKobo, subAccountId, platformFeeKobo
        })` — returns the provider-agnostic split descriptor `{ splitType: 'AMOUNT', splitList: [{ accountId:
        subAccountId, value: grossKobo - platformFeeKobo }] }` for the rail adapter to attach to the collection;
        the platform fee is the **remainder** on the parent (separated automatically). The single seam for the
        **⚠ sandbox split-semantics** flag. **H5 ★.**
      - `fees.ts` shim: `resolvePlatformFee(db, ctx, grossKobo)` — call `resolveFee` (`config/fees.ts`) but
        pass the **per-tenant override** from `org_billing_settings` (`platform_fee_bps/min/max`) when present,
        else `DEFAULT_FEE_SCHEDULE`; returns clamped integer kobo. (Extends `resolveFee`'s documented per-org
        seam — no math change, only policy resolution.)
      - `record.ts`: `recordSettlement(txDb, ctx, { invoiceId, customerId, merchantTxRef, grossKobo,
        splitReference })` — in ONE `txDb.transaction`: resolve fee + net, `assertSplitBalances`, insert the
        `settlements` row, **post the double-entry** via `postTransaction` (kind `settlement` for the
        tenant-share leg + kind `fee` into the `platform_fees` system account), link
        `settlements.ledger_transaction_id`, set `status = settled`, emit `settlement.created`. Idempotent on
        `unique(merchant_tx_ref)` / `unique(invoice_id)`: a replay is a no-op returning the existing row
        (`SETTLEMENT_ALREADY_RECORDED` swallowed into idempotent success, never a double post). **H5 ★ / J5 / K2.**
      - `payout.ts`: `payoutToTenant(txDb, ctx, { subAccountRef, amountKobo, bank })` (Transfers, resolve-name-
        first, unique `merchantTxRef`, posts the payout ledger legs) and `refundSettlement(txDb, ctx,
        { settlementId, amountKobo })` (reversing legs, status `refunded`) — the `collect_then_payout` +
        beyond-window path. **H5.**
      - `reconcile.ts`: `reconcileSettlements(db, ctx, { from, to })` — diff Nomba transactions (by
        `merchantTxRef`) against `settlements`; return `{ matched, orphansOnNomba, missingLocally, amountDrift }`
        and assert each settlement's ledger legs sum to zero (reuse `reconciliation/reconcile.ts` discipline);
        throw `SETTLEMENT_RECONCILE_DRIFT` past the band. **J7 ★.**
      - `queries.ts`: `getSettlementByReference(db, ctx, ref)`, `listSettlements(db, ctx, page)` (cursor),
        `selectSettlementsForReconcile(db, ctx, window)`. `serialize.ts`: `serializeSettlement`. `types.ts`,
        `index.ts` (barrel).

- [ ] **`packages/sara/src/tenant-config/`** (export `./tenant-config`):
      - `limits.ts`: `resolveRateLimit(db, ctx): Promise<{ perMinute: number }>` (read
        `org_billing_settings.rate_limit_per_minute ?? PLATFORM_RATE_LIMIT`, platform default = floor;
        Redis-cached) and `resolveQuota(db, ctx): Promise<{ monthly: number | null }>`. `PLATFORM_RATE_LIMIT`
        `as const` (mirrors the limiter's current `WINDOW_LIMIT = 120`). **H6.**
      - `config.ts`: `getTenantSettings(db, ctx)` (the unified read — joins `org_billing_settings` +
        `webhook_endpoints` (07, secret never returned) + `org_nomba_accounts`), `updateTenantSettings(db, ctx,
        input)` (additive partial upsert on `org_billing_settings`; **rejects** any attempt to raise
        `rate_limit_per_minute` above the platform ceiling — only operators do that). `serialize.ts`. **H4 / H6.**

- [ ] **`packages/sara/src/scheduling/fairness.ts`** (or alongside 04's sweep selection — extends 04, does not
      replace its locks):
      - `selectDueSubscriptionsFair(db, env, now, { globalBudget, perTenantBudget }): Promise<DueRow[]>` — the
        round-robin, per-tenant-budgeted due-selection (window function `row_number() over (partition by
        organization_id order by due_at, id)` then `rn <= perTenantBudget`, capped at `globalBudget`,
        oldest-due-first within each tenant). Pure SQL over 04's due index; no N+1. **H7 ★.**
      - `advanceRotation(env, sweptOrgIds)` / `nextRotationOrder(env)` — the advisory Redis-sorted-set rotation
        cursor so a backlog tenant is prioritized next tick and no tenant is perpetually last (advisory only;
        DB stays the source of truth for "due"). **H7 ★.**
      - `FAIR_SWEEP_DEFAULTS` `as const` (`globalBudget`, `perTenantBudget`) — tunable, not load-bearing for
        correctness (04's catch-up guarantees eventual completion regardless).

- [ ] **`packages/sara/src/observability/tenant-log.ts`**: `withTenantLog(ctx, correlationId)` — returns a
      logger bound to `{ organizationId, environment, correlationId }` so every billing-path log line is
      tenant-filterable and uniform (no PII). **H8 / M1.**

- [ ] **Events**: register `settlement.created` in `sara/events` so the 07 outbox fans it out (the C.6 name —
      no new catalog invented). **H5 / G.**

### API (apps/api)

Thin controllers (`jsonHandler` / `paginatedHandler`), fixed middleware order
(`apiKeyAuth → rateLimit → requireScope → idempotency → validate → controller`; reads skip `idempotency`).
New scopes: `settlements:read`, `settings:read`, `settings:write`.

- [ ] **`modules/settlements/`** (`routes.ts` + `controllers/{list,get}`):
      - `GET /v1/settlements` → `requireScope('settlements:read')`, paginated — list the tenant's settlements
        (cursor + optional `status`). **H5 inspect.**
      - `GET /v1/settlements/:ref` → `settlements:read` — one settlement (gross/fee/net/status).
- [ ] **`modules/settings/`** (`routes.ts` + `controllers/{get,update}`):
      - `GET /v1/settings` → `requireScope('settings:read')` — the unified tenant-config read
        (`getTenantSettings`: billing settings + webhook config (secret withheld) + nomba account + branding).
        **H4.**
      - `PUT /v1/settings` → `settings:write`, `idempotency`, `validate({ body: updateTenantSettingsBody })` →
        `updateTenantSettings` (settlement mode, fee override (operator-gated where relevant), branding, quota;
        **cannot self-raise rate limit**). **H4 / H6.**
- [ ] **Mount** both routers under `/v1` in `app/main/routes.ts`. Add the new scopes to the scope set, and add
      every new route to the **isolation route manifest** (the e2e asserts the manifest is complete vs the
      mounted router).

### Wiring

- [ ] **Per-tenant limiter.** Update `apps/api/src/shared/middlewares/rate-limit.ts` to resolve the cap via
      `resolveRateLimit(db, ctx)` (Redis-cached, keyed `ratelimit:cfg:{org}:{env}`) instead of the constant
      `WINDOW_LIMIT`, and add the **monthly quota** check (`quota:{org}:{env}:{YYYYMM}` counter → `429
      QUOTA_EXCEEDED`). Keep the hot path one `INCR` + one conditional `EXPIRE`; keep **fail-open** on a Redis
      error and the `DISABLE_API_RATE_LIMIT` escape hatch. The per-minute window stays keyed per API key; the
      **cap + quota are per org** (multiple keys share one tenant budget). **H6.**
- [ ] **Settlement on collection.** At 03's collection seam (the rail-call site in the charge→ledger→verify
      loop), attach `buildSplitRequest(...)` to the order/charge so the split rides the **same** collection (no
      second money movement), and on the **verified** `payment_success` (the 02 inbound worker, after
      requery), call `recordSettlement(...)`. The seam already exists (03's verify-again-then-act); this phase
      fills the settlement half. No new charge path. **H5 ★.**
- [ ] **Fair sweep.** In `apps/api/src/super-modules/scheduler/index.ts`, the billing-sweep case (registered by
      04) calls `selectDueSubscriptionsFair(...)` for its due-selection instead of the naive selection, then
      claims each row through **04's existing locked claim** (no new lock). Replace only the *selection*; the
      idempotent claim + `(subscription_id, period_index)` uniqueness stay 04's. **H7 ★ / K3.**
- [ ] **Settlement reconcile cron.** Register `await upsertCron('settlement-reconcile', '0 2 * * *')` (nightly)
      and add a `case 'settlement-reconcile'` to the worker switch calling `reconcileSettlements(...)` per
      active tenant (itself fairly iterated), alerting on drift. (09 folds this into the unified nightly
      reconciliation.) **J7 ★.**
- [ ] **Tenant logging.** Thread `withTenantLog(ctx, req.requestId/job.id)` through the settlement, sweep, and
      limiter-reject paths so every billing log line carries `organizationId` + `environment` + correlation id.
      **H8 / M1.**

### Tests

**Unit (sara, pure logic — colocated):**
- [ ] `split.test.ts` — `assertSplitBalances` passes only when `gross = fee + net`, all non-negative integers;
      rejects a 1-kobo leak. `buildSplitRequest` produces `value = gross − fee` (tenant share) with the fee as
      the parent remainder; covers a clamped-floor and clamped-ceiling fee. **H5 ★ / L4.**
- [ ] `fees.test.ts` — `resolvePlatformFee` uses the per-tenant override when present and
      `DEFAULT_FEE_SCHEDULE` otherwise; clamps into `[min, max]`; integer kobo only (no float). **H5.**
- [ ] `fairness.test.ts` — `selectDueSubscriptionsFair` over a fixture where Tenant A has many due and Tenant B
      has few: every tick draws ≤ `perTenantBudget` per tenant, B's due rows are **always** drawn within the
      first tick (never queued behind all of A), oldest-due-first within a tenant; the rotation advances so no
      tenant is perpetually last. **H7 ★.**
- [ ] `limits.test.ts` — `resolveRateLimit` returns the tenant override when set and the platform floor
      otherwise; a tenant override below the floor is clamped up to the floor; quota resolution. **H6.**

**E2e (apps/api, testcontainers Postgres + Redis, real migrations, fake rail + fake Nomba split/webhook):**
- [ ] **The A↔B isolation walk (H2 ⚠ centrepiece).** Seed Tenant A + Tenant B each with a key and a full
      resource set (customer, plan, price, payment method, subscription, invoice, settlement, webhook endpoint,
      billing settings). Iterate the **route manifest** — every `/v1` route — issuing A's key against B's
      reference: assert every read → `404 *_NOT_FOUND` (no leak) and every mutate → `403`/`404` with **no
      write applied** (re-fetch with B's key proves B's data unchanged). Assert the manifest is **complete**
      vs the mounted router (a route missing from the manifest fails the test). Verified twice: the static
      scoping audit (read) + this walk (run). **H2 ⚠ / H1 / N3.**
- [ ] **No god key.** Assert no scope set or key grants cross-tenant access; a key minted for A, with every
      scope, still 404s on B's resources. **H3.**
- [ ] **Settlement split happy path.** Drive a collection for Tenant A → on the (faked) verified
      `payment_success`, assert exactly one `settlements` row with `gross = fee + net` (kobo-exact), one balanced
      ledger transaction (settlement leg + fee leg into `platform_fees`), `settlement.created` emitted, and the
      tenant share value matches the split request sent to the rail. **H5 ★ / J5 / L4.**
- [ ] **Settlement idempotency.** Replay the verified webhook for the same `merchant_tx_ref`/`invoice_id`:
      exactly **one** `settlements` row and **one** ledger transaction — `unique(merchant_tx_ref)` /
      `unique(invoice_id)` make a duplicate impossible. **K2 / J6.**
- [ ] **Per-tenant rate limit + quota.** Tenant A configured (via operator seam) to a higher per-minute cap
      than B: A sustains more requests before `429 RATE_LIMIT_EXCEEDED`; B hits its lower cap first — proving
      the cap is per-tenant, not global. Drive a tenant past `monthly_request_quota` → `429 QUOTA_EXCEEDED`
      (distinct code). A self-raise of one's own rate limit via `PUT /v1/settings` is rejected. **H6.**
- [ ] **Fair sweep (the H7 ★ proof).** Fixture: Tenant A 10,000 due, Tenant B 10 due. Run a bounded number of
      ticks; assert **all of B** bills within the first tick (B not starved behind A's backlog) and per-tenant
      draw ≤ `perTenantBudget`; 04's catch-up drains A across subsequent ticks with **zero duplicate charges**
      (single charge per `(subscription, period)`). **H7 ★.**
- [ ] **Cross-tenant concurrency (K3 ⚠).** Two tenants' sweeps run concurrently against overlapping windows;
      assert no cross-contamination of state and that the same subscription is never double-charged (04's claim
      under the fair selection). Verified twice (read: the locked claim + uniqueness; run: the race). **K3 ⚠.**
- [ ] **Tenant config surface.** `GET /v1/settings` returns the unified config (billing + webhook *prefix only,
      secret withheld* + nomba account + branding); `PUT /v1/settings` updates settlement mode/branding/quota
      and a subsequent read reflects it; the webhook secret is **never** returned. **H4.**
- [ ] **Settlement reconcile.** Seed a Nomba-side transaction with no local settlement and a local settlement
      with no Nomba match; `reconcileSettlements` surfaces the orphan + the missing one and the amount drift;
      a balanced ledger passes the zero-sum leg check. **J7 ★.**
- [ ] **Tenant-filterable logs.** A settlement + a sweep + a limiter reject each emit a structured log carrying
      `organizationId` + `environment` + correlation id (assert the captured log fields). **H8 / M1.**
- [ ] Auth/scope smoke: `settlements` + `settings` routes reject a missing key / wrong scope. **N3.**

---

## Verification checklist (rubric)

One line per box; each states HOW it is demonstrated. `⚠` boxes verified twice (read + run); `★` are the
explicit goals of this phase.

- [ ] **H1** — every domain entity carries `organization_id` (+ `environment`): the static scoping audit
      enumerates every tenant-scoped table and asserts both columns; re-proven by the isolation walk touching
      every resource.
- [ ] **H2 ⚠** — isolation proven on **every endpoint**: the data-driven A↔B route-walk asserts A's key cannot
      read or mutate B's data on any `/v1` route, with the manifest asserted complete vs the mounted router
      (read: the scoping audit; run: the walk).
- [ ] **H3** — keys map to exactly one tenant, no god key: a key born pinned to one org+env
      (`api-keys/keys.ts`); the no-god-key e2e shows an all-scopes A key still 404s on B.
- [ ] **H4** — per-tenant config (plans/dunning/webhook/branding/grace): `GET /v1/settings` unifies
      `org_billing_settings` (06 dunning/grace + this phase's branding/limits) + `webhook_endpoints` (07 URL +
      secret, prefix-only) + plans (01); the config e2e reads and updates it (secret withheld).
- [ ] **H5 ★** — sub-account + split separates tenant share and platform fee automatically: `buildSplitRequest`
      + `recordSettlement` post one `settlements` row (`gross = fee + net`, kobo-exact) and a balanced ledger
      transaction (settlement leg + fee leg into `platform_fees`); the split happy-path e2e asserts the tenant
      share landed via the sub-account split and the fee was separated (the platform-fee remainder), `★`.
- [ ] **H6** — per-tenant rate limits / quotas: `resolveRateLimit` + the per-org cap and monthly quota in the
      limiter; the rate-limit e2e shows A and B throttle at different caps and a quota breach → `QUOTA_EXCEEDED`,
      and a self-raise is rejected.
- [ ] **H7 ★** — fair scheduling, no tenant starves: `selectDueSubscriptionsFair` round-robin + per-tenant
      budget + advisory rotation; the fair-sweep e2e (A 10k / B 10) bills all of B within the first tick while
      A drains across ticks with zero duplicate charges, `★`.
- [ ] **H8** — metrics/logs filterable by tenant: `withTenantLog`; the logging e2e asserts settlement/sweep/
      limiter log lines carry `organizationId` + `environment` + correlation id.
- [ ] **K3 ⚠** — cross-tenant concurrency safe: two tenants' sweeps concurrent under the fair selection +
      04's locked claim; the race e2e asserts no double-charge and no cross-tenant state corruption (read: the
      locked claim + `(subscription, period)` uniqueness; run: the race).
- [ ] **N3** — every settlement/settings route authed + scoped, no unauthenticated/cross-tenant mutation: the
      isolation walk + the auth/scope smoke prove it across the new routes.
- [ ] **J5** — settlement posts a ledger entry: `recordSettlement`'s in-tx `postTransaction`; the split
      happy-path e2e asserts the balanced settlement+fee transaction exists.
- [ ] **J7 ★** — reconciliation exists (**settlement-leg facet**; the charge/invoice facet is 09's
      `reconcileAgainstNomba` — see build_plan_09 §D.5, so J7 is split, not double-counted):
      `reconcileSettlements` diffs Nomba vs `settlements` by `merchant_tx_ref`
      + the zero-sum leg check; the reconcile e2e surfaces orphan/missing/drift.
- [ ] **K2** — duplicate settlements structurally impossible: `unique(merchant_tx_ref)` + `unique(invoice_id)`;
      the idempotency e2e replays the webhook → exactly one settlement + one posting.
- [ ] **L4** — money represented consistently: every settlement field is integer kobo, `gross = fee + net`
      asserted in code (`assertSplitBalances`), the DB `check` constraint, and the split unit test.
- [ ] **M1** — logs carry correlation + tenant ids: `withTenantLog` field shape, asserted by the logging e2e.
- [ ] `pnpm type-check`, `pnpm build`, `pnpm test` all green across the workspace.

---

## Done when

Tenant isolation is a **proven property of the data model**, not a hope: the static scoping audit + a
**data-driven A↔B route-walk over every `/v1` endpoint** show Tenant A's key can neither read nor mutate
Tenant B's data anywhere (the route manifest asserted complete against the mounted router, so no endpoint
escapes the proof), with **no god key**. Per-tenant **config** is unified behind `GET/PUT /v1/settings`
(`org_billing_settings` extended with limits/settlement/branding + the 07 webhook URL/secret surfaced,
secret withheld), per-tenant **rate limits + a monthly quota** are enforced in the limiter (per-org cap, no
self-raise, fail-open preserved), and the billing sweep is **fair** — a round-robin, per-tenant-budgeted
selection on top of 04's locked, idempotent claim so a 10,000-subscription tenant cannot starve a 10-
subscription tenant (proven by the A-10k/B-10 fixture; 04's catch-up still drains backlogs with zero
duplicate charges). **Settlement** runs the real model: each tenant maps to a Nomba **sub-account**
(`org_nomba_accounts`), every collection carries an inline **`splitRequest`** so the **tenant share and the
platform fee separate automatically** (fee from the clamped `config/fees.ts` engine, kobo-exact `gross = fee
+ net`), each split is a `settlements` row + a **balanced double-entry posting** (`settlement` + `fee` legs)
emitting `settlement.created`, payouts/refunds go through **Transfers**, and settlements **reconcile**
against Nomba by `merchant_tx_ref`. Every billing log line is **tenant-filterable**. Every rubric box above is
green (the `★` H5/H7 demonstrated, the `⚠` H2/K3 verified twice), the `⚠` Nomba split/sub-account semantics
are carried as sandbox-confirm flags isolated to the rail adapter + `buildSplitRequest` seam, and
`pnpm type-check`, `pnpm build`, `pnpm test` pass across the workspace. The phase hands 09 a tenant-tagged
record + log substrate for per-tenant metrics, the settlement reconciliation for the nightly job, and the
route-walking isolation harness for the full proof.
